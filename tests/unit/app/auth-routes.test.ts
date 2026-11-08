import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FIX-20261108-04：middleware、app/account/* 与受保护 CMS 页都把未登录访客
 * 重定向到 /sign-in?redirect_url=…，这些路由必须真实存在、对访客公开，
 * 并且在维护模式下仍可达（否则维护期管理员无法登录）。
 */
const mocks = vi.hoisted(() => ({
  maintenance: false,
  clerkProps: [] as Array<{ component: string; props: Record<string, unknown> }>,
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: unknown) => handler,
}));
vi.mock("@clerk/nextjs", async () => {
  const { createElement } = await import("react");
  const stub = (component: string) => (props: Record<string, unknown>) => {
    mocks.clerkProps.push({ component, props });
    return createElement("clerk-" + component);
  };
  return { SignIn: stub("sign-in"), SignUp: stub("sign-up") };
});
vi.mock("@/lib/utils/settings", () => ({
  getSettings: vi.fn(async () => ({ "system.maintenance_mode": mocks.maintenance })),
}));
vi.mock("@/lib/db", () => ({
  getDbAsync: vi.fn(async () => ({})),
}));
vi.mock("@/lib/store-config", () => ({
  getStoreConfig: () => ({ identity: { name: "Test Store" } }),
}));

import middlewareImport from "@/middleware";
import { NextRequest, NextResponse } from "next/server";

const middleware = middlewareImport as unknown as (
  auth: unknown,
  req: NextRequest
) => Promise<NextResponse>;
const anonymous = async () => ({ userId: null });
const root = process.cwd();

beforeEach(() => {
  mocks.maintenance = false;
  mocks.clerkProps = [];
});

describe("auth routes exist for every sign-in redirect target", () => {
  it.each([
    ["sign-in", "app/sign-in/[[...sign-in]]/page.tsx"],
    ["sign-up", "app/sign-up/[[...sign-up]]/page.tsx"],
  ])("/%s has an optional catch-all App Router page", (_name, file) => {
    expect(existsSync(join(root, file)), file).toBe(true);
  });

  it("renders Clerk <SignIn /> with path routing and the caller's redirect_url left in charge", async () => {
    const { default: SignInPage } = await import("@/app/sign-in/[[...sign-in]]/page");
    const html = renderToStaticMarkup(React.createElement(SignInPage));
    expect(html).toContain("<clerk-sign-in>");
    const [{ props }] = mocks.clerkProps;
    expect(props.routing ?? "path").toBe("path");
    expect(props.forceRedirectUrl).toBeUndefined();
    expect(props.signInForceRedirectUrl).toBeUndefined();
  });

  it("renders Clerk <SignUp /> with path routing so invitation tickets reach it untouched", async () => {
    const { default: SignUpPage } = await import("@/app/sign-up/[[...sign-up]]/page");
    const html = renderToStaticMarkup(React.createElement(SignUpPage));
    expect(html).toContain("<clerk-sign-up>");
    const [{ props }] = mocks.clerkProps;
    expect(props.routing ?? "path").toBe("path");
    expect(props.forceRedirectUrl).toBeUndefined();
    expect(props.signUpForceRedirectUrl).toBeUndefined();
  });

  it("points ClerkProvider at the in-app sign-in and sign-up routes", () => {
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/signInUrl="\/sign-in"/);
    expect(layout).toMatch(/signUpUrl="\/sign-up"/);
  });
});

describe("middleware treats auth routes as public", () => {
  it.each([
    "http://localhost/sign-in?redirect_url=%2Fadmin%2Fgift-cards",
    "http://localhost/sign-in/factor-one",
    "http://localhost/sign-up?__clerk_ticket=ticket_123&__clerk_status=sign_up",
  ])("lets an anonymous visitor through to %s without redirecting", async (url) => {
    const response = await middleware(anonymous, new NextRequest(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    "http://localhost/sign-in?redirect_url=%2Fadmin",
    "http://localhost/sign-in/sso-callback",
    "http://localhost/sign-up",
    "http://localhost/sign-up/continue",
  ])("keeps %s reachable while maintenance mode is on", async (url) => {
    mocks.maintenance = true;
    const response = await middleware(anonymous, new NextRequest(url));
    expect(response.status).toBe(200);
  });

  it("still serves the maintenance page to the storefront and look-alike paths", async () => {
    mocks.maintenance = true;
    for (const url of ["http://localhost/", "http://localhost/sign-in-offers"]) {
      const response = await middleware(anonymous, new NextRequest(url));
      expect(response.status, url).toBe(503);
    }
  });
});
