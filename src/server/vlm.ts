import { Appraisal, clamp } from "../shared/types";
import { finishAppraisal } from "../shared/lexicon";

/**
 * Optional "real" visual understanding through an OpenRouter vision model
 * (same OPENROUTER_API_KEY / OPENROUTER_VISION_MODEL variables Vision already uses).
 * Without it, the brain only gets pixel statistics + whatever you tell it with --is "...".
 * NOTE: written against the OpenRouter chat-completions format; not exercised against a live key.
 */
export const vlmEnabled = () => !!process.env.OPENROUTER_API_KEY && !!process.env.OPENROUTER_VISION_MODEL;

export interface VlmResult { caption: string; appraisal: Partial<Appraisal> }

const PROMPT = `You are the visual appraisal stage of an artificial brain. Look at the image and reply with ONLY compact JSON:
{"caption":"<=12 words","reward":0-1,"threat":0-1,"loss":0-1,"anger":0-1,"disgust":0-1,"pain":0-1,"social":0-1,"face":0-1,"novelty":0-1}
reward = pleasant/desirable (cute animal, food, celebration). threat = dangerous. loss = sad/lonely/grief. anger = hostile/insulting.
disgust = gross/rotten. pain = injury. social = people present. face = a face is clearly visible. novelty = unusual/unexpected.`;

export async function describeWithVlm(buf: Buffer, mime = "image/jpeg"): Promise<VlmResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENROUTER_VISION_MODEL,
      temperature: 0,
      messages: [{ role: "user", content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: `data:${mime};base64,${buf.toString("base64")}` } },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const json: any = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("vision model returned no JSON");
  const o = JSON.parse(m[0]);
  const num = (v: unknown) => clamp(typeof v === "number" ? v : 0);
  const appraisal: Partial<Appraisal> = {
    reward: num(o.reward), threat: num(o.threat), loss: num(o.loss), anger: num(o.anger), disgust: num(o.disgust),
    pain: num(o.pain), social: num(o.social), face: num(o.face), novelty: num(o.novelty),
  };
  return { caption: String(o.caption ?? "something"), appraisal };
}

export function completeAppraisal(p: Partial<Appraisal>): Appraisal {
  const a: Appraisal = { valence: 0, arousal: 0, threat: 0, reward: 0, social: 0, novelty: 0.2, disgust: 0, pain: 0, loss: 0, anger: 0, face: 0, familiarity: 0, ...p };
  return finishAppraisal(a);
}
