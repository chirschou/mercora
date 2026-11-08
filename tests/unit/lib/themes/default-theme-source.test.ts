import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";

/**
 * `next dev` 不注入 wrangler.jsonc 的 vars，本地默认主题取 manifest 常量；
 * 部署后取 NEXT_PUBLIC_THEME_DEFAULT。两处只改一处，本地与线上的默认主题就会分叉。
 */
function deployedThemeDefaults(): string[] {
  const config = readFileSync(resolve("wrangler.jsonc"), "utf8");
  return [...config.matchAll(/"NEXT_PUBLIC_THEME_DEFAULT"\s*:\s*"([^"]*)"/g)].map((match) => match[1]);
}

describe("default theme source contract", () => {
  it("deploys the same default theme that the manifest falls back to", () => {
    expect(deployedThemeDefaults()).toEqual([DEFAULT_THEME_NAME]);
  });

  it("names a theme that the manifest actually ships", () => {
    expect(THEME_MANIFEST.map((theme) => theme.name)).toContain(DEFAULT_THEME_NAME);
  });
});
