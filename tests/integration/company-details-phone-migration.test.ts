import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

const MIGRATION = "0028_fill_company_details_and_support_phone.sql";
const SLUGS = ["about", "contact", "privacy-policy", "terms-of-service"] as const;
const PHONE = "+1 (929) 206-2531";
const ADDRESS = "Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong";
const PLACEHOLDER = /\[[A-Z][A-Z ]+\]/;
const EMAIL_LINE = '<p>Email: <a href="mailto:support@melt.party">support@melt.party</a><br />';

interface PageRow {
  slug: string;
  content: string;
  version: number;
}

function split() {
  const index = env.TEST_MIGRATIONS.findIndex(({ name }) => name === MIGRATION);
  expect(index).toBeGreaterThan(0);
  return {
    before: env.TEST_MIGRATIONS.slice(0, index),
    only: env.TEST_MIGRATIONS.slice(index, index + 1),
  };
}

async function rerun(only: typeof env.TEST_MIGRATIONS): Promise<void> {
  await env.DB.batch(only[0].queries.map((query) => env.DB.prepare(query)));
}

async function pages(): Promise<Record<string, PageRow>> {
  const { results } = await env.DB.prepare(
    "SELECT slug, content, version FROM pages ORDER BY slug",
  ).all<PageRow>();
  return Object.fromEntries(results.map((row) => [row.slug, row]));
}

async function versions(slug: string) {
  const { results } = await env.DB.prepare(`
    SELECT v.version, v.content, v.change_summary
    FROM page_versions v JOIN pages p ON p.id = v.page_id
    WHERE p.slug = ? ORDER BY v.version
  `).bind(slug).all<{ version: number; content: string; change_summary: string }>();
  return results;
}

/** 0028 规定的替换结果，与 SQL 中的替换顺序一致。 */
function expectedContent(slug: string, content: string): string {
  let next = content
    .replaceAll("(registration number [COMPANY REGISTRATION NUMBER])", "(Hong Kong Company Registration No. 3293783)")
    .replaceAll("Registration number: [COMPANY REGISTRATION NUMBER]", "Hong Kong Company Registration No. 3293783")
    .replaceAll("[COMPANY REGISTRATION NUMBER]", "3293783")
    .replaceAll("[COMPANY LEGAL NAME]", "DONG LU LIMITED")
    .replaceAll("[REGISTERED ADDRESS]", ADDRESS)
    .replaceAll(
      "governed by the laws of [GOVERNING JURISDICTION], and the courts of [GOVERNING JURISDICTION] have jurisdiction",
      "governed by the laws of the Hong Kong Special Administrative Region, and the courts of Hong Kong have jurisdiction",
    )
    .replaceAll("[GOVERNING JURISDICTION]", "the Hong Kong Special Administrative Region");
  if (slug === "contact") {
    next = next.replaceAll(
      "<h2>Support hours</h2>",
      `<h2>Phone support</h2>\n<p>Call ${PHONE} during our support hours.</p>\n<h2>Support hours</h2>`,
    );
  }
  if (slug === "privacy-policy" || slug === "terms-of-service") {
    next = next.replaceAll(EMAIL_LINE, `${EMAIL_LINE}Phone: ${PHONE}<br />`);
  }
  return next;
}

// 测试池按文件隔离存储：两个用例共享同一个库，按声明顺序执行。
describe("0028 company details and support phone migration", () => {
  it("fills every placeholder and adds the phone with version history, and re-running is a no-op", async () => {
    const { before, only } = split();
    await applyD1Migrations(env.DB, before);
    const original = await pages();
    for (const slug of SLUGS) expect(original[slug].content).toMatch(PLACEHOLDER);

    await applyD1Migrations(env.DB, only);
    const migrated = await pages();

    for (const slug of SLUGS) {
      expect(migrated[slug].content).not.toMatch(PLACEHOLDER);
      expect(migrated[slug].content).toBe(expectedContent(slug, original[slug].content));
      expect(migrated[slug].version).toBe(original[slug].version + 1);
      const history = await versions(slug);
      expect(history.at(-1)).toEqual({
        version: migrated[slug].version,
        content: migrated[slug].content,
        change_summary: "FIX-20261109-03 company details and support phone",
      });
      expect(history.some((row) => row.version === original[slug].version)).toBe(true);
    }
    expect(migrated.about.content).toContain(`Our registered address is ${ADDRESS}.`);
    expect(migrated.about.content).not.toContain(PHONE);
    expect(migrated.contact.content).toContain(
      `<p>DONG LU LIMITED<br />${ADDRESS}<br />Hong Kong Company Registration No. 3293783</p>`,
    );
    expect(migrated["terms-of-service"].content).toContain(
      "These terms are governed by the laws of the Hong Kong Special Administrative Region, and the courts of Hong Kong have jurisdiction",
    );
    for (const slug of ["privacy-policy", "terms-of-service"]) {
      expect(migrated[slug].content).toContain(
        `${EMAIL_LINE}Phone: ${PHONE}<br />DONG LU LIMITED<br />${ADDRESS}</p>`,
      );
    }
    for (const slug of Object.keys(original).filter((key) => !SLUGS.includes(key as never))) {
      expect(migrated[slug]).toEqual(original[slug]);
    }

    const snapshot = async () => JSON.stringify({
      pages: (await env.DB.prepare("SELECT slug, content, version, updated_at FROM pages ORDER BY slug").all()).results,
      versions: (await env.DB.prepare("SELECT COUNT(*) AS n FROM page_versions").first()),
    });
    const afterFirstRun = await snapshot();
    await rerun(only);
    expect(await snapshot()).toBe(afterFirstRun);
  });

  it("keeps admin edits, snapshots an unversioned edit first, and skips the phone when its anchor is gone", async () => {
    const { only } = split();
    const [placeholderVersion] = await versions("contact");
    expect(placeholderVersion.content).toMatch(PLACEHOLDER);
    const edited = placeholderVersion.content
      .replace("<h2>Support hours</h2>", "<h2>Hours</h2>")
      .concat("<p>Admin note kept.</p>");
    await env.DB.prepare("UPDATE pages SET content = ?, version = 9 WHERE slug = 'contact'")
      .bind(edited).run();

    await rerun(only);

    const contact = (await pages()).contact;
    expect(contact.version).toBe(10);
    expect(contact.content).toBe(expectedContent("contact", edited));
    expect(contact.content).not.toMatch(PLACEHOLDER);
    expect(contact.content).toContain("<p>Admin note kept.</p>");
    expect(contact.content).not.toContain(PHONE);
    const history = await versions("contact");
    expect(history.filter((row) => row.version >= 9).map(({ version, change_summary }) => ({ version, change_summary })))
      .toEqual([
        { version: 9, change_summary: "Snapshot before FIX-20261109-03 company details and support phone" },
        { version: 10, change_summary: "FIX-20261109-03 company details and support phone" },
      ]);
    expect(history.find((row) => row.version === 9)?.content).toBe(edited);

    await rerun(only);
    expect((await pages()).contact).toEqual(contact);
    expect(await versions("contact")).toHaveLength(history.length);
  });
});
