/**
 * === Cloudflare Image Loader ===
 *
 * Custom Next.js image loader that integrates with Cloudflare's Image
 * Resizing service for optimized image delivery with automatic format
 * conversion and quality adjustments.
 *
 * === Features ===
 * - **Cloudflare Integration**: Uses Cloudflare's image transformation API
 * - **Development Mode**: Same mapping as production; without an image CDN,
 *   bucket media resolves to the same-origin `/media/<key>` route (local R2)
 * - **Auto Format**: Automatically serves WebP/AVIF when supported
 * - **Quality Control**: Configurable image quality with intelligent defaults
 * - **Path Normalization**: Handles relative and absolute path formats
 * - **CDN Optimization**: Leverages Cloudflare's global edge network
 *
 * === Technical Implementation ===
 * - **Environment Detection**: Reads the image CDN and transform flag per call
 * - **URL Construction**: Builds Cloudflare image transformation URLs
 * - **Parameter Encoding**: Properly formats width, quality, and format params
 * - **Source Handling**: Normalizes image paths for consistent processing
 *
 * === Cloudflare Image Parameters ===
 * - **width**: Target image width for responsive sizing
 * - **format=auto**: Automatic format selection (WebP/AVIF/JPEG)
 * - **quality**: Compression quality (1-100, optimized for web delivery)
 *
 * === Usage ===
 * Configured in next.config.ts as the default image loader:
 * ```typescript
 * images: {
 *   loader: 'custom',
 *   loaderFile: './image-loader.ts'
 * }
 * ```
 *
 * === Performance Benefits ===
 * - Automatic format optimization reduces file sizes by 30-50%
 * - Edge caching provides sub-50ms image delivery globally
 * - Dynamic resizing eliminates need for multiple image variants
 * - Progressive JPEG/WebP loading improves perceived performance
 */

// image-loader.ts
import type { ImageLoaderProps } from "next/image";

/**
 * Normalize image source path by removing leading slash
 * 
 * @param src - Image source path (absolute or relative)
 * @returns Normalized path without leading slash
 */
/**
 * Paths the application serves from its own `public/` directory.
 *
 * Every other local path is rewritten to the image bucket, which does not hold
 * these files — a rewrite would point the browser at a 404 even though the
 * asset ships with the deployment.
 */
const LOCAL_ASSET_PREFIXES = ["/placeholder", "/logo", "/volt"];

function isLocalAsset(src: string) {
  return LOCAL_ASSET_PREFIXES.some((prefix) => src.startsWith(prefix));
}

function imageCdn() {
  const value = process.env.NEXT_PUBLIC_IMAGE_CDN?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function toObjectKey(src: string, cdn: string | undefined) {
  if (cdn && src.startsWith(cdn)) return src.slice(cdn.length).replace(/^\//, "");
  if (/^https?:\/\//.test(src)) return null;
  return src.replace(/^\//, "");
}

/**
 * Cloudflare image loader for Next.js Image component
 * 
 * @param src - Image source URL or path
 * @param width - Target width for responsive images
 * @param quality - Optional image quality (1-100)
 * @returns Cloudflare image URL, same-origin media URL, or the original src
 */
export default function cloudflareLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  // Read public configuration at invocation time. Import-time environment reads
  // can capture a different build's configuration.
  if (isLocalAsset(src)) return src;
  const cdn = imageCdn();
  const key = toObjectKey(src, cdn);
  if (key === null) return src;
  if (!cdn) return `/media/${key}`;
  const transformsEnabled =
    process.env.NEXT_PUBLIC_IMAGE_TRANSFORMS?.trim().toLowerCase() !== "false";
  if (!transformsEnabled) return `${cdn}/${key}`;

  const params = [`width=${width}`, "format=auto"];
  if (quality) params.push(`quality=${quality}`);
  return `${cdn}/cdn-cgi/image/${params.join(",")}/${key}`;
}
