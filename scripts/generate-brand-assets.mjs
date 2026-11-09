#!/usr/bin/env node
/**
 * 由几何定义生成 Melt Party 品牌资产（SVG 源文件 + 全部栅格图标）。
 *
 * 用法：
 *   node scripts/generate-brand-assets.mjs                 生成并写入仓库
 *   node scripts/generate-brand-assets.mjs --preview <dir> 另把各尺寸预览拼图写到 <dir>
 *
 * 图形标与字标全部由下方坐标计算成填充路径，不依赖字体、不含 <text>/<image>，
 * 所以 SVG 在任何渲染器里结果一致；栅格图用 sharp（libvips/librsvg）从这些 SVG 渲染。
 * 改设计只改本文件的几何常量后重跑，生成物一并提交。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();

// glacier-night 品牌色（与 themes/glacier-night.css 的 surface / primary / ring / foreground 一致）
const INK = "#0b1117";
const ICE = "#4fd6e8";
const SIGNAL = "#c8ff3d";
const SNOW = "#e6eef3";

const fmt = (n) => Number(n.toFixed(2)).toString();
const poly = (pts) => `M${pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}Z`;

// ---------- 图形标：不对称双峰山脊构成的 M + 山谷下方的一滴融水 ----------

function intersect([p, d], [q, e]) {
  const det = d[0] * e[1] - d[1] * e[0];
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / det;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

/** 折线按宽度 w 外扩成填充多边形的顶点：转角斜接（尖峰），两端按水平线截平。 */
function strokePolyline(points, w) {
  const segs = points.slice(1).map((b, i) => {
    const a = points[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const n = [-d[1] * (w / 2), d[0] * (w / 2)];
    return { a, d, n };
  });
  const side = (sign) => {
    const lines = segs.map(({ a, d, n }) => [[a[0] + sign * n[0], a[1] + sign * n[1]], d]);
    const first = points[0];
    const last = points[points.length - 1];
    const out = [intersect(lines[0], [first, [1, 0]])];
    for (let i = 1; i < lines.length; i += 1) out.push(intersect(lines[i - 1], lines[i]));
    out.push(intersect(lines[lines.length - 1], [last, [1, 0]]));
    return out;
  };
  return [...side(1), ...side(-1).reverse()];
}

const DROP_K = 1.85;

/** 尖端朝上的水滴：圆心 (cx, cy)、半径 r，尖端距圆心 r*DROP_K。 */
function dropPath(cx, cy, r) {
  const tipY = cy - r * DROP_K;
  const a = Math.asin(1 / DROP_K);
  const dx = r * Math.cos(a);
  const dy = r * Math.sin(a);
  return `M${fmt(cx)} ${fmt(tipY)}L${fmt(cx + dx)} ${fmt(cy - dy)}A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx - dx)} ${fmt(cy - dy)}Z`;
}

// 图形标母版（512 网格）：左峰高、右峰低的不对称山脊连成 M，山谷正下方悬一滴融水。
const RIDGE = [[96, 392], [190, 124], [262, 228], [342, 158], [416, 392]];
const RIDGE_WIDTH = 62;
const DROP = { cx: 262, cy: 382, r: 36 };

const RIDGE_OUTLINE = strokePolyline(RIDGE, RIDGE_WIDTH);
const GLYPH_BOX = (() => {
  const xs = [...RIDGE_OUTLINE.map((p) => p[0]), DROP.cx - DROP.r, DROP.cx + DROP.r];
  const ys = [...RIDGE_OUTLINE.map((p) => p[1]), DROP.cy - DROP.r * DROP_K, DROP.cy + DROP.r];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
})();

/** 按缩放 s、平移 (tx, ty) 输出图形标的两条路径。 */
function glyph({ s = 1, tx = 0, ty = 0, ridge = ICE, drop = SIGNAL } = {}) {
  const T = ([x, y]) => [tx + x * s, ty + y * s];
  return (
    `<path fill="${ridge}" d="${poly(RIDGE_OUTLINE.map(T))}"/>` +
    `<path fill="${drop}" d="${dropPath(tx + DROP.cx * s, ty + DROP.cy * s, DROP.r * s)}"/>`
  );
}

/** 把图形标放进边长 size 的正方形，外框最长边占 fill 比例并居中。 */
function fittedGlyph(size, fill, colors) {
  const w = GLYPH_BOX.x1 - GLYPH_BOX.x0;
  const h = GLYPH_BOX.y1 - GLYPH_BOX.y0;
  const s = (size * fill) / Math.max(w, h);
  const tx = (size - w * s) / 2 - GLYPH_BOX.x0 * s;
  const ty = (size - h * s) / 2 - GLYPH_BOX.y0 * s;
  return glyph({ s, tx, ty, ...colors });
}

const svgDoc = (w, h, body, label = "Melt Party") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`;

const tile = (size, radius) => `<rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/>`;

const markTile = () => svgDoc(512, 512, tile(512, 112) + fittedGlyph(512, 0.72));
// 16/32px 专用：圆角更小、图形更满，保证小尺寸下山谷与水滴之间仍留出像素缝
const markTileSmall = () => svgDoc(512, 512, tile(512, 96) + fittedGlyph(512, 0.84));
const markTransparent = () => svgDoc(512, 512, fittedGlyph(512, 0.86));

// ---------- 字标：几何无衬线大写「MELT PARTY」，笔画全部是填充路径 ----------

const CAP = 100;
const STEM = 17;

const rect = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
/** 从 (x1,y1) 到 (x2,y2) 的斜笔画，两端水平截平，水平宽度按笔画粗细换算。 */
function diag(x1, y1, x2, y2) {
  const sin = Math.abs(y2 - y1) / Math.hypot(x2 - x1, y2 - y1);
  const hw = STEM / (2 * sin);
  return poly([[x1 - hw, y1], [x1 + hw, y1], [x2 + hw, y2], [x2 - hw, y2]]);
}
/** P/R 的上半碗：外轮廓与内腔用 evenodd 挖空。 */
function bowl(x, w, h) {
  const r = h / 2;
  const xb = x + w - r;
  const ri = r - STEM;
  return (
    `M${fmt(x)} 0H${fmt(xb)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(xb)} ${fmt(h)}H${fmt(x)}Z` +
    `M${fmt(x + STEM)} ${fmt(STEM)}V${fmt(h - STEM)}H${fmt(xb)}A${fmt(ri)} ${fmt(ri)} 0 0 0 ${fmt(xb)} ${fmt(STEM)}Z`
  );
}

const LETTERS = {
  M: {
    w: 98,
    d: (x) => {
      const hw = STEM / 2;
      return [rect(x, 0, STEM, CAP), rect(x + 98 - STEM, 0, STEM, CAP), diag(x + hw + 2, 0, x + 49, 68), diag(x + 98 - hw - 2, 0, x + 49, 68)];
    },
  },
  E: { w: 58, d: (x) => [rect(x, 0, STEM, CAP), rect(x, 0, 58, STEM), rect(x, (CAP - STEM) / 2, 52, STEM), rect(x, CAP - STEM, 58, STEM)] },
  L: { w: 54, d: (x) => [rect(x, 0, STEM, CAP), rect(x, CAP - STEM, 54, STEM)] },
  T: { w: 64, d: (x) => [rect(x, 0, 64, STEM), rect(x + (64 - STEM) / 2, 0, STEM, CAP)] },
  P: { w: 64, d: (x) => [rect(x, 0, STEM, CAP), { evenodd: bowl(x, 64, 60) }] },
  A: {
    w: 82,
    d: (x) => {
      const hw = STEM / (2 * (CAP / Math.hypot(41 - 9, CAP)));
      const yBar = 64;
      const cxAt = (y) => x + 41 + (hw - 41) * (y / CAP);
      const left = cxAt(yBar + STEM / 2);
      return [diag(x + 41, 0, x + hw, CAP), diag(x + 41, 0, x + 82 - hw, CAP), rect(left, yBar, x + 82 - left - (left - x), STEM)];
    },
  },
  R: {
    w: 68,
    d: (x) => [rect(x, 0, STEM, CAP), { evenodd: bowl(x, 64, 60) }, diag(x + 34, 52, x + 68 - 10, CAP)],
  },
  Y: {
    w: 78,
    d: (x) => {
      const hw = STEM / 2;
      return [diag(x + hw + 2, 0, x + 39, 58), diag(x + 78 - hw - 2, 0, x + 39, 58), rect(x + 39 - STEM / 2, 52, STEM, CAP - 52)];
    },
  },
};

const TRACK = 16;
const SPACE = 40;
// 视觉字距修正：开口字母相邻时收紧
const KERN = { LT: -14, TY: -10, PA: -6, AR: -2, RT: -6 };

/** 返回字标路径（基线 y=CAP）与总宽度。 */
function wordmark(text, color) {
  let x = 0;
  let prev = "";
  const plain = [];
  const evenodd = [];
  for (const ch of text) {
    if (ch === " ") {
      x += SPACE;
      prev = "";
      continue;
    }
    x += KERN[prev + ch] ?? 0;
    prev = ch;
    const letter = LETTERS[ch];
    for (const part of letter.d(x)) (typeof part === "string" ? plain : evenodd).push(typeof part === "string" ? part : part.evenodd);
    x += letter.w + TRACK;
  }
  const width = x - TRACK;
  const body =
    `<path fill="${color}" d="${plain.join("")}"/>` +
    evenodd.map((d) => `<path fill="${color}" fill-rule="evenodd" d="${d}"/>`).join("");
  return { body, width };
}

/** 横版组合标：图形标 + 字标，字标高度为图形标的 0.42。 */
function lockup({ dark }) {
  const markSize = 240;
  const textScale = (markSize * 0.42) / CAP;
  const gap = 64;
  const pad = dark ? 72 : 0;
  const word = wordmark("MELT PARTY", dark ? SNOW : INK);
  const w = Math.round(pad * 2 + markSize + gap + word.width * textScale);
  const h = pad * 2 + markSize;
  const mark = dark
    ? `<g transform="translate(${pad} ${pad})">${fittedGlyph(markSize, 0.94)}</g>`
    : `<g transform="translate(${pad} ${pad})">${tile(markSize, 52)}${fittedGlyph(markSize, 0.72)}</g>`;
  const textY = pad + (markSize - CAP * textScale) / 2;
  const text = `<g transform="translate(${pad + markSize + gap} ${fmt(textY)}) scale(${fmt(textScale)})">${word.body}</g>`;
  const bg = dark ? `<rect width="${w}" height="${h}" rx="40" fill="${INK}"/>` : "";
  return svgDoc(w, h, bg + mark + text);
}

// ---------- 分享图 1200×630 ----------

function socialCard() {
  const W = 1200;
  const H = 630;
  const markSize = 220;
  const word = wordmark("MELT PARTY", SNOW);
  const textScale = 96 / CAP;
  const gap = 56;
  const total = markSize + gap + word.width * textScale;
  const x0 = (W - total) / 2;
  const y0 = (H - markSize) / 2 - 36;
  // 背景远山轮廓线：与图形标同一斜率语言，低对比度只作氛围
  const ridgeLine = `<path d="M0 560L170 498L290 528L460 466L600 520L760 478L900 530L1040 488L1200 532V630H0Z" fill="#101a23"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${INK}"/>${ridgeLine}` +
    `<g transform="translate(${fmt(x0)} ${fmt(y0)})">${fittedGlyph(markSize, 0.94)}</g>` +
    `<g transform="translate(${fmt(x0 + markSize + gap)} ${fmt(y0 + (markSize - 96) / 2)}) scale(${fmt(textScale)})">${word.body}</g>` +
    `<rect x="${fmt(x0 + markSize + gap)}" y="${fmt(y0 + markSize / 2 + 48 + 28)}" width="120" height="8" fill="${SIGNAL}"/>` +
    `</svg>`
  );
}

// ---------- 栅格化 ----------

const sized = (svg, w, h = w) => svg.replace("<svg ", `<svg width="${w}" height="${h}" `);
const png = (svg, w, h = w) => sharp(Buffer.from(sized(svg, w, h))).png({ compressionLevel: 9 }).toBuffer();

/** 32 位 PNG 条目组成的 ICO（现代浏览器均支持 PNG 内嵌的 ICO）。 */
function ico(entries) {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...entries.map((e) => e.data)]);
}

const fullBleed = (size, fill) => svgDoc(size, size, `<rect width="${size}" height="${size}" fill="${INK}"/>` + fittedGlyph(size, fill));

async function main() {
  const previewIdx = process.argv.indexOf("--preview");
  const previewDir = previewIdx > -1 ? process.argv[previewIdx + 1] : null;

  const write = (rel, data) => {
    const abs = path.join(ROOT, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, data);
    return rel;
  };

  const svgs = {
    "public/brand/mark.svg": markTile(),
    "public/brand/mark-transparent.svg": markTransparent(),
    "public/brand/logo-horizontal-dark.svg": lockup({ dark: true }),
    "public/brand/logo-horizontal-light.svg": lockup({ dark: false }),
    "public/logo.svg": markTile(),
    "app/icon.svg": markTile(),
  };
  for (const [rel, svg] of Object.entries(svgs)) write(rel, svg);

  const appleSvg = fullBleed(180, 0.7);
  const maskableSvg = fullBleed(512, 0.6); // 外框落在中心 80% 安全圆内
  const social = socialCard();
  const icoSizes = [16, 32, 48];
  const icoEntries = await Promise.all(icoSizes.map(async (size) => ({ size, data: await png(size <= 32 ? markTileSmall() : markTile(), size) })));

  write("app/favicon.ico", ico(icoEntries));
  write("app/apple-icon.png", await png(appleSvg, 180));
  write("public/icons/icon-192.png", await png(markTile(), 192));
  write("public/icons/icon-512.png", await png(markTile(), 512));
  write("public/icons/maskable-512.png", await png(maskableSvg, 512));
  const socialPng = await png(social, 1200, 630);
  write("app/opengraph-image.png", socialPng);
  write("app/twitter-image.png", socialPng);

  if (previewDir) await writePreviews(previewDir, { icoEntries, appleSvg, maskableSvg, socialPng });
  console.log("brand assets generated");
}

async function writePreviews(dir, { icoEntries, appleSvg, maskableSvg, socialPng }) {
  mkdirSync(dir, { recursive: true });
  const nearest = (buf, size) => sharp(buf).resize(size, size, { kernel: "nearest" }).png().toBuffer();
  const label = (text, x, y) => ({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="24"><text x="0" y="17" font-family="Helvetica" font-size="15" fill="#333">${text}</text></svg>`), left: x, top: y });

  // 1) 图标尺寸拼图：原始像素 + 放大 8 倍的最近邻像素格
  const comps = [];
  let x = 20;
  for (const { size, data } of icoEntries) {
    comps.push(label(`favicon ${size}px（原尺寸 / 放大）`, x, 10));
    comps.push({ input: data, left: x, top: 40 });
    comps.push({ input: await nearest(data, size * 8 > 384 ? 384 : size * 8), left: x, top: 40 + size + 12 });
    x += Math.max(size * 8 > 384 ? 384 : size * 8, 220) + 30;
  }
  const row2 = 520;
  const tiles = [
    ["apple-icon 180", await png(appleSvg, 180)],
    ["PWA 192", await png(markTile(), 192)],
    ["maskable 512（圆形遮罩示意）", await sharp(await png(maskableSvg, 512)).resize(256, 256).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="128" fill="#fff"/></svg>`), blend: "dest-in" }]).png().toBuffer()],
    ["mark 透明底（深色页面上）", await sharp({ create: { width: 256, height: 256, channels: 4, background: "#141d26" } }).composite([{ input: await png(markTransparent(), 256) }]).png().toBuffer()],
  ];
  x = 20;
  for (const [name, buf] of tiles) {
    comps.push(label(name, x, row2 - 30));
    comps.push({ input: buf, left: x, top: row2 });
    x += 300;
  }
  await sharp({ create: { width: 1240, height: 820, channels: 4, background: "#ffffff" } }).composite(comps).png().toFile(path.join(dir, "icons-sizes.png"));

  // 2) 组合标与分享图
  const darkLock = lockup({ dark: true });
  const lightLock = lockup({ dark: false });
  const dl = await sharp(Buffer.from(darkLock)).resize({ width: 1100 }).png().toBuffer();
  const ll = await sharp(Buffer.from(lightLock)).resize({ width: 1000 }).png().toBuffer();
  const dlMeta = await sharp(dl).metadata();
  const llMeta = await sharp(ll).metadata();
  const sp = await sharp(socialPng).resize({ width: 1100 }).png().toBuffer();
  const spMeta = await sharp(sp).metadata();
  const h = 40 + dlMeta.height + 60 + llMeta.height + 60 + spMeta.height + 40;
  await sharp({ create: { width: 1180, height: h, channels: 4, background: "#ffffff" } })
    .composite([
      { input: dl, left: 40, top: 40 },
      { input: ll, left: 40, top: 40 + dlMeta.height + 60 },
      { input: sp, left: 40, top: 40 + dlMeta.height + 60 + llMeta.height + 60 },
    ])
    .png()
    .toFile(path.join(dir, "lockups-and-social.png"));
}

await main();
