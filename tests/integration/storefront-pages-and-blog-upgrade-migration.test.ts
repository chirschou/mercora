import { beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";

vi.mock("server-only", () => ({}));
// Workers 测试池无法加载 sanitize-html；这里只验证迁移对已有数据的处理，与清洗无关。
vi.mock("@/lib/utils/sanitize-html-server", () => ({
  sanitizePageHtmlServer: (html: string) => html,
  sanitizeRichHtmlServer: (html: string) => html,
}));
vi.mock("@/lib/db", () => ({
  getDbAsync: async () => drizzle(env.DB, { schema }),
}));
vi.mock("@/lib/store-config", () => ({
  getStoreConfig: () => ({
    identity: { name: "Melt Party" },
    urls: { imageCdn: "https://images.melt.party" },
  }),
}));

import { updatePage } from "@/lib/models/pages";
import {
  CONTENT_PAGE_SLUGS,
  contentFields,
  contentPageRows,
  migrationPageLiterals,
  pageVersionsOf,
  splitAtStorefrontContent,
  tableCount,
} from "./helpers/storefront-content";

const ADMIN_EDIT = "<p>Edited by an admin before the rewrite.</p>";
const DIRECT_EDIT = "<p>Edited directly in the database.</p>";

// 模拟已应用 0001–0026 的生产库：后台改过 about，库里直接改过 terms，
// 并且已有与 0027 同 slug 的分类和文章；随后应用 0027。
beforeAll(async () => {
  const { before, only } = splitAtStorefrontContent();
  await applyD1Migrations(env.DB, before);
  const about = await env.DB.prepare("SELECT id FROM pages WHERE slug = 'about'").first<{ id: number }>();
  await updatePage(about!.id, { content: ADMIN_EDIT }, "admin_user", "Admin edit");
  await env.DB.prepare("UPDATE pages SET content = ?, nav_title = 'Terms' WHERE slug = 'terms-of-service'")
    .bind(DIRECT_EDIT).run();
  await env.DB.prepare(
    "INSERT INTO blog_categories (name, slug, description) VALUES ('Merchant guides', 'gear-guides', 'Admin owned')",
  ).run();
  await env.DB.prepare(`INSERT INTO blog_posts (title, slug, author, status, html, published_at)
    VALUES ('Admin post', 'fire-starting-in-wet-weather', 'Merchant', 'published', '<p>Admin body</p>', 100)`).run();

  await applyD1Migrations(env.DB, only);
});

describe("0027 on an existing production database", () => {
  it("(b) produces the same page content as a fresh database and keeps prior edits in history", async () => {
    const rows = await contentPageRows();
    const literals = await migrationPageLiterals();
    for (const slug of CONTENT_PAGE_SLUGS) expect(contentFields(rows[slug])).toEqual(contentFields(literals[slug]));

    const aboutVersions = await pageVersionsOf("about");
    expect(aboutVersions.map(({ version, change_summary, created_by }) => [version, change_summary, created_by])).toEqual([
      [2, "Admin edit", "admin_user"],
      [3, "FEAT-20261109-01 content", "system"],
    ]);
    expect(aboutVersions[0].content).toBe(ADMIN_EDIT);
    expect(aboutVersions[1].content).toBe(rows.about.content);
    expect(rows.about.version).toBe(3);

    const termsVersions = await pageVersionsOf("terms-of-service");
    expect(termsVersions.map(({ version, change_summary, content }) => [version, change_summary, content])).toEqual([
      [1, "Snapshot before FEAT-20261109-01 content rewrite", DIRECT_EDIT],
      [2, "FEAT-20261109-01 content", rows["terms-of-service"].content],
    ]);
    expect(rows["terms-of-service"].nav_title).toBeNull();
  });

  it("(d) never overwrites an existing post or category with the same slug", async () => {
    const existing = await env.DB.prepare(
      "SELECT title, author, html, published_at FROM blog_posts WHERE slug = 'fire-starting-in-wet-weather'",
    ).first();
    expect(existing).toEqual({ title: "Admin post", author: "Merchant", html: "<p>Admin body</p>", published_at: 100 });
    const category = await env.DB.prepare("SELECT name, description FROM blog_categories WHERE slug = 'gear-guides'").first();
    expect(category).toEqual({ name: "Merchant guides", description: "Admin owned" });
    expect(await tableCount("blog_posts")).toBe(5);
    expect(await tableCount("blog_categories")).toBe(2);
  });
});
