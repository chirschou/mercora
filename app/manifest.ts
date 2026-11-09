import type { MetadataRoute } from "next";
import { getStoreConfig } from "@/lib/store-config";
import { getThemeTokens } from "@/lib/themes/tokens";

export const dynamic = "force-dynamic";

// 图标是 glacier-night 品牌资产，manifest 颜色固定跟随该主题而非当前激活主题，保证启动画面与图标底色一致。
const BRAND_THEME = "glacier-night";

export default function manifest(): MetadataRoute.Manifest {
  const { identity } = getStoreConfig();
  const { surface } = getThemeTokens(BRAND_THEME);

  return {
    name: identity.name,
    short_name: identity.name,
    description: identity.description,
    start_url: "/",
    display: "standalone",
    background_color: surface,
    theme_color: surface,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
