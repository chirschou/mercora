#!/usr/bin/env node
/** Prepare only the local D1 database and R2 media used by `npm run dev`; never contacts Cloudflare. */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { migrationArgs, parseWranglerConfig, resolveTarget } from "./lib/d1-migrate-plan.mjs";
import {
  catalogSeedArgs,
  mediaBucket,
  mediaBulkPutArgs,
  planCatalogSeed,
  planSampleMedia,
  productCountArgs,
  sampleMediaDirectories,
} from "./lib/local-sample-plan.mjs";

const DEV_SEED_FILE = "data/d1/seed-dev.sql";

function wrangler(args, stdio = "inherit") {
  const result = spawnSync("npx", ["wrangler", ...args], { stdio, encoding: "utf8" });
  const status = result.status ?? 1;
  if (status !== 0) throw Object.assign(new Error(`wrangler ${args.slice(0, 3).join(" ")} exited with ${status}.`), { status });
  return result.stdout;
}

try {
  const config = parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8"));
  const plan = resolveTarget(config, { target: "local" });
  console.log(`[db:local] Applying local migrations for ${plan.database}...`);
  wrangler(migrationArgs(plan, "apply"));

  const catalog = planCatalogSeed(wrangler(productCountArgs(plan.database), ["ignore", "pipe", "inherit"]));
  if (catalog.action === "import") {
    console.log(`[db:local] Local catalogue is empty; importing the sample catalogue from ${catalog.file}...`);
    wrangler(catalogSeedArgs(plan.database));
  } else {
    console.log(
      `[db:local] Skipping the sample catalogue import: the local products table already has ${catalog.count} row(s). ` +
        "Delete .wrangler/state and run `npm run dev` again to get the complete sample catalogue.",
    );
  }

  console.log(`[db:local] Applying development-only MCP seed from ${DEV_SEED_FILE}...`);
  wrangler(["d1", "execute", plan.database, "--local", "--file", DEV_SEED_FILE]);

  const bucket = mediaBucket(config);
  const listing = Object.fromEntries(
    sampleMediaDirectories().map(({ directory, path: directoryPath }) => [
      directory,
      readdirSync(directoryPath, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name),
    ]),
  );
  const manifestDirectory = mkdtempSync(path.join(tmpdir(), "melt-party-media-"));
  try {
    for (const { contentType, entries } of planSampleMedia(listing)) {
      console.log(`[db:local] Writing ${entries.length} sample image(s) (${contentType}) to local R2 bucket ${bucket}...`);
      const manifest = path.join(manifestDirectory, `${contentType.replace("/", "-")}.json`);
      writeFileSync(manifest, JSON.stringify(entries));
      wrangler(mediaBulkPutArgs(bucket, manifest, contentType));
    }
  } finally {
    rmSync(manifestDirectory, { recursive: true, force: true });
  }
} catch (error) {
  console.error(`[db:local] ABORT: ${error.message}`);
  process.exit(error.status ?? 1);
}
