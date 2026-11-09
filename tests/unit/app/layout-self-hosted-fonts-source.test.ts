import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FIX-20261109-02：构建期从 Google Fonts 拉字体会随机失败（返回无扩展名的
 * /l/font?kit= 地址，next/font/google 的加载器直接报错）。字体改为随仓库提交、
 * 由 next/font/local 加载后，构建不得再访问 fonts.googleapis.com / fonts.gstatic.com。
 * 本测试锁定源码契约：不再引用 next/font/google，每个字体文件存在且为 woff2，
 * 并随附对应的 SIL OFL 许可文本。
 */

const root = process.cwd();
const layoutSource = readFileSync(join(root, "app/layout.tsx"), "utf8");

const expectedFonts: Record<string, { variable: string; license: string; weights: string[] }> = {
  "geist-latin.woff2": { variable: "--font-geist-sans", license: "OFL-geist.txt", weights: ["400", "500", "600"] },
  "geist-mono-latin.woff2": { variable: "--font-geist-mono", license: "OFL-geist-mono.txt", weights: ["400"] },
  "cormorant-garamond-latin.woff2": {
    variable: "--font-cormorant-garamond",
    license: "OFL-cormorant-garamond.txt",
    weights: ["400", "500", "600", "700"],
  },
  "orbitron-latin.woff2": { variable: "--font-orbitron", license: "OFL-orbitron.txt", weights: ["600", "700", "800"] },
  "fraunces-latin.woff2": { variable: "--font-fraunces", license: "OFL-fraunces.txt", weights: ["500", "600", "700", "800"] },
  "nunito-latin.woff2": { variable: "--font-nunito", license: "OFL-nunito.txt", weights: ["600", "700", "800"] },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs|cjs|css)$/.test(name) ? [path] : [];
  });
}

function localFontCall(variable: string): string {
  const variableIndex = layoutSource.indexOf(`variable: "${variable}"`);
  expect(variableIndex, `expected a font loader declaring ${variable}`).toBeGreaterThan(-1);
  const callStart = layoutSource.lastIndexOf("localFont({", variableIndex);
  expect(callStart, `expected ${variable} to be declared by localFont()`).toBeGreaterThan(-1);
  return layoutSource.slice(callStart, layoutSource.indexOf("\n});", variableIndex));
}

describe("app/layout.tsx — self-hosted fonts", () => {
  it("never imports next/font/google anywhere in app, components or lib", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(join(root, dir)))
      .filter((file) => /next\/font\/google|fonts\.(googleapis|gstatic)\.com/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file));
    expect(offenders).toEqual([]);
  });

  it("loads every font through next/font/local", () => {
    expect(layoutSource).toContain('import localFont from "next/font/local";');
  });

  it.each(Object.entries(expectedFonts))("declares %s with its CSS variable and weights", (file, { variable, weights }) => {
    const call = localFontCall(variable);
    const declaredWeights = [...call.matchAll(/\{ path: "\.\/fonts\/([^"]+)", weight: "(\d+)" \}/g)].map(
      ([, path, weight]) => {
        expect(path).toBe(file);
        return weight;
      },
    );
    expect(declaredWeights).toEqual(weights);
    expect(call).toContain('display: "swap"');
    expect(call).toContain("preload: false");
    expect(call).toContain('prop: "unicode-range", value: "U+0000-00FF,');
  });

  it("only references font files that exist as woff2 with an OFL licence alongside", () => {
    const referenced = new Set([...layoutSource.matchAll(/path: "\.\/fonts\/([^"]+)"/g)].map(([, path]) => path));
    expect([...referenced].sort()).toEqual(Object.keys(expectedFonts).sort());
    for (const file of referenced) {
      const fontPath = join(root, "app/fonts", file);
      expect(existsSync(fontPath), `${file} must be committed under app/fonts`).toBe(true);
      expect(readFileSync(fontPath).subarray(0, 4).toString("latin1"), `${file} must be woff2`).toBe("wOF2");

      const licensePath = join(root, "app/fonts", expectedFonts[file].license);
      expect(existsSync(licensePath), `${expectedFonts[file].license} must accompany ${file}`).toBe(true);
      expect(readFileSync(licensePath, "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
  });
});
