/** Pure, testable planning helpers for the sample catalogue and media that `npm run dev` loads locally. */

export const CATALOG_SEED_FILE = "data/d1/seed.sql";
export const PRODUCT_COUNT_SQL = "SELECT COUNT(*) AS count FROM products";

const SAMPLE_MEDIA_ROOT = "data/r2";
const SAMPLE_MEDIA_DIRECTORIES = ["products", "categories"];

/** Must match app/media/[...key]/route.ts: the route 404s any object whose declared type disagrees. */
export const CONTENT_TYPES_BY_EXTENSION = Object.freeze({
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
});

export function productCountArgs(database) {
  return ["d1", "execute", database, "--local", "--json", "--command", PRODUCT_COUNT_SQL];
}

export function catalogSeedArgs(database) {
  return ["d1", "execute", database, "--local", "--file", CATALOG_SEED_FILE];
}

/** The seed is plain INSERTs, so it runs only into an empty catalogue; unreadable output never counts as empty. */
export function planCatalogSeed(output) {
  let parsed;
  try {
    parsed = JSON.parse(String(output ?? ""));
  } catch {
    throw new Error(`Could not read the local product count from wrangler output: ${String(output ?? "").trim() || "(empty)"}`);
  }
  const count = parsed?.[0]?.results?.[0]?.count;
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Unexpected local product count in wrangler output: ${JSON.stringify(parsed)}`);
  }
  return count === 0 ? { action: "import", file: CATALOG_SEED_FILE } : { action: "skip", count };
}

export function mediaBucket(config) {
  const bucket = config.r2_buckets?.find((candidate) => candidate.binding === "MEDIA");
  if (!bucket?.bucket_name) throw new Error("No R2 bucket is configured for the MEDIA binding.");
  return bucket.bucket_name;
}

/** `listing` maps each sample directory to the file names inside it. */
export function planSampleMedia(listing) {
  const groups = new Map();
  for (const directory of SAMPLE_MEDIA_DIRECTORIES) {
    for (const name of listing[directory] ?? []) {
      const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
      const contentType = CONTENT_TYPES_BY_EXTENSION[extension];
      if (!contentType) continue;
      const entries = groups.get(contentType) ?? [];
      entries.push({ key: `${directory}/${name}`, file: `${SAMPLE_MEDIA_ROOT}/${directory}/${name}` });
      groups.set(contentType, entries);
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([contentType, entries]) => ({
      contentType,
      entries: entries.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)),
    }));
}

export function sampleMediaDirectories() {
  return SAMPLE_MEDIA_DIRECTORIES.map((directory) => ({ directory, path: `${SAMPLE_MEDIA_ROOT}/${directory}` }));
}

export function mediaBulkPutArgs(bucket, manifestPath, contentType) {
  return ["r2", "bulk", "put", bucket, "--local", "--filename", manifestPath, "--content-type", contentType];
}
