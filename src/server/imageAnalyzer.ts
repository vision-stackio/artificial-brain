import fs from "fs";
import sharp from "sharp";
import { Appraisal, ZERO_APPRAISAL, clamp } from "../shared/types";
import { finishAppraisal } from "../shared/lexicon";

export interface ImageFeatures {
  brightness: number; contrast: number; saturation: number; colorfulness: number;
  warm: number; green: number; blue: number; redDominant: number; dark: number; edges: number; skin: number; skinCentre: number;
}

export interface ImageAnalysis {
  features: ImageFeatures;
  /** what a bare visual cortex could infer: no objects, no meaning */
  appraisal: Appraisal;
  thumbnail: string;
  hash: string;
}

export async function loadImageBuffer(src: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (!fs.existsSync(src)) throw new Error(`file not found: ${src}`);
  return fs.readFileSync(src);
}

/** 64-bit difference hash, hex. Two views of the same picture differ by only a few bits. */
async function dHash(buf: Buffer): Promise<string> {
  const { data } = await sharp(buf).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  // + 3 hex digits of mean colour, so flat/plain pictures of different colours are not mistaken for each other
  const { channels } = await sharp(buf).rotate().removeAlpha().stats();
  for (const ch of channels.slice(0, 3)) hex += Math.min(15, Math.floor(ch.mean / 16)).toString(16);
  return hex;
}

/** Distance between two image hashes: shape bits (hamming) plus a heavy penalty for different mean colour. */
export function hashDistance(a: string, b: string): number {
  let colour = 0;
  for (let i = 16; i < 19; i++) colour = Math.max(colour, Math.abs(parseInt(a[i] ?? "0", 16) - parseInt(b[i] ?? "0", 16)));
  return colour > 2 ? 99 : hammingHex(a.slice(0, 16), b.slice(0, 16));
}

export function hammingHex(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

export async function analyzeImage(buf: Buffer): Promise<ImageAnalysis> {
  const N = 96;
  const { data } = await sharp(buf).rotate().removeAlpha().resize(N, N, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });
  const lum = new Float32Array(N * N);
  let sumL = 0, sumS = 0, warm = 0, green = 0, blue = 0, red = 0, dark = 0, skin = 0, skinC = 0, centreN = 0;
  let rg: number[] = [], yb: number[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 3;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lum[y * N + x] = l; sumL += l;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const v = mx / 255, s = mx === 0 ? 0 : (mx - mn) / mx;
    sumS += s;
    let h = 0;
    if (mx !== mn) {
      const d = mx - mn;
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    if (s > 0.25 && v > 0.2) {
      if (h < 60 || h > 340) warm++;
      if (h >= 70 && h < 170) green++;
      if (h >= 170 && h < 260) blue++;
    }
    if (s > 0.5 && v > 0.25 && (h < 15 || h > 345)) red++;
    if (l < 0.12) dark++;
    // classic YCbCr skin-tone rule
    const Y = 0.299 * r + 0.587 * g + 0.114 * b;
    const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const isSkin = Y > 80 && Cb > 85 && Cb < 135 && Cr > 135 && Cr < 180;
    if (isSkin) skin++;
    if (x > N * 0.25 && x < N * 0.75 && y > N * 0.15 && y < N * 0.7) { centreN++; if (isSkin) skinC++; }
    rg.push(r - g); yb.push(0.5 * (r + g) - b);
  }
  const P = N * N;
  const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length;
  const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
  const colorfulness = clamp((Math.hypot(std(rg), std(yb)) + 0.3 * Math.hypot(mean(rg), mean(yb))) / 110);
  const brightness = sumL / P;
  let varL = 0;
  for (let i = 0; i < P; i++) varL += (lum[i] - brightness) ** 2;
  const contrast = clamp(Math.sqrt(varL / P) * 3);
  // Sobel edge density
  let edgeSum = 0;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const gx = -lum[(y - 1) * N + x - 1] + lum[(y - 1) * N + x + 1] - 2 * lum[y * N + x - 1] + 2 * lum[y * N + x + 1] - lum[(y + 1) * N + x - 1] + lum[(y + 1) * N + x + 1];
    const gy = -lum[(y - 1) * N + x - 1] - 2 * lum[(y - 1) * N + x] - lum[(y - 1) * N + x + 1] + lum[(y + 1) * N + x - 1] + 2 * lum[(y + 1) * N + x] + lum[(y + 1) * N + x + 1];
    edgeSum += Math.hypot(gx, gy);
  }
  const edges = clamp(edgeSum / ((N - 2) * (N - 2)) * 2.2);

  const f: ImageFeatures = {
    brightness, contrast, saturation: sumS / P, colorfulness, warm: warm / P, green: green / P, blue: blue / P,
    redDominant: red / P, dark: dark / P, edges, skin: skin / P, skinCentre: skinC / Math.max(1, centreN),
  };

  // --- low-level appraisal (deliberately modest: pixels alone don't tell you what something IS) ---
  const nature = clamp(f.green * 2.2 + f.blue * 1.0);
  const pleasant = 0.35 * f.brightness + 0.3 * f.colorfulness + 0.4 * nature + 0.15 * f.warm;
  const a: Appraisal = { ...ZERO_APPRAISAL };
  a.reward = clamp((pleasant - 0.42) * 1.4) * 0.8;
  a.threat = clamp(f.redDominant * 2.2 + f.dark * f.edges * 1.4) * 0.8;
  a.loss = clamp((0.35 - f.brightness) * 1.5 * (1 - f.colorfulness)) * 0.7;
  a.face = clamp((f.skinCentre - 0.18) * 3);
  a.social = clamp(a.face * 0.9 + (f.skin - 0.25) * 1.2);
  a.novelty = clamp(0.25 + 0.5 * f.edges + 0.2 * f.contrast);
  finishAppraisal(a);

  const thumb = await sharp(buf).rotate().resize(220, 220, { fit: "cover" }).jpeg({ quality: 72 }).toBuffer();
  return { features: f, appraisal: a, thumbnail: `data:image/jpeg;base64,${thumb.toString("base64")}`, hash: await dHash(buf) };
}
