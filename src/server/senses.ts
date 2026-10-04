import path from "path";
import { Appraisal, Modality, Stimulus, ZERO_APPRAISAL, clamp } from "../shared/types";
import { appraiseText, finishAppraisal } from "../shared/lexicon";
import { analyzeImage, loadImageBuffer } from "./imageAnalyzer";
import { completeAppraisal, describeWithVlm, vlmEnabled } from "./vlm";
import { Memory, applyRecall } from "./memory";

export interface SenseOpts { tag?: string; intensity?: number; duration?: number }
export interface SenseResult { stimulus: Stimulus; notes: string[] }

const CH: (keyof Appraisal)[] = ["reward", "threat", "loss", "anger", "disgust", "pain"];
let counter = 0;
const nextId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** The sensory organs: turn raw input (a file, a sentence) into a Stimulus the brain can feel. */
export class Senses {
  constructor(private memory: Memory) {}

  async see(src: string, opts: SenseOpts = {}): Promise<SenseResult> {
    const notes: string[] = [];
    const buf = await loadImageBuffer(src);
    const img = await analyzeImage(buf);
    const f = img.features;
    notes.push(`retina: brightness ${pct(f.brightness)}, colour ${pct(f.colorfulness)}, edges ${pct(f.edges)}, skin-tone ${pct(f.skin)}`);

    const base = /^https?:\/\//i.test(src) ? new URL(src).pathname.split("/").pop() ?? "image" : path.basename(src);
    const fileWords = base.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.\d]+/g, " ").trim();

    let label = opts.tag || fileWords || "an image";
    let source: Stimulus["source"] = "pixels";
    let semantic: Partial<Appraisal> | null = null;
    let weight = 0;

    if (vlmEnabled() && !opts.tag) {
      try {
        const v = await describeWithVlm(buf);
        semantic = v.appraisal; weight = 0.85; label = v.caption; source = "vlm";
        notes.push(`vision model: "${v.caption}"`);
      } catch (e) { notes.push(`vision model failed (${(e as Error).message}), using pixels only`); }
    }
    if (!semantic) {
      const tagRes = opts.tag ? appraiseText(opts.tag) : null;
      const nameRes = fileWords ? appraiseText(fileWords) : null;
      if (tagRes && tagRes.matched.length) { semantic = tagRes.appraisal; weight = 0.9; source = "pixels+tag"; notes.push(`you told me: "${opts.tag}" -> ${tagRes.matched.join(", ")}`); }
      else if (nameRes && nameRes.matched.length) { semantic = nameRes.appraisal; weight = 0.6; source = "pixels+tag"; notes.push(`file name hints: ${nameRes.matched.join(", ")}`); }
      else notes.push(`no label or vision model: reacting to pixels only. Tip: see <file> --is "a cobra" gives him meaning.`);
    }

    let a: Appraisal = { ...img.appraisal };
    if (semantic) {
      for (const c of CH) a[c] = clamp(weight * (semantic[c] as number ?? 0) + (1 - weight) * a[c]);
      a.social = Math.max(a.social * (1 - weight), (semantic.social as number) ?? 0);
      a.face = Math.max(a.face * 0.6, (semantic.face as number) ?? 0);
      a.novelty = Math.max(a.novelty * 0.5, (semantic.novelty as number) ?? 0);
      a = completeAppraisal(a);
    }

    const { key, recall } = this.memory.touch("image", label, img.hash);
    const r = applyRecall(a, recall);
    if (recall) notes.push(`recognised: seen ${recall.item.seen} time(s) before, it made him ${recall.item.peak.toLowerCase()} (${recall.item.valence >= 0 ? "+" : ""}${recall.item.valence.toFixed(2)})`);
    else notes.push("never seen this before");
    finishAppraisal(r.appraisal);

    const stimulus: Stimulus = {
      id: nextId(), modality: "vision", label, appraisal: r.appraisal,
      intensity: clamp((opts.intensity ?? 0.8) * r.habituation), duration: opts.duration ?? 5,
      thumbnail: img.thumbnail, source, memoryKey: key,
    };
    return { stimulus, notes };
  }

  text(modality: Exclude<Modality, "vision" | "pain">, text: string, opts: SenseOpts = {}): SenseResult {
    const notes: string[] = [];
    const res = appraiseText(text);
    let a = res.appraisal;
    if (modality === "audio" || modality === "text-read") a = { ...a, social: Math.max(a.social, modality === "audio" ? 0.4 : 0.15) };
    if (res.matched.length) notes.push(`meaning picked up: ${res.matched.join(", ")}`);
    else notes.push("no emotional content recognised: it registers, but means nothing to him yet");

    const { key, recall } = this.memory.touch("text", text, `${modality}:${text}`);
    const r = applyRecall(a, recall);
    if (recall) notes.push(`recognised: heard/read this ${recall.item.seen} time(s) before, it made him ${recall.item.peak.toLowerCase()}`);
    finishAppraisal(r.appraisal);
    const nWords = text.split(/\s+/).length;
    const base = res.matched.length ? res.intensity : 0.3;
    const stimulus: Stimulus = {
      id: nextId(), modality, label: text.length > 70 ? text.slice(0, 67) + "..." : text, appraisal: r.appraisal,
      intensity: clamp((opts.intensity ?? base) * r.habituation), duration: opts.duration ?? clamp(2.2 + nWords * 0.4, 3, 9),
      hasLanguage: modality === "audio" || modality === "text-read", source: "text", memoryKey: key,
    };
    return { stimulus, notes };
  }

  pain(level: number, what: string): SenseResult {
    const l = clamp(level);
    const a: Appraisal = { ...ZERO_APPRAISAL, pain: l, threat: 0.3 * l, novelty: 0.4, arousal: l };
    finishAppraisal(a);
    const stimulus: Stimulus = {
      id: nextId(), modality: "pain", label: what || "sharp pain", appraisal: a, intensity: clamp(0.4 + 0.6 * l),
      duration: 1.6 + l * 1.4, source: "manual",
    };
    return { stimulus, notes: [`pain signal ${pct(l)} via spinal pathway -> thalamus -> S1 / insula / ACC`] };
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
