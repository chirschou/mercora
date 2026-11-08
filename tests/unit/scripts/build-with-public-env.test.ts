import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runBuildWrapper(extraEnv: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };
  if (!("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" in extraEnv)) delete env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return spawnSync(process.execPath, ["scripts/build-with-public-env.mjs", process.execPath, "-e", "0"], {
    env,
    encoding: "utf8",
  });
}

describe("build-with-public-env", () => {
  it("should_abort_when_clerk_publishable_key_is_missing", () => {
    const result = runBuildWrapper({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
  });

  it("should_abort_when_clerk_publishable_key_is_blank", () => {
    const result = runBuildWrapper({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "  " });
    expect(result.status).toBe(1);
  });

  it("should_run_command_when_clerk_publishable_key_is_provided_by_environment", () => {
    const result = runBuildWrapper({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder" });
    expect(result.status).toBe(0);
  });
});
