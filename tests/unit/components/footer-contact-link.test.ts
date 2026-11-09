import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getNavigationPages: vi.fn(),
  getPageBySlug: vi.fn(),
  getSocialMediaSettings: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("@/lib/models/pages", () => ({
  getNavigationPages: mocks.getNavigationPages,
  getPageBySlug: mocks.getPageBySlug,
}));

vi.mock("@/lib/utils/settings", () => ({
  getSocialMediaSettings: mocks.getSocialMediaSettings,
}));

vi.mock("@/lib/store-config", () => ({
  getStoreConfig: () => ({
    identity: { name: "Melt Party" },
    contact: { supportEmail: "support@melt.party" },
    urls: { returns: "/returns", privacy: "/privacy-policy", terms: "/terms-of-service" },
  }),
}));

import Footer from "@/components/Footer";

const navigationPages = [
  { id: 1, slug: "about", title: "About Us", nav_title: null },
  { id: 2, slug: "privacy-policy", title: "Privacy Policy", nav_title: null },
  { id: 3, slug: "terms-of-service", title: "Terms of Service", nav_title: null },
];

async function contactSupportHref(): Promise<string | undefined> {
  const html = renderToStaticMarkup(await Footer());
  return html.match(/<a[^>]*href="([^"]*)"[^>]*>Contact support<\/a>/)?.[1];
}

beforeEach(() => {
  mocks.getNavigationPages.mockResolvedValue(navigationPages);
  mocks.getSocialMediaSettings.mockResolvedValue({});
});

describe("Footer Contact support link", () => {
  it("should_link_to_contact_page_when_published_contact_page_exists", async () => {
    mocks.getPageBySlug.mockResolvedValue({ id: 4, slug: "contact", title: "Contact Us" });

    await expect(contactSupportHref()).resolves.toBe("/contact");
    expect(mocks.getPageBySlug).toHaveBeenCalledWith("contact");
  });

  it("should_fall_back_to_mailto_when_contact_page_is_missing", async () => {
    mocks.getPageBySlug.mockResolvedValue(null);

    await expect(contactSupportHref()).resolves.toBe("mailto:support@melt.party");
  });

  it("should_fall_back_to_mailto_when_contact_page_query_fails", async () => {
    mocks.getPageBySlug.mockRejectedValue(new Error("D1 unavailable"));

    await expect(contactSupportHref()).resolves.toBe("mailto:support@melt.party");
  });

  it("should_keep_contact_out_of_explore_and_policy_links_on_shared_urls", async () => {
    mocks.getPageBySlug.mockResolvedValue({ id: 4, slug: "contact", title: "Contact Us" });

    const html = renderToStaticMarkup(await Footer());
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);

    expect(hrefs).toEqual([
      "/about", "/privacy-policy", "/terms-of-service", "/blog",
      "/contact", "/privacy-policy", "/terms-of-service",
    ]);
  });
});
