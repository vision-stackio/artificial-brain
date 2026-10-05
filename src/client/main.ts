import { BrainSim } from "../shared/simulation";
import { buildCloud, buildFibres } from "../shared/geometry";
import { BrainRenderer } from "./renderer";
import { Hud, HistoryItem } from "./hud";
import type { ClientToServer, Neuromodulators, ServerToClient, Stimulus } from "../shared/types";

const sim = new BrainSim();
// slower machine? open http://localhost:7070/?density=0.6
const density = Math.max(0.2, Math.min(1.5, Number(new URLSearchParams(location.search).get("density")) || 1));
const cloud = buildCloud(sim.nodes, density);
const fibres = buildFibres(cloud, sim.nodes, Math.round(340 * Math.min(1, density)));
const renderer = new BrainRenderer(sim, cloud, fibres, {
  left: document.getElementById("v-left") as HTMLCanvasElement,
  right: document.getElementById("v-right") as HTMLCanvasElement,
  top: document.getElementById("v-top") as HTMLCanvasElement,
});
const hud = new Hud(sim);
(window as unknown as { brain: BrainSim }).brain = sim;   // poke it from the console: brain.stimulate(...)

// ---------------- saved history (survives a page reload) ----------------
const KEY = "vision-brain:v1";
const MAX_ITEMS = 500;
const FRESH_MS = 10 * 60 * 1000;   // chemistry is only restored if you reload within 10 minutes
interface Saved {
  items: HistoryItem[];
  last: Stimulus | null;
  snap: { at: number; time: number; asleep: boolean; nm: Neuromodulators } | null;
}
let saved: Saved = { items: [], last: null, snap: null };
let everSaved = false;   // true once something of ours is in storage
try { const raw = localStorage.getItem(KEY); if (raw) { saved = { ...saved, ...JSON.parse(raw) }; everSaved = true; } } catch { /* storage unavailable: history just won't persist */ }

function persist() {
  try {
    // if the saved data has disappeared since we last wrote it (cleared by hand in the console / browser settings),
    // do NOT write our in-memory copy back: treat it as a real "clear all"
    if (everSaved && localStorage.getItem(KEY) === null) { clearAll(); return; }
    localStorage.setItem(KEY, JSON.stringify(saved));
    everSaved = true;
  } catch { /* quota or private mode */ }
}

/** forget everything: history, last perceived thing, saved chemistry, and put the brain back to rest */
function clearAll() {
  saved = { items: [], last: null, snap: null };
  everSaved = false;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  hud.setItems([]);
  hud.clearStimulus();
  sim.reset();
}
(window as unknown as { clearBrainHistory: () => void }).clearBrainHistory = clearAll;   // console: clearBrainHistory()
/** write a line to the log; keep = false for noise that should not be remembered */
function note(kind: HistoryItem["kind"], a: string, b: string, keep = true) {
  const item: HistoryItem = { at: Date.now(), kind, a, b };
  hud.add(item);
  if (!keep) return;
  saved.items.push(item);
  if (saved.items.length > MAX_ITEMS) saved.items.splice(0, saved.items.length - MAX_ITEMS);
  persist();
}
function snapshot() {
  saved.snap = { at: Date.now(), time: sim.time, asleep: sim.asleep, nm: { ...sim.nm } };
  persist();
}

// restore what was there before the reload
hud.setItems(saved.items);
if (saved.last) hud.showStimulus(saved.last);
if (saved.snap && Date.now() - saved.snap.at < FRESH_MS) {
  Object.assign(sim.nm, saved.snap.nm);
  sim.time = saved.snap.time;
  if (saved.snap.asleep) sim.sleep();
  note("sys", "", "page reloaded: chemistry and history restored", false);
}

// ---------------- link to the terminal ----------------
let ws: WebSocket | null = null;
const send = (m: ClientToServer) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

function connect() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  ws.onopen = () => { hud.setLink(true); note("sys", "", "terminal connected", false); };
  ws.onclose = () => { hud.setLink(false); setTimeout(connect, 1500); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data) as ServerToClient;
    if (m.type === "stimulus") {
      sim.stimulate(m.stimulus);
      hud.showStimulus(m.stimulus);
      saved.last = m.stimulus;
      note("stim", m.stimulus.modality, m.stimulus.label);
    } else if (m.type === "command") {
      if (m.cmd === "sleep") { sim.sleep(); note("sys", "", "falling asleep"); }
      else if (m.cmd === "wake") { sim.wake(); note("sys", "", "waking up"); }
      else { sim.reset(); note("sys", "", "reset"); }
    } else if (m.type === "force") {
      sim.force(m.emotion, m.level);
      note("sys", "", `forcing ${m.emotion.toLowerCase()}`);
    } else if (m.type === "hello") {
      note("sys", "", `${m.memoryCount} memories loaded${m.hasVlm ? ", vision model on" : ""}`, false);
    }
  };
}
connect();

sim.onEmotion = (e) => {
  send({ type: "emotion", event: e });
  note("emo", e.emotion, e.because);
};
sim.onDecision = (d) => {
  send({ type: "decision", event: d });
  note("dec", d.action, `${d.because}${d.reactionMs ? ` · ${d.reactionMs} ms` : ""}`);
};
sim.onEpisode = (ep) => {
  send({ type: "episode", stimulusId: ep.stimulus.id, memoryKey: ep.stimulus.memoryKey, peak: ep.peak, valence: ep.valence, arousal: ep.arousal });
};

// ---------------- main loop ----------------
let paused = false;
let last = performance.now();
let hudTimer = 0, reportTimer = 0, saveTimer = 0;
sim.step(3); // let the resting state settle before the first frame

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) sim.step(dt);
  renderer.draw(paused ? 0.0001 : dt, sim.time);
  hudTimer += dt; reportTimer += dt; saveTimer += dt;
  if (hudTimer > 0.12) { hudTimer = 0; hud.update(renderer.groupColour()); }
  if (reportTimer > 0.25) { reportTimer = 0; send({ type: "report", report: sim.report(12) }); }
  if (saveTimer > 2) { saveTimer = 0; snapshot(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener("beforeunload", snapshot);
document.addEventListener("visibilitychange", () => { if (document.hidden) snapshot(); });

window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "escape") hud.closeHistory();
  else if (k === "l") renderer.showLabels = !renderer.showLabels;
  else if (k === "e") renderer.showPaths = !renderer.showPaths;
  else if (k === "r") renderer.autoRotate = !renderer.autoRotate;
  else if (k === "h") hud.toggleHistory(saved.items, clearAll);
  else if (k === "p") { paused = !paused; note("sys", "", paused ? "paused" : "resumed", false); }
});