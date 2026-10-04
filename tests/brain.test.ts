import test from "node:test";
import assert from "node:assert/strict";
import { BrainSim } from "../src/shared/simulation";
import { appraiseText } from "../src/shared/lexicon";
import { Appraisal, Stimulus, ZERO_APPRAISAL } from "../src/shared/types";
import { hashDistance } from "../src/server/imageAnalyzer";

function react(modality: Stimulus["modality"], ap: Partial<Appraisal>, seconds = 8) {
  const sim = new BrainSim();
  sim.step(2);
  const emotions: string[] = [], decisions: string[] = [];
  sim.onEmotion = (e) => emotions.push(e.emotion);
  sim.onDecision = (d) => decisions.push(d.action);
  sim.stimulate({ id: "t", modality, label: "t", appraisal: { ...ZERO_APPRAISAL, ...ap }, intensity: 0.85, duration: 4, source: "manual" });
  const peak: Record<string, number> = {};
  for (let i = 0; i < seconds * 50; i++) {
    sim.step(0.02);
    for (const n of sim.nodes) peak[n.region.id] = Math.max(peak[n.region.id] ?? 0, sim.ex(n.region.id));
  }
  return { sim, emotions, decisions, peak };
}

test("something lovely lights up the reward circuit, not the amygdala", () => {
  const r = react("vision", { reward: 0.9, face: 0.4, social: 0.4 });
  assert.ok(r.peak.NACC > 0.6 && r.peak.VTA > 0.5 && r.peak.VMPFC > 0.4);
  assert.ok(r.peak.AMY < 0.2);
  assert.ok(r.emotions.includes("HAPPY") || r.emotions.includes("EXCITED"));
  assert.ok(r.decisions.includes("APPROACH"));
});

test("a snake lights up amygdala + PAG + locus coeruleus and he flees or freezes", () => {
  const r = react("vision", { threat: 0.9, novelty: 0.6 });
  assert.ok(r.peak.AMY > 0.8 && r.peak.PAG > 0.6 && r.peak.LC > 0.6);
  assert.ok(r.peak.NACC < 0.1);
  assert.ok(r.emotions.includes("FEARFUL"));
  assert.ok(r.decisions.includes("FREEZE") || r.decisions.includes("FLEE"));
});

test("each category produces its own signature emotion", () => {
  assert.ok(react("text-read", { loss: 0.9 }).emotions.includes("SAD"));
  assert.ok(react("smell", { disgust: 0.9 }).emotions.includes("DISGUSTED"));
  assert.ok(react("pain", { pain: 0.9 }).emotions.includes("PAIN"));
  assert.ok(react("audio", { anger: 0.85, social: 0.8 }).emotions.includes("ANGRY"));
});

test("an unremarkable stimulus does not cause drama", () => {
  const r = react("vision", {});
  assert.equal(r.decisions.length, 0);
});

test("emotion fades and he goes back to observing", () => {
  const r = react("vision", { reward: 0.9 }, 14);
  assert.equal(r.sim.decision.current, "OBSERVE");
  assert.ok(["NEUTRAL", "CALM"].includes(r.sim.emotion.current));
});

test("sleep suppresses sensory response; danger wakes him", () => {
  const sim = new BrainSim(); sim.step(2); sim.sleep();
  sim.stimulate({ id: "a", modality: "vision", label: "x", appraisal: { ...ZERO_APPRAISAL, reward: 0.5 }, intensity: 0.5, duration: 3, source: "manual" });
  for (let i = 0; i < 150; i++) sim.step(0.02);
  assert.ok(sim.ex("NACC") < 0.3 && sim.asleep);
  sim.stimulate({ id: "b", modality: "pain", label: "x", appraisal: { ...ZERO_APPRAISAL, pain: 0.9 }, intensity: 0.9, duration: 2, source: "manual" });
  assert.equal(sim.asleep, false);
});

test("text appraisal: meaning, negation and phrases", () => {
  assert.ok(appraiseText("my puppy is so cute, I love him").appraisal.reward > 0.8);
  assert.ok(appraiseText("a cobra on the road").appraisal.threat > 0.4);
  assert.ok(appraiseText("you are a stupid idiot").appraisal.anger > 0.8);
  assert.ok(appraiseText("I am not happy").appraisal.reward < 0.1);
  assert.equal(appraiseText("the table is wooden").matched.length, 0);
});

test("image hash: same picture matches, different colour does not", () => {
  assert.ok(hashDistance("ffff0000ffff0000" + "777", "ffff0000ffff0000" + "777") === 0);
  assert.ok(hashDistance("ffff0000ffff0000" + "777", "ffff0000ffff0000" + "d11") > 50);
});

test("chemistry: each chemical rises for the right reason", () => {
  const lvl = (r: ReturnType<typeof react>, k: keyof typeof r.sim.nm) => r.sim.nm[k];
  const peaks = (modality: Stimulus["modality"], ap: Partial<Appraisal>, secs = 8) => {
    const sim = new BrainSim(); sim.step(2);
    sim.stimulate({ id: "c", modality, label: "c", appraisal: { ...ZERO_APPRAISAL, ...ap }, intensity: 0.85, duration: 4, source: "manual" });
    const base = { ...sim.nm }, peak = { ...sim.nm };
    for (let i = 0; i < secs * 50; i++) { sim.step(0.02); for (const k of Object.keys(peak) as (keyof typeof peak)[]) peak[k] = Math.max(peak[k], sim.nm[k]); }
    return { base, peak };
  };
  void lvl;
  const nice = peaks("vision", { reward: 0.9, social: 0.7, face: 0.6 });
  assert.ok(nice.peak.dopamine > nice.base.dopamine + 0.25, "dopamine");
  assert.ok(nice.peak.oxytocin > nice.base.oxytocin + 0.05, "oxytocin");
  const scary = peaks("vision", { threat: 0.9, novelty: 0.6 });
  assert.ok(scary.peak.noradrenaline > scary.base.noradrenaline + 0.4, "noradrenaline");
  assert.ok(scary.peak.adrenaline > scary.base.adrenaline + 0.15, "adrenaline");
  assert.ok(scary.peak.cortisol > scary.base.cortisol + 0.05, "cortisol");
  const hurt = peaks("pain", { pain: 0.9 });
  assert.ok(hurt.peak.endorphin > hurt.base.endorphin + 0.2, "endorphin");
  const odd = peaks("vision", { novelty: 0.9 });
  assert.ok(odd.peak.acetylcholine > odd.base.acetylcholine + 0.15, "acetylcholine");
  assert.ok(scary.peak.gaba > scary.base.gaba, "gaba rises when the brain gets busy");
  const sim = new BrainSim(); sim.step(1); sim.sleep(); for (let i = 0; i < 20 * 50; i++) sim.step(0.02);
  assert.ok(sim.nm.melatonin > 0.5, "melatonin when asleep");
});
