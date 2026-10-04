import fs from "fs";
import path from "path";
import { Appraisal, clamp } from "../shared/types";
import { hashDistance } from "./imageAnalyzer";

export interface MemoryItem {
  key: string;
  kind: "image" | "text";
  label: string;
  hash?: string;
  words?: string[];
  seen: number;
  valence: number;   // how it felt last time(s), -1..1
  arousal: number;
  peak: string;
  last: string;
}

export interface Recall { item: MemoryItem; similarity: number }

const words = (t: string) => [...new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2))];

/** Episodic memory on disk: what he has seen and how it felt, so the second time is different from the first. */
export class Memory {
  items: MemoryItem[] = [];
  constructor(private file: string) {
    try { this.items = JSON.parse(fs.readFileSync(file, "utf8")); } catch { this.items = []; }
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.items, null, 1));
  }

  recallImage(hash: string): Recall | null {
    let best: Recall | null = null;
    for (const it of this.items) {
      if (it.kind !== "image" || !it.hash) continue;
      const d = hashDistance(hash, it.hash);
      if (d <= 10) { const sim = 1 - d / 20; if (!best || sim > best.similarity) best = { item: it, similarity: sim }; }
    }
    return best;
  }

  recallText(text: string): Recall | null {
    const w = words(text);
    if (w.length < 2) return null;
    let best: Recall | null = null;
    for (const it of this.items) {
      if (it.kind !== "text" || !it.words) continue;
      const inter = w.filter((x) => it.words!.includes(x)).length;
      const sim = inter / (new Set([...w, ...it.words]).size || 1);
      if (sim >= 0.6 && (!best || sim > best.similarity)) best = { item: it, similarity: sim };
    }
    return best;
  }

  /** Stored before the brain reacts, so familiarity can shape the reaction. */
  touch(kind: "image" | "text", label: string, hashOrText: string): { key: string; recall: Recall | null } {
    const recall = kind === "image" ? this.recallImage(hashOrText) : this.recallText(hashOrText);
    if (recall) { recall.item.seen++; recall.item.last = new Date().toISOString(); this.save(); return { key: recall.item.key, recall }; }
    const key = `${kind}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    this.items.push({
      key, kind, label: label.slice(0, 80), seen: 1, valence: 0, arousal: 0, peak: "NEUTRAL", last: new Date().toISOString(),
      ...(kind === "image" ? { hash: hashOrText } : { words: words(hashOrText) }),
    });
    this.save();
    return { key, recall: null };
  }

  /** After the brain has reacted: remember how it felt. */
  learn(key: string, valence: number, arousal: number, peak: string) {
    const it = this.items.find((i) => i.key === key);
    if (!it) return;
    it.valence = it.seen <= 1 ? valence : it.valence * 0.5 + valence * 0.5;
    it.arousal = it.seen <= 1 ? arousal : it.arousal * 0.5 + arousal * 0.5;
    it.peak = peak;
    this.save();
  }

  clear() { this.items = []; this.save(); }
}

/** Shape a fresh appraisal by what he remembers: known things are less novel, and old feelings come back. */
export function applyRecall(a: Appraisal, recall: Recall | null): { appraisal: Appraisal; habituation: number } {
  if (!recall) return { appraisal: a, habituation: 1 };
  const { item, similarity } = recall;
  const fam = clamp(similarity * (0.55 + 0.15 * Math.min(item.seen, 3)));
  const out = { ...a, familiarity: fam, novelty: clamp(a.novelty * (1 - 0.75 * fam)) };
  if (item.valence > 0.2) out.reward = clamp(out.reward + item.valence * 0.35 * fam);
  if (item.valence < -0.2) {
    if (item.peak === "FEARFUL") out.threat = clamp(out.threat + -item.valence * 0.4 * fam);
    else if (item.peak === "SAD") out.loss = clamp(out.loss + -item.valence * 0.4 * fam);
    else if (item.peak === "ANGRY") out.anger = clamp(out.anger + -item.valence * 0.4 * fam);
    else if (item.peak === "DISGUSTED") out.disgust = clamp(out.disgust + -item.valence * 0.4 * fam);
    else if (item.peak === "PAIN") out.pain = clamp(out.pain + -item.valence * 0.4 * fam);
  }
  return { appraisal: out, habituation: 1 / (1 + 0.12 * Math.max(0, item.seen - 1)) };
}
