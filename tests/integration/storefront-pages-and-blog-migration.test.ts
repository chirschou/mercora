import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";

vi.mock("server-only", () => ({}));
// Workers 测试池无法加载 sanitize-html；tests/unit/migrations/storefront-pages-and-blog.test.ts
// 已证明 0027 的每份正文清洗前后不变，因此这里用恒等函数不改变后台保存的行为。
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

import { calculateBlogReadingTime, getRelatedBlogPosts, normalizeBlogSlug, normalizeBlogTags } from "@/lib/blog/values";
import { parsePageHtml } from "@/lib/cms/page-sections";
import {
  adminGetBlogPost,
  adminUpdateBlogPost,
  getPublishedBlogPost,
  getPublishedBlogPosts,
} from "@/lib/models/blog";
import { getNavigationPages, getPageById, getPageBySlug, updatePage } from "@/lib/models/pages";
import { isAllowedImageSource } from "@/lib/utils/sanitize-html-policy";
import {
  CONTENT_PAGE_SLUGS as SLUGS,
  blogPostRows as postRows,
  contentFields,
  contentPageRows as pageRows,
  migrationPageLiterals,
  pageVersionsOf as versionsOf,
  rerunStorefrontContent as rerun,
  tableCount,
} from "./helpers/storefront-content";

const LAST_UPDATED = "<p><strong>Last Updated:</strong> November 9, 2026</p>";
const PLACEHOLDER = /\[[A-Z][A-Z ]*[A-Z]\]/g;
const RESIDUE = /Mercora|Voltique|\bVolt\b|Lorem|ipsum|example\.com|555-0199|BeauTeas|AI-powered eCommerce/i;
const END_OF_NOV_9_2026 = Date.UTC(2026, 10, 9, 23, 59, 59) / 1000;

const PAGE_SPEC = {
  about: {
    title: "About Us", template: "about", showInNav: 1, sortOrder: 1, hasExcerpt: true,
    h2: ["What we do", "What you'll find", "How we help you choose", "How we run the store", "Who we are", "Get in touch"],
    placeholders: { "Who we are": ["[COMPANY LEGAL NAME]", "[REGISTERED ADDRESS]"] },
  },
  contact: {
    title: "Contact Us", template: "contact", showInNav: 0, sortOrder: 102, hasExcerpt: true,
    h2: ["Email support", "Support hours", "Orders, shipping and returns", "Privacy requests", "Ask Floe anytime", "Company details"],
    placeholders: { "Company details": ["[COMPANY LEGAL NAME]", "[COMPANY REGISTRATION NUMBER]", "[REGISTERED ADDRESS]"] },
  },
  "privacy-policy": {
    title: "Privacy Policy", template: "legal", showInNav: 1, sortOrder: 100, hasExcerpt: false,
    h2: [
      "1. Who We Are", "2. Information We Collect", "3. How We Use Information", "4. Legal Bases (EEA/UK)",
      "5. How We Share Information", "6. Cookies and Browser Storage", "7. Floe, Our AI Shopping Assistant", "8. Emails",
      "9. How Long We Keep Information", "10. Your Rights and Choices", "11. U.S. State Privacy Rights (including California)",
      "12. Children", "13. International Transfers", "14. Security", "15. Changes to This Policy", "16. Contact Us",
    ],
    placeholders: {
      "1. Who We Are": ["[COMPANY LEGAL NAME]", "[COMPANY REGISTRATION NUMBER]", "[REGISTERED ADDRESS]"],
      "16. Contact Us": ["[COMPANY LEGAL NAME]", "[REGISTERED ADDRESS]"],
    },
  },
  "terms-of-service": {
    title: "Terms of Service", template: "legal", showInNav: 1, sortOrder: 101, hasExcerpt: false,
    h2: [
      "1. About These Terms", "2. Eligibility and Accounts", "3. Products and Information", "4. Orders, Pricing and Taxes",
      "5. Payment", "6. Shipping and Delivery", "7. Order Changes and Cancellations", "8. Returns and Refunds", "9. Gift Cards",
      "10. Subscriptions (Recurring Purchase Terms, version 2026-11-09)", "11. Product Warranty", "12. Safe Use",
      "13. Acceptable Use", "14. Intellectual Property", "15. Disclaimers", "16. Limitation of Liability",
      "17. Governing Law and Disputes", "18. Changes to These Terms", "19. Contact",
    ],
    placeholders: {
      "1. About These Terms": ["[COMPANY LEGAL NAME]", "[COMPANY REGISTRATION NUMBER]", "[REGISTERED ADDRESS]"],
      "17. Governing Law and Disputes": ["[GOVERNING JURISDICTION]"],
      "19. Contact": ["[COMPANY LEGAL NAME]", "[REGISTERED ADDRESS]"],
    },
  },
} as const;

const POST_SPEC = [
  { slug: "packing-a-72-hour-kit", publishedAt: 1793116800, category: "preparedness", cover: "/products/rapid-wave-kit-6.png",
    tags: ["preparedness", "safety", "guides"], products: ["rapid-wave-kit", "coastal-track-pack", "field-ration-resupply", "twin-dune-tool"] },
  { slug: "choosing-trail-lighting", publishedAt: 1790092800, category: "gear-guides", cover: "/products/storm-orbit-device-8.png",
    tags: ["lighting", "night", "guides"], products: ["storm-orbit-device", "stealth-brook-device", "prism-blaze-device"] },
  { slug: "staying-reachable-off-grid", publishedAt: 1787068800, category: "preparedness", cover: "/products/echo-sky-kit-2.png",
    tags: ["communication", "safety", "backcountry"], products: ["echo-sky-kit", "signal-glade-tool", "frost-hollow-device"] },
  { slug: "fire-starting-in-wet-weather", publishedAt: 1784044800, category: "gear-guides", cover: "/products/dusty-fire-tool-1.png",
    tags: ["fire", "survival", "guides"], products: ["dusty-fire-tool", "solar-arc-tool", "nova-flame-device"] },
  { slug: "navigation-kit-that-works-without-your-phone", publishedAt: 1781625600, category: "gear-guides", cover: "/products/polar-leaf-device-5.png",
    tags: ["navigation", "backcountry", "guides"], products: ["polar-leaf-device", "quantum-ash-device"] },
] as const;

function placeholdersBySection(html: string): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const part of html.split(/(?=<h2>)/)) {
    const heading = part.match(/^<h2>([^<]*)<\/h2>/)?.[1] ?? "(lead)";
    const matches = [...new Set(part.match(PLACEHOLDER) ?? [])].sort();
    if (matches.length) found[heading.replace(/&amp;/g, "&")] = matches;
  }
  return found;
}

function words(html: string): number {
  return html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
}

afterEach(() => {
  vi.useRealTimers();
});

// 测试池按文件隔离存储：本文件各用例共享同一个全新库，按声明顺序执行，会改动文章的用例放在最后。
describe("0027 storefront pages and Blog content migration", () => {
  it("(a) writes the specified page content on a fresh database, with version history", async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const rows = await pageRows();
    const literals = await migrationPageLiterals();
    expect(Object.keys(rows)).toEqual([...SLUGS]);

    for (const slug of SLUGS) {
      const row = rows[slug];
      const spec = PAGE_SPEC[slug];
      expect(contentFields(row)).toEqual(contentFields(literals[slug]));
      expect(row).toMatchObject({
        title: spec.title, template: spec.template, status: "published", published_at: null,
        show_in_nav: spec.showInNav, sort_order: spec.sortOrder, is_protected: 0, nav_title: null,
      });
      expect(row.content.startsWith(LAST_UPDATED)).toBe(true);
      expect(row.content).not.toMatch(/<h1/i);
      expect(row.content).not.toMatch(RESIDUE);
      expect(row.content.length).toBeLessThan(100_000);
      expect([...row.content.matchAll(/<h2>([^<]*)<\/h2>/g)].map((match) => match[1])).toEqual(spec.h2);
      expect(placeholdersBySection(row.content)).toEqual(spec.placeholders);
      expect(row.meta_description!.length).toBeGreaterThanOrEqual(120);
      expect(row.meta_description!.length).toBeLessThanOrEqual(160);

      const parsed = parsePageHtml(row.content, {
        pageTitle: row.title,
        promoteLede: !row.excerpt,
        extractConventions: false,
        liftUpdatedLabel: row.template === "legal",
      });
      const lede = row.excerpt || parsed.lede;
      expect(lede).toBeTruthy();
      expect(lede).not.toMatch(/Last Updated/i);
      if (spec.hasExcerpt) {
        expect(parsed.lead.startsWith(LAST_UPDATED)).toBe(true);
      } else {
        expect(row.excerpt).toBeNull();
        expect(parsed.updatedLabel).toBe("Last Updated: November 9, 2026");
      }
    }

    expect(rows.about.meta_title).toBe("About Melt Party");
    expect(rows.contact.meta_title).toBe("Contact Melt Party");
    expect(rows.about.content).not.toMatch(/About Melt Party|Fast Shipping|revolutionize/i);
    expect(rows.contact.content).not.toMatch(/\d{3}[-.\s]\d{3}[-.\s]\d{4}/);
    expect(rows["terms-of-service"].content).not.toMatch(/\$(5\.99|7\.95|9\.99|19\.99|75)\b/);
    expect(rows["privacy-policy"].content).not.toMatch(/privacy@|Google Analytics|Facebook|Meta Pixel|DoubleClick/i);
    expect(rows["privacy-policy"].content).toContain("We do not use advertising cookies or third-party analytics cookies.");
    expect(rows["privacy-policy"].content).toContain("We do not sell your personal information.");

    const allPlaceholders = new Set(SLUGS.flatMap((slug) => rows[slug].content.match(PLACEHOLDER) ?? []));
    expect([...allPlaceholders].sort()).toEqual([
      "[COMPANY LEGAL NAME]", "[COMPANY REGISTRATION NUMBER]", "[GOVERNING JURISDICTION]", "[REGISTERED ADDRESS]",
    ]);

    for (const slug of ["about", "privacy-policy", "terms-of-service"] as const) {
      expect(rows[slug].version).toBe(2);
      const versions = await versionsOf(slug);
      expect(versions.map(({ version, change_summary }) => [version, change_summary])).toEqual([
        [1, "Snapshot before FEAT-20261109-01 content rewrite"],
        [2, "FEAT-20261109-01 content"],
      ]);
      expect(versions[1].content).toBe(rows[slug].content);
    }
    expect((await versionsOf("about"))[0].content).toContain("<h1>About Melt Party</h1>");
    expect((await versionsOf("privacy-policy"))[0].content).toContain("<h1>Privacy Policy</h1>");
    expect(rows.contact.version).toBe(1);
    expect((await versionsOf("contact")).map(({ version, change_summary, content }) => [version, change_summary, content]))
      .toEqual([[1, "FEAT-20261109-01 content", rows.contact.content]]);

    expect((await getNavigationPages()).map(({ slug }) => slug)).toEqual(["about", "privacy-policy", "terms-of-service"]);
    await expect(getPageBySlug("contact")).resolves.toMatchObject({ slug: "contact" });
  });

  it("(a) publishes five editable Blog posts across distinct dates", async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const categories = await env.DB.prepare("SELECT name, slug FROM blog_categories ORDER BY slug")
      .all<{ name: string; slug: string }>();
    expect(categories.results).toEqual([
      { name: "Gear Guides", slug: "gear-guides" },
      { name: "Preparedness", slug: "preparedness" },
    ]);

    const posts = await postRows();
    expect(posts.map(({ slug }) => slug)).toEqual(POST_SPEC.map(({ slug }) => slug));
    posts.forEach((post, index) => {
      const spec = POST_SPEC[index];
      expect(post).toMatchObject({
        author: "Melt Party Gear Team", status: "published", editor_json: null,
        category_slug: spec.category, cover_image_url: spec.cover,
        published_at: spec.publishedAt, created_at: spec.publishedAt, updated_at: spec.publishedAt,
      });
      expect(JSON.parse(post.tags)).toEqual(spec.tags);
      expect(calculateBlogReadingTime(post.html)).toBe(post.reading_time);
      expect(normalizeBlogSlug(post.slug)).toBe(post.slug);
      expect(normalizeBlogTags(JSON.parse(post.tags))).toEqual(JSON.parse(post.tags));
      expect(isAllowedImageSource(post.cover_image_url!)).toBe(true);
      expect(post.published_at % 60).toBe(0);
      expect(post.published_at).toBeLessThan(END_OF_NOV_9_2026);
      expect(words(post.html)).toBeGreaterThanOrEqual(800);
      expect(words(post.html)).toBeLessThanOrEqual(1200);
      expect(post.html).not.toMatch(/<h1|<img/i);
      expect(post.html).not.toMatch(PLACEHOLDER);
      for (const field of [post.title, post.html, post.excerpt ?? "", post.meta_title ?? "", post.meta_description ?? ""]) {
        expect(field).not.toMatch(RESIDUE);
      }
      for (const product of spec.products) expect(post.html).toContain(`href="/product/${product}"`);
      expect(post.excerpt!.length).toBeLessThanOrEqual(300);
      expect(post.meta_title!.length).toBeLessThanOrEqual(60);
      expect(post.meta_description!.length).toBeGreaterThanOrEqual(120);
      expect(post.meta_description!.length).toBeLessThanOrEqual(160);
      expect(post.cover_image_alt).toBeTruthy();
    });

    const listed = await getPublishedBlogPosts({ now: END_OF_NOV_9_2026, limit: 100 });
    expect(listed.map(({ slug }) => slug)).toEqual(POST_SPEC.map(({ slug }) => slug));
    for (const post of listed) {
      expect(getRelatedBlogPosts(listed, post.slug, post.tags).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("(c) is a no-op when its statements run again", async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const pagesBefore = JSON.stringify(await pageRows());
    const postsBefore = JSON.stringify(await postRows());
    const counts = async () => Promise.all([
      tableCount("page_versions"), tableCount("blog_posts"), tableCount("blog_categories"),
    ]);
    const countsBefore = await counts();

    await rerun();

    expect(JSON.stringify(await pageRows())).toBe(pagesBefore);
    expect(JSON.stringify(await postRows())).toBe(postsBefore);
    expect(await counts()).toEqual(countsBefore);
  });

  it("survives an unchanged admin page save without a new version", async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const versionCount = await tableCount("page_versions");

    for (const slug of SLUGS) {
      const page = (await getPageById((await pageRows())[slug].id))!;
      const formData = JSON.parse(JSON.stringify(page));
      const saved = await updatePage(page.id, formData, "admin_user");
      expect(saved).toMatchObject({ content: page.content, version: page.version, title: page.title });
    }
    expect(await tableCount("page_versions")).toBe(versionCount);
  });

  it("survives an unchanged admin Blog publish and shows an edited body immediately", async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const saveTime = Date.UTC(2026, 10, 10, 8, 30, 0);
    vi.setSystemTime(new Date(saveTime));

    for (const row of await postRows()) {
      const post = (await adminGetBlogPost(row.id))!;
      const minutePrecisionPublishAt = Math.floor(post.publishedAt! / 60) * 60;
      const saved = await adminUpdateBlogPost(post.id, {
        title: post.title,
        slug: post.slug,
        author: post.author,
        excerpt: post.excerpt || null,
        tags: post.tags.join(", ").split(",").map((tag) => tag.trim()).filter(Boolean),
        coverImageUrl: post.coverImageUrl || null,
        coverImageAlt: post.coverImageAlt || null,
        status: "published",
        categoryId: post.categoryId,
        html: post.html,
        metaTitle: post.metaTitle || null,
        metaDescription: post.metaDescription || null,
        publishedAt: minutePrecisionPublishAt,
        updatedBy: "admin_user",
      });
      expect(saved).toMatchObject({
        title: post.title, slug: post.slug, excerpt: post.excerpt, html: post.html, readingTime: post.readingTime,
        publishedAt: post.publishedAt, tags: post.tags, coverImageUrl: post.coverImageUrl,
        coverImageAlt: post.coverImageAlt, categoryId: post.categoryId, metaTitle: post.metaTitle,
        metaDescription: post.metaDescription, createdAt: post.createdAt,
        updatedAt: saveTime / 1000, updatedBy: "admin_user",
      });
    }

    const [first] = await postRows();
    const editedHtml = first.html.replace("<p>", "<p>Updated for this season. ");
    await adminUpdateBlogPost(first.id, { html: editedHtml });
    await expect(getPublishedBlogPost(first.slug)).resolves.toMatchObject({ html: editedHtml });
  });

});
