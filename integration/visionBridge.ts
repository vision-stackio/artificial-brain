export type BrainEmotion = "NEUTRAL" | "CALM" | "HAPPY" | "EXCITED" | "CURIOUS" | "SURPRISED" | "FEARFUL" | "ANGRY" | "DISGUSTED" | "SAD" | "PAIN";
export type BrainAction = "OBSERVE" | "APPROACH" | "GREET" | "INVESTIGATE" | "FLEE" | "FREEZE" | "CONFRONT" | "WITHDRAW" | "REJECT" | "RECOIL";
export type VisionEmotion = "HAPPY" | "CALM" | "CURIOUS" | "CONFUSED" | "SURPRISED" | "WORRIED" | "SAD" | "EXCITED" | "ANNOYED" | "NEUTRAL";
export type VisionDecision = "TRACK_PERSON" | "INVESTIGATE" | "LEARN" | "GREET" | "OBSERVE_ONLY" | "IGNORE";
export const toVisionEmotion = (e: BrainEmotion): VisionEmotion => ({
  NEUTRAL: "NEUTRAL", CALM: "CALM", HAPPY: "HAPPY", EXCITED: "EXCITED", CURIOUS: "CURIOUS", SURPRISED: "SURPRISED",
  FEARFUL: "WORRIED", PAIN: "WORRIED", SAD: "SAD", ANGRY: "ANNOYED", DISGUSTED: "ANNOYED",
} as const)[e];
export const toVisionDecision = (a: BrainAction): VisionDecision => ({
  OBSERVE: "OBSERVE_ONLY", APPROACH: "INVESTIGATE", GREET: "GREET", INVESTIGATE: "INVESTIGATE",
  FLEE: "IGNORE", FREEZE: "IGNORE", CONFRONT: "IGNORE", WITHDRAW: "IGNORE", REJECT: "IGNORE", RECOIL: "IGNORE",
} as const)[a];

export interface PerceiveInput {
  modality: "vision" | "text-read" | "audio" | "smell" | "taste" | "touch" | "pain" | "thought";
  text?: string; image?: string; level?: number; tag?: string; intensity?: number; duration?: number;
}

export class BrainClient {
  constructor(private base = "http://localhost:7070") {}

  async perceive(input: PerceiveInput) {
    const r = await fetch(`${this.base}/api/stimulus`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (!r.ok) throw new Error(`brain: ${(await r.json()).error ?? r.status}`);
    return r.json() as Promise<{ delivered: boolean; label: string; notes: string[] }>;
  }

  async state() {
    const j = (await (await fetch(`${this.base}/api/state`)).json()) as { connected: boolean; report: null | {
      emotion: BrainEmotion; intensity: number; decision: BrainAction; decisionConfidence: number; valence: number; arousal: number } };
    return j.report ? { ...j.report, connected: j.connected, visionEmotion: toVisionEmotion(j.report.emotion), visionDecision: toVisionDecision(j.report.decision) } : null;
  }
  listen(cb: (evt: { type: "emotion" | "decision" | "episode"; [k: string]: unknown }) => void) {
    const ctl = new AbortController();
    (async () => {
      const res = await fetch(`${this.base}/api/stream`, { signal: ctl.signal });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const data = block.split("\n").find((l) => l.startsWith("data: "));
          if (data) try { cb(JSON.parse(data.slice(6))); } catch { /* ignore */ }
        }
      }
    })().catch(() => {});
    return () => ctl.abort();
  }
}
