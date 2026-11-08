import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

const MIGRATION = "0026_rebrand_about_page.sql";

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

async function aboutContent(): Promise<string> {
  const row = await env.DB.prepare("SELECT content FROM pages WHERE slug = 'about'")
    .first<{ content: string }>();
  return row?.content ?? "";
}

describe("rebrand-about-page migration", () => {
  it("rewrites the seeded About page to the new store and assistant names, idempotently", async () => {
    const { before, only } = split();
    await applyD1Migrations(env.DB, before);
    expect(await aboutContent()).not.toContain("Melt Party");

    await applyD1Migrations(env.DB, only);

    const content = await aboutContent();
    expect(content).toContain("<h1>About Melt Party</h1>");
    expect(content).toContain("<p>Melt Party is an innovative");
    expect(content).toContain("assistant Floe helps you find the perfect gear");

    await rerun(only);
    expect(await aboutContent()).toBe(content);
  });

  it("leaves an admin-edited About body and every other page untouched", async () => {
    const { before, only } = split();
    await applyD1Migrations(env.DB, [...before, ...only]);
    const edited = "<h1>Our shop</h1><p>Written by the admin; no seeded brand words.</p>";
    await env.DB.prepare("UPDATE pages SET content = ? WHERE slug = 'about'").bind(edited).run();
    const otherPages = async () => JSON.stringify((await env.DB.prepare(
      "SELECT slug, content, updated_at FROM pages WHERE slug <> 'about' ORDER BY slug",
    ).all()).results);
    const othersBefore = await otherPages();

    await rerun(only);

    expect(await aboutContent()).toBe(edited);
    expect(await otherPages()).toBe(othersBefore);
  });
});
