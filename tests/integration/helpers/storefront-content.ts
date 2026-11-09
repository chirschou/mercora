import { expect } from "vitest";
import { env } from "cloudflare:workers";

export const STOREFRONT_CONTENT_MIGRATION = "0027_publish_storefront_pages_and_blog.sql";
export const CONTENT_PAGE_SLUGS = ["about", "contact", "privacy-policy", "terms-of-service"] as const;
export const UPSERT_COLUMNS = [
  "title", "content", "excerpt", "meta_title", "meta_description", "meta_keywords", "status",
  "published_at", "template", "sort_order", "show_in_nav", "nav_title", "is_protected",
] as const;

export type PageRow = {
  id: number; slug: string; title: string; content: string; excerpt: string | null; meta_title: string | null;
  meta_description: string | null; meta_keywords: string | null; status: string; published_at: number | null;
  template: string; sort_order: number; show_in_nav: number; nav_title: string | null; is_protected: number;
  version: number; updated_at: number;
};

export type PostRow = {
  id: number; title: string; slug: string; author: string; excerpt: string | null; tags: string;
  cover_image_url: string | null; cover_image_alt: string | null; status: string; editor_json: string | null;
  html: string; reading_time: number; category_slug: string | null; meta_title: string | null;
  meta_description: string | null; published_at: number; created_at: number; updated_at: number;
};

export function splitAtStorefrontContent() {
  const index = env.TEST_MIGRATIONS.findIndex(({ name }) => name === STOREFRONT_CONTENT_MIGRATION);
  expect(index).toBeGreaterThan(0);
  return {
    before: env.TEST_MIGRATIONS.slice(0, index),
    only: env.TEST_MIGRATIONS.slice(index, index + 1),
  };
}

export async function rerunStorefrontContent(): Promise<void> {
  const { only } = splitAtStorefrontContent();
  await env.DB.batch(only[0].queries.map((query) => env.DB.prepare(query)));
}

export async function contentPageRows(): Promise<Record<string, PageRow>> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM pages WHERE slug IN (${CONTENT_PAGE_SLUGS.map(() => "?").join(", ")}) ORDER BY slug`,
  ).bind(...CONTENT_PAGE_SLUGS).all<PageRow>();
  return Object.fromEntries(results.map((row) => [row.slug, row]));
}

export async function blogPostRows(): Promise<PostRow[]> {
  const { results } = await env.DB.prepare(`
    SELECT p.*, c.slug AS category_slug FROM blog_posts p
    LEFT JOIN blog_categories c ON c.id = p.category_id
    ORDER BY p.published_at DESC
  `).all<PostRow>();
  return results;
}

export async function pageVersionsOf(slug: string) {
  const { results } = await env.DB.prepare(`
    SELECT v.version, v.content, v.change_summary, v.created_by FROM page_versions v
    JOIN pages p ON p.id = v.page_id WHERE p.slug = ? ORDER BY v.id
  `).bind(slug).all<{ version: number; content: string; change_summary: string | null; created_by: string }>();
  return results;
}

export async function tableCount(table: "page_versions" | "blog_posts" | "blog_categories"): Promise<number> {
  return (await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>())?.count ?? 0;
}

/** 直接求值 0027 中各页面 UPSERT 的 VALUES 字面量，与库的现有状态无关，作为全新库与生产库共同的期望值。 */
export async function migrationPageLiterals(): Promise<Record<string, Record<string, unknown>>> {
  const { only } = splitAtStorefrontContent();
  const literals: Record<string, Record<string, unknown>> = {};
  for (const query of only[0].queries.filter((text) => text.includes("INSERT INTO pages ("))) {
    const columns = query.match(/INSERT INTO pages \(([^)]*)\)/)![1].split(",").map((column) => column.trim());
    const tuple = query.slice(query.indexOf("VALUES (") + "VALUES (".length, query.lastIndexOf(")\nON CONFLICT"));
    const [values] = await env.DB.prepare(`SELECT ${tuple}`).raw();
    const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
    literals[row.slug as string] = row;
  }
  expect(Object.keys(literals).sort()).toEqual([...CONTENT_PAGE_SLUGS]);
  return literals;
}

export function contentFields(row: Record<string, unknown>) {
  return Object.fromEntries(UPSERT_COLUMNS.map((column) => [column, row[column]]));
}
