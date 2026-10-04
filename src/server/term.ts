const on = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);
export const dim = c("2"), bold = c("1"), red = c("31"), green = c("32"), yellow = c("33"), blue = c("34"), magenta = c("35"), cyan = c("36"), grey = c("90");

export const EMOTION_COLOR: Record<string, (s: string) => string> = {
  HAPPY: yellow, EXCITED: yellow, CALM: cyan, CURIOUS: blue, SURPRISED: magenta, FEARFUL: red, ANGRY: red,
  DISGUSTED: green, SAD: blue, PAIN: red, NEUTRAL: grey,
};

/** shell-like split: "quoted strings", 'single', and backslash-escaped spaces (drag-and-drop paths) */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "", q: string | null = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (ch === "\\" && line[i + 1] === " ") { cur += " "; i++; continue; }
    if (/\s/.test(ch)) { if (cur || has) out.push(cur); cur = ""; has = false; continue; }
    cur += ch; has = true;
  }
  if (cur || has) out.push(cur);
  return out;
}
