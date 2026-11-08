import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOG_SEED_FILE,
  CONTENT_TYPES_BY_EXTENSION,
  catalogSeedArgs,
  mediaBucket,
  mediaBulkPutArgs,
  planCatalogSeed,
  planSampleMedia,
  productCountArgs,
} from "@/scripts/lib/local-sample-plan.mjs";

function countOutput(count: unknown) {
  return JSON.stringify([{ results: [{ count }], success: true, meta: {} }]);
}

describe("local sample catalogue plan", () => {
  it("imports the sample catalogue into an empty products table", () => {
    expect(planCatalogSeed(countOutput(0))).toEqual({ action: "import", file: "data/d1/seed.sql" });
  });

  it("skips the import once any product exists, reporting how many", () => {
    expect(planCatalogSeed(countOutput(1))).toEqual({ action: "skip", count: 1 });
    expect(planCatalogSeed(countOutput(33))).toEqual({ action: "skip", count: 33 });
  });

  it.each([
    ["empty output", ""],
    ["non-JSON output", "✘ [ERROR] no such table: products"],
    ["no result set", JSON.stringify([])],
    ["no rows", JSON.stringify([{ results: [] }])],
    ["a missing count", JSON.stringify([{ results: [{}] }])],
    ["a string count", countOutput("0")],
    ["a negative count", countOutput(-1)],
    ["a fractional count", countOutput(0.5)],
  ])("refuses to import on %s instead of guessing", (_label, output) => {
    expect(() => planCatalogSeed(output)).toThrow(/product count/i);
  });

  it("builds every D1 command against local storage only", () => {
    for (const args of [productCountArgs("store-db"), catalogSeedArgs("store-db")]) {
      expect(args.slice(0, 3)).toEqual(["d1", "execute", "store-db"]);
      expect(args).toContain("--local");
      expect(args).not.toContain("--remote");
    }
    expect(productCountArgs("store-db")).toContain("--json");
    expect(catalogSeedArgs("store-db")).toEqual(["d1", "execute", "store-db", "--local", "--file", CATALOG_SEED_FILE]);
  });
});

describe("local sample media plan", () => {
  it("reads the bucket name from the MEDIA binding", () => {
    expect(
      mediaBucket({
        r2_buckets: [
          { binding: "NEXT_INC_CACHE_R2_BUCKET", bucket_name: "cache-bucket" },
          { binding: "MEDIA", bucket_name: "media-bucket" },
        ],
      }),
    ).toBe("media-bucket");
  });

  it("fails closed when no MEDIA bucket is configured", () => {
    expect(() => mediaBucket({ r2_buckets: [{ binding: "OTHER", bucket_name: "x" }] })).toThrow(/MEDIA/);
    expect(() => mediaBucket({})).toThrow(/MEDIA/);
  });

  it("keys every sample file as <directory>/<file name>, grouped by its declared Content-Type", () => {
    const plan = planSampleMedia({
      products: ["b.png", "a.PNG", "c.jpg"],
      categories: ["camping.png"],
    });

    expect(plan).toEqual([
      {
        contentType: "image/jpeg",
        entries: [{ key: "products/c.jpg", file: "data/r2/products/c.jpg" }],
      },
      {
        contentType: "image/png",
        entries: [
          { key: "categories/camping.png", file: "data/r2/categories/camping.png" },
          { key: "products/a.PNG", file: "data/r2/products/a.PNG" },
          { key: "products/b.png", file: "data/r2/products/b.png" },
        ],
      },
    ]);
  });

  it("leaves out files the media route would refuse to serve", () => {
    const plan = planSampleMedia({ products: ["notes.md", "README", ".DS_Store", "x.svg"], categories: [] });
    expect(plan).toEqual([]);
  });

  it("ignores directories outside the public sample set", () => {
    const plan = planSampleMedia({ products: [], categories: [], products_md: ["a.png"] } as never);
    expect(plan).toEqual([]);
  });

  it("writes media to local storage only, with an explicit Content-Type", () => {
    const args = mediaBulkPutArgs("media-bucket", "/tmp/manifest.json", "image/png");
    expect(args).toEqual([
      "r2",
      "bulk",
      "put",
      "media-bucket",
      "--local",
      "--filename",
      "/tmp/manifest.json",
      "--content-type",
      "image/png",
    ]);
    expect(args).not.toContain("--remote");
  });

  it("declares exactly the Content-Types the /media route verifies", () => {
    const route = readFileSync(path.resolve(__dirname, "../../../app/media/[...key]/route.ts"), "utf8");
    const block = route.match(/CONTENT_TYPES_BY_EXTENSION[^{]*\{([^}]*)\}/)?.[1] ?? "";
    const routeTypes = Object.fromEntries(
      [...block.matchAll(/(\w+):\s*"([^"]+)"/g)].map(([, extension, type]) => [extension, type]),
    );

    expect(Object.keys(routeTypes).length).toBeGreaterThan(0);
    expect(CONTENT_TYPES_BY_EXTENSION).toEqual(routeTypes);
  });
});
