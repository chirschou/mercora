import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateBlogReadingTime } from "@/lib/blog/values";
import { sanitizePageHtmlServer, sanitizeRichHtmlServer } from "@/lib/utils/sanitize-html-core";
import { inspectMigration, stripSqlComments } from "@/scripts/lib/migration-safety.mjs";

const migrationPath = "migrations/0027_publish_storefront_pages_and_blog.sql";
const migration = readFileSync(migrationPath, "utf8");
const CDN = "https://images.melt.party";

type SqlValue = string | number | null;

/** 把 VALUES 元组切成顶层 SQL 值，并还原字符串字面量中的转义。 */
function tupleValues(tuple: string): SqlValue[] {
  const values: SqlValue[] = [];
  let index = 0;
  while (index < tuple.length) {
    while (/[\s,]/.test(tuple[index] ?? "")) index += 1;
    if (index >= tuple.length) break;
    if (tuple[index] === "'") {
      let text = "";
      index += 1;
      while (index < tuple.length) {
        if (tuple[index] === "'" && tuple[index + 1] === "'") {
          text += "'";
          index += 2;
        } else if (tuple[index] === "'") {
          index += 1;
          break;
        } else {
          text += tuple[index];
          index += 1;
        }
      }
      values.push(text);
      continue;
    }
    let depth = 0;
    let raw = "";
    while (index < tuple.length && (depth > 0 || tuple[index] !== ",")) {
      if (tuple[index] === "(") depth += 1;
      if (tuple[index] === ")") depth -= 1;
      raw += tuple[index];
      index += 1;
    }
    const token = raw.trim();
    values.push(token === "NULL" ? null : /^\d+$/.test(token) ? Number(token) : token);
  }
  return values;
}

function insertedRows(table: "pages" | "blog_posts"): Array<Record<string, SqlValue>> {
  const pattern = new RegExp(`INSERT INTO ${table} \\(([^)]*)\\)\\nVALUES \\(\\n([\\s\\S]*?)\\n\\)\\nON CONFLICT`, "g");
  return [...migration.matchAll(pattern)].map((match) => {
    const columns = match[1].split(",").map((column) => column.trim());
    const values = tupleValues(match[2]);
    expect(values).toHaveLength(columns.length);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

describe("0027 storefront pages and Blog migration file", () => {
  it("is expand-only and never derives content dates from the apply time", () => {
    expect(inspectMigration(migrationPath, migration).status).toBe("expand");
    const statements = stripSqlComments(migration);
    expect(statements).not.toMatch(/date\('now'\)|datetime\('now'\)/i);
    expect(statements).not.toMatch(/\bDELETE\s+FROM\b|\bDROP\b|\bRENAME\b/i);
  });

  it("stores page bodies in the exact form the admin page editor saves", () => {
    const pages = insertedRows("pages");
    expect(pages.map(({ slug }) => slug)).toEqual(["about", "privacy-policy", "terms-of-service", "contact"]);
    for (const page of pages) {
      const content = page.content as string;
      expect(sanitizePageHtmlServer(content, { allowedImageOrigin: CDN })).toBe(content);
      expect(content.length).toBeLessThan(100_000);
    }
  });

  it("stores Blog bodies in the exact form the admin Blog editor saves", () => {
    const posts = insertedRows("blog_posts");
    expect(posts).toHaveLength(5);
    for (const post of posts) {
      const html = post.html as string;
      expect(sanitizeRichHtmlServer(html, { allowedImageOrigin: CDN })).toBe(html);
      expect(calculateBlogReadingTime(html)).toBe(post.reading_time);
    }
  });

  it("publishes the recurring terms version configured in wrangler.jsonc", () => {
    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    const version = wrangler.match(/"STORE_SUBSCRIPTION_TERMS_VERSION":\s*"([^"]+)"/)?.[1];
    expect(version).toBe("2026-11-09");
    const terms = insertedRows("pages").find(({ slug }) => slug === "terms-of-service")!.content as string;
    expect(terms).toContain(`<h2>10. Subscriptions (Recurring Purchase Terms, version ${version})</h2>`);
  });
});
