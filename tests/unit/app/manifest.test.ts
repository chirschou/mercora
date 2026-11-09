import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getStoreConfig: vi.fn() }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.getStoreConfig }));

import manifest from "@/app/manifest";
import { getThemeTokens } from "@/lib/themes/tokens";

describe("web app manifest", () => {
  it("should_use_store_identity_and_glacier_night_surface_when_generated", () => {
    mocks.getStoreConfig.mockReturnValue({ identity: { name: "Acme Outfitters", description: "Gear for cold places." } });

    const result = manifest();

    const surface = getThemeTokens("glacier-night").surface;
    expect(result).toMatchObject({
      name: "Acme Outfitters",
      short_name: "Acme Outfitters",
      description: "Gear for cold places.",
      start_url: "/",
      display: "standalone",
      background_color: surface,
      theme_color: surface,
    });
  });

  it("should_list_any_and_maskable_icons_when_generated", () => {
    mocks.getStoreConfig.mockReturnValue({ identity: { name: "Melt Party", description: "" } });

    const icons = manifest().icons ?? [];

    expect(icons.map((icon) => [icon.src, icon.sizes, icon.purpose])).toEqual([
      ["/icons/icon-192.png", "192x192", "any"],
      ["/icons/icon-512.png", "512x512", "any"],
      ["/icons/maskable-512.png", "512x512", "maskable"],
    ]);
  });
});
