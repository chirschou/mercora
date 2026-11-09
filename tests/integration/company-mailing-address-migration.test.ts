import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

const MIGRATION = "0029_update_company_mailing_address.sql";
const SLUGS = ["about", "contact", "privacy-policy", "terms-of-service"];
const OLD_ADDRESS = "Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong";
const ADDRESS = "1521 Blake St Ste 47009, Denver, Colorado 80202, United States";
const SUMMARY = "FEAT-20261109-06 更新公司通信地址";

interface PageRow {
  id: number;
  slug: string;
  content: string;
  version: number;
  updated_at: number;
}

function split() {
  const index = env.TEST_MIGRATIONS.findIndex(({ name }) => name === MIGRATION);
  expect(index).toBeGreaterThan(0);
  return { before: env.TEST_MIGRATIONS.slice(0, index), only: env.TEST_MIGRATIONS.slice(index, index + 1) };
}

async function rerun() {
  const { only } = split();
  const results = await env.DB.batch(only[0].queries.map((query) => env.DB.prepare(query)));
  return results.reduce((sum, result) => sum + result.meta.changes, 0);
}

async function pages() {
  const { results } = await env.DB.prepare("SELECT * FROM pages ORDER BY id").all<PageRow>();
  return Object.fromEntries(results.map((page) => [page.slug, page]));
}

async function history() {
  return (await env.DB.prepare("SELECT * FROM page_versions ORDER BY id").all<{
    page_id: number; version: number; content: string; change_summary: string;
  }>()).results;
}

function withoutAddress(content: string) {
  return content.replaceAll(OLD_ADDRESS, "地址").replaceAll(ADDRESS, "地址")
    .replaceAll("Our registered address is ", "Our mailing address is ")
    .replaceAll("located at 地址", "whose mailing address is 地址")
    .replaceAll("Mailing address: 地址", "地址");
}

describe("0029 公司通信地址迁移", () => {
  it("新库更新四页的地址与称谓，保留其余内容与版本历史，重跑零写入", async () => {
    const { before, only } = split();
    await applyD1Migrations(env.DB, before);
    const original = await pages();
    const originalSettings = (await env.DB.prepare("SELECT * FROM admin_settings ORDER BY key").all()).results;

    await applyD1Migrations(env.DB, only);
    const migrated = await pages();
    const versions = await history();
    for (const slug of SLUGS) {
      const old = original[slug];
      const page = migrated[slug];
      expect(page.content).toContain(ADDRESS);
      expect(page.content).not.toContain(OLD_ADDRESS);
      expect(page.content).not.toMatch(/registered address|located at/);
      expect(withoutAddress(page.content)).toBe(withoutAddress(old.content));
      expect(page.version).toBe(old.version + 1);
      expect(versions).toEqual(expect.arrayContaining([
        expect.objectContaining({ page_id: old.id, version: old.version, content: old.content }),
        expect.objectContaining({ page_id: old.id, version: page.version, content: page.content, change_summary: SUMMARY }),
      ]));
    }
    expect(migrated.about.content).toContain(`Our mailing address is ${ADDRESS}.`);
    for (const slug of ["privacy-policy", "terms-of-service"]) {
      expect(migrated[slug].content).toContain(`DONG LU LIMITED (Hong Kong Company Registration No. 3293783), whose mailing address is ${ADDRESS}`);
    }
    for (const slug of ["contact", "privacy-policy", "terms-of-service"]) {
      expect(migrated[slug].content).toContain(`DONG LU LIMITED<br />Mailing address: ${ADDRESS}`);
      expect(migrated[slug].content).toContain("+1 (929) 206-2531");
    }
    expect(migrated["terms-of-service"].content).toContain("governed by the laws of the Hong Kong Special Administrative Region, and the courts of Hong Kong have jurisdiction");
    for (const slug of Object.keys(original).filter((slug) => !SLUGS.includes(slug))) {
      expect(migrated[slug]).toEqual(original[slug]);
    }
    expect((await env.DB.prepare("SELECT * FROM admin_settings ORDER BY key").all()).results).toEqual(originalSettings);
    expect(await rerun()).toBe(0);
    expect(await pages()).toEqual(migrated);
    expect(await history()).toEqual(versions);
  });

  it("保留后台编辑并快照未归档版本，跳过无旧地址或待改称谓的页面", async () => {
    const edited = `<p>后台保留文字。</p><p>Our registered address is ${OLD_ADDRESS}.</p>`;
    await env.DB.prepare("UPDATE pages SET content = ?, version = 20 WHERE slug = 'about'").bind(edited).run();
    const unchanged = `<p>Our mailing address is ${ADDRESS}.</p>`;
    await env.DB.prepare("UPDATE pages SET content = ?, version = 20 WHERE slug = 'contact'").bind(unchanged).run();
    await env.DB.prepare("UPDATE pages SET content = '<p>Our registered address is another address.</p>', version = 20 WHERE slug = 'privacy-policy'").run();
    const original = await pages();
    const oldHistory = await history();

    await rerun();

    const migrated = await pages();
    expect(migrated.about.content).toBe(`<p>后台保留文字。</p><p>Our mailing address is ${ADDRESS}.</p>`);
    expect(migrated.about.version).toBe(21);
    for (const slug of Object.keys(original).filter((slug) => slug !== "about")) {
      expect(migrated[slug]).toEqual(original[slug]);
    }
    const versions = await history();
    expect(versions).toHaveLength(oldHistory.length + 2);
    expect(versions.slice(-2)).toEqual([
      expect.objectContaining({ page_id: original.about.id, version: 20, content: edited, change_summary: `覆盖前快照：${SUMMARY}` }),
      expect.objectContaining({ page_id: original.about.id, version: 21, content: migrated.about.content, change_summary: SUMMARY }),
    ]);
    expect(await rerun()).toBe(0);
    expect(await pages()).toEqual(migrated);
    expect(await history()).toEqual(versions);
  });

  it("仅旧称谓残留时也纠正新地址的称谓，未知页面中的旧地址同样替换", async () => {
    await env.DB.prepare("UPDATE pages SET content = ?, version = 30 WHERE slug = 'about'")
      .bind(`<p>Our registered address is ${ADDRESS}.</p>`).run();
    await env.DB.prepare("UPDATE pages SET content = ?, version = 30 WHERE slug = 'privacy-policy'")
      .bind(`<p>DONG LU LIMITED, located at ${ADDRESS}.</p>`).run();
    await env.DB.prepare("INSERT INTO pages (title, slug, content) VALUES ('自定义页面', 'custom-mailing', ?)")
      .bind(`<p>${OLD_ADDRESS}</p>`).run();

    await rerun();

    const migrated = await pages();
    expect(migrated.about.content).toBe(`<p>Our mailing address is ${ADDRESS}.</p>`);
    expect(migrated["privacy-policy"].content).toBe(`<p>DONG LU LIMITED, whose mailing address is ${ADDRESS}.</p>`);
    expect(migrated["custom-mailing"].content).toBe(`<p>${ADDRESS}</p>`);
    expect(await rerun()).toBe(0);
  });
});
