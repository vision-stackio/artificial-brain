import { BrainSim } from "../shared/simulation";
import { ACTIONS } from "../shared/decision";
import { GROUP_COLOR, GROUP_LABEL, Group } from "../shared/regions";
import { EmotionLabel, Stimulus } from "../shared/types";
import { CHEMS } from "../shared/chem";

export const EMOTION_COLOR: Record<EmotionLabel, string> = {
  NEUTRAL: "#b0b0b0", CALM: "#7bdff2", HAPPY: "#ffd166", EXCITED: "#ff9f1c", CURIOUS: "#4cc9f0", SURPRISED: "#f15bb5",
  FEARFUL: "#b388ff", ANGRY: "#ff3b3b", DISGUSTED: "#9ccc3c", SAD: "#5c7cfa", PAIN: "#ff6b35",
};
const REST_WHY: Record<string, string> = { NEUTRAL: "at rest, waiting for something to happen", CALM: "settled; serotonin is high" };

const APPRAISAL_COLOR: Record<string, string> = {
  reward: "#ffe45e", threat: "#ff4d6d", loss: "#5c7cfa", anger: "#ff3b3b", disgust: "#9ccc3c", pain: "#ff6b35",
  social: "#f78fb3", novelty: "#4cc9f0", face: "#c77dff",
};
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pct = (v: number) => `${Math.round(v * 100)}`;

export class Hud {
  private firingRows: { li: HTMLLIElement; pc: HTMLElement; nm: HTMLElement; bar: HTMLElement }[] = [];
  private chemRows = new Map<string, { row: HTMLElement; fill: HTMLElement; val: HTMLElement }>();
  private raceRows = new Map<string, { row: HTMLElement; fill: HTMLElement; val: HTMLElement }>();
  private legendRows = new Map<Group, HTMLLIElement>();
  private lastEmotion: EmotionLabel | null = null;
  private lastWhy = "";

  constructor(private sim: BrainSim) {
    const ol = $("firing");
    for (let i = 0; i < 18; i++) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="pc">0.0%</span><span class="nm">—</span><span class="bar"></span>`;
      ol.appendChild(li);
      this.firingRows.push({ li, pc: li.children[0] as HTMLElement, nm: li.children[1] as HTMLElement, bar: li.children[2] as HTMLElement });
    }
    const leg = $("legend");
    for (const g of Object.keys(GROUP_COLOR) as Group[]) {
      const li = document.createElement("li");
      li.innerHTML = `<i></i>${GROUP_LABEL[g]}`;
      li.dataset.group = g;
      leg.appendChild(li);
      this.legendRows.set(g, li);
    }
    const chem = $("chem");
    for (const c of CHEMS) {
      const row = document.createElement("div");
      row.className = "chem"; row.style.setProperty("--c", c.color); row.title = c.role;
      row.innerHTML = `<b class="ring"></b><span class="n">${c.label}</span><span class="t"><i></i></span><span class="v">0</span>`;
      chem.appendChild(row);
      this.chemRows.set(c.id, { row, fill: row.querySelector("i") as HTMLElement, val: row.querySelector(".v") as HTMLElement });
    }
    this.fitRows();
    window.addEventListener("resize", () => this.fitRows());
    const race = $("race");
    for (const a of ACTIONS) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<span>${a.toLowerCase()}</span><span class="t"><i></i></span><span class="v">0</span>`;
      race.appendChild(row);
      this.raceRows.set(a, { row, fill: row.querySelector("i") as HTMLElement, val: row.querySelector(".v") as HTMLElement });
    }
    const thr = document.createElement("div"); thr.className = "thr"; thr.id = "thr"; race.appendChild(thr);
  }

  /** show only as many firing-rate rows as fit, so the side panel never needs a scrollbar */
  private fitRows() {
    const rail = $("rail");
    const used = rail.scrollHeight - $("firing").offsetHeight;
    const free = rail.clientHeight - used;
    const fit = Math.max(6, Math.min(this.firingRows.length, Math.floor(free / 21)));
    this.firingRows.forEach((r, i) => { r.li.style.display = i < fit ? "" : "none"; });
    this.shown = fit;
  }
  private shown = 18;

  setLink(on: boolean) {
    const el = $("link");
    el.className = `pill ${on ? "on" : "off"}`;
    el.querySelector("span")!.textContent = on ? "terminal linked" : "no terminal";
  }

  showStimulus(s: Stimulus) {
    const img = $<HTMLImageElement>("stim-img");
    if (s.thumbnail) { img.src = s.thumbnail; img.hidden = false; } else img.hidden = true;
    const label = $("stim-label");
    label.className = ""; label.textContent = s.label;
    const how: Record<string, string> = { vision: "seen", "text-read": "read", audio: "heard", smell: "smelled", taste: "tasted", touch: "touched", pain: "felt", thought: "thought" };
    $("stim-meta").textContent = `${how[s.modality] ?? s.modality} · strength ${pct(s.intensity)}% · meaning from ${s.source}`;
    const bars = $("stim-bars"); bars.innerHTML = "";
    const entries = Object.entries(s.appraisal).filter(([k, v]) => k in APPRAISAL_COLOR && (v as number) > 0.08)
      .sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 4);
    for (const [k, v] of entries) {
      const row = document.createElement("div");
      row.className = "row on"; row.style.setProperty("--c", APPRAISAL_COLOR[k]);
      row.innerHTML = `<span>${k}</span><span class="t"><i style="width:${pct(v as number)}%"></i></span><span class="v">${pct(v as number)}</span>`;
      bars.appendChild(row);
    }
  }

  log(kind: "stim" | "emo" | "dec" | "sys", html: string) {
    const ol = $("log");
    const li = document.createElement("li");
    li.innerHTML = `<time>${this.sim.time.toFixed(1)}s</time><span>${html}</span>`;
    ol.prepend(li);
    while (ol.children.length > 1 && ol.scrollHeight > ol.clientHeight + 1) ol.lastElementChild?.remove();   // newest on top; no scrollbar needed
  }

  /** ~8 Hz DOM refresh (the canvas runs every frame) */
  update(groupColour: Map<Group, number>) {
    const sim = this.sim;
    const em = sim.emotion;
    const color = EMOTION_COLOR[em.current];
    const app = $("app");
    app.style.setProperty("--accent", color);
    if (this.lastEmotion !== em.current) { $("emotion-word").textContent = em.current.toLowerCase(); this.lastEmotion = em.current; }
    const why = em.current === "NEUTRAL" || em.current === "CALM" ? REST_WHY[em.current] : `because ${em.because || "activity pattern"}`;
    if (why !== this.lastWhy) { $("emotion-why").textContent = why; this.lastWhy = why; }
    $("emotion-meter").style.width = `${Math.round(em.intensity * 100)}%`;
    $("clock").textContent = sim.time.toFixed(2);
    $("awake").textContent = sim.asleep ? "asleep" : "awake";

    // firing list: like the reference, % and region name, busiest first
    const order = sim.nodes.map((n) => n).sort((a, b) => sim.activity[b.index] - sim.activity[a.index]).slice(0, this.shown);
    order.forEach((n, i) => {
      const r = this.firingRows[i];
      const a = sim.activity[n.index];
      const c = GROUP_COLOR[n.region.group];
      r.pc.textContent = `${(a * 100).toFixed(1)}%`;
      const lit = a - n.region.rest > 0.15;
      r.pc.style.color = lit ? c : "";
      r.nm.textContent = n.node;
      r.bar.style.width = `${Math.round(a * 100) * 1.2}px`;
      r.bar.style.background = lit ? c : "#bbb";
    });

    // the legend stays grey until that system is actually firing, then shows the colour it paints on the brain
    for (const [g, li] of this.legendRows) {
      const m = groupColour.get(g) ?? 0;
      const dot = li.firstElementChild as HTMLElement;
      const c = GROUP_COLOR[g];
      dot.style.background = m > 0.12 ? c : "#4a4a4a";
      dot.style.boxShadow = m > 0.12 ? `0 0 ${Math.round(4 + 8 * m)}px ${c}` : "none";
      li.style.color = m > 0.12 ? "#e6e6e6" : "";
    }
    for (const c of CHEMS) {
      const v = sim.nm[c.id]; const r = this.chemRows.get(c.id)!;
      r.fill.style.width = `${pct(v)}%`; r.val.textContent = pct(v);
      r.row.classList.toggle("hot", v - c.base > 0.12);   // released: the ring lights up in its colour
    }
    const d = sim.decision;
    for (const a of ACTIONS) {
      const r = this.raceRows.get(a)!;
      const v = Math.min(1, d.x[a] / 1.0);
      r.fill.style.width = `${pct(v)}%`; r.val.textContent = pct(v);
      r.row.classList.toggle("on", a === d.current);
    }
    const thr = $("thr");
    thr.style.left = `calc(86px + 8px + (100% - 86px - 34px - 16px) * ${Math.min(1, d.threshold)})`;
    $("decided").innerHTML = `${d.current.toLowerCase()}<small>${d.current === "OBSERVE" ? "no strong evidence" : `confidence ${pct(d.confidence)}%`}${d.conflict > 0.5 ? " · hesitating" : ""}</small>`;
  }
}
