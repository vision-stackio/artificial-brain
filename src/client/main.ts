import { BrainSim } from "../shared/simulation";
import { buildCloud, buildFibres } from "../shared/geometry";
import { BrainRenderer } from "./renderer";
import { EMOTION_COLOR, Hud } from "./hud";
import type { ClientToServer, ServerToClient } from "../shared/types";

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

// ---------------- link to the terminal ----------------
let ws: WebSocket | null = null;
const send = (m: ClientToServer) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

function connect() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  ws.onopen = () => { hud.setLink(true); hud.log("sys", "terminal connected"); };
  ws.onclose = () => { hud.setLink(false); setTimeout(connect, 1500); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data) as ServerToClient;
    if (m.type === "stimulus") {
      sim.stimulate(m.stimulus);
      hud.showStimulus(m.stimulus);
      hud.log("stim", `<b>${m.stimulus.modality}</b> ${escapeHtml(m.stimulus.label)}`);
    } else if (m.type === "command") {
      if (m.cmd === "sleep") { sim.sleep(); hud.log("sys", "falling asleep"); }
      else if (m.cmd === "wake") { sim.wake(); hud.log("sys", "waking up"); }
      else { sim.reset(); hud.log("sys", "reset"); }
    } else if (m.type === "force") {
      sim.force(m.emotion, m.level);
      hud.log("sys", `forcing ${m.emotion.toLowerCase()}`);
    } else if (m.type === "hello") {
      hud.log("sys", `${m.memoryCount} memories loaded${m.hasVlm ? ", vision model on" : ""}`);
    }
  };
}
connect();

sim.onEmotion = (e) => {
  send({ type: "emotion", event: e });
  hud.log("emo", `feels <b style="color:${EMOTION_COLOR[e.emotion]}">${e.emotion.toLowerCase()}</b>${e.because ? ` ← ${e.because}` : ""}`);
};
sim.onDecision = (d) => {
  send({ type: "decision", event: d });
  hud.log("dec", `decides <b>${d.action.toLowerCase()}</b>${d.reactionMs ? ` in ${d.reactionMs} ms` : ""} ← ${d.because}`);
};
sim.onEpisode = (ep) => {
  send({ type: "episode", stimulusId: ep.stimulus.id, memoryKey: ep.stimulus.memoryKey, peak: ep.peak, valence: ep.valence, arousal: ep.arousal });
};

// ---------------- main loop ----------------
let paused = false;
let last = performance.now();
let hudTimer = 0, reportTimer = 0;
sim.step(3); // let the resting state settle before the first frame

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) sim.step(dt);
  renderer.draw(paused ? 0.0001 : dt, sim.time);
  hudTimer += dt; reportTimer += dt;
  if (hudTimer > 0.12) { hudTimer = 0; hud.update(renderer.groupColour()); }
  if (reportTimer > 0.25) { reportTimer = 0; send({ type: "report", report: sim.report(12) }); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "l") renderer.showLabels = !renderer.showLabels;
  else if (k === "e") renderer.showPaths = !renderer.showPaths;
  else if (k === "r") renderer.autoRotate = !renderer.autoRotate;
  else if (k === "p") { paused = !paused; hud.log("sys", paused ? "paused" : "resumed"); }
});

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
