import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { Hub } from "./hub";
import { BrainLink, PerceiveInput } from "./link";
import { Memory } from "./memory";
import { startRepl } from "./repl";
import { bold, cyan, dim, green } from "./term";
import { vlmEnabled } from "./vlm";
import type { Modality } from "../shared/types";

const ROOT = path.resolve(__dirname, "../..");
const PUBLIC = path.join(ROOT, "dist", "public");
const PORT = Number(process.env.PORT ?? 7070);
const HOST = process.env.HOST ?? "127.0.0.1";
const compiled = __filename.endsWith(".js");

async function main() {
  if (!compiled) {
    // dev: bundle the browser app with esbuild and keep it rebuilt while you edit
    const { startClientBuild } = await import("./clientBuild");
    await startClientBuild(ROOT, { watch: true });
  } else if (!fs.existsSync(path.join(PUBLIC, "app.js"))) {
    console.error("browser bundle missing, run: npm run build");
    process.exit(1);
  }

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(PUBLIC));

  const server = http.createServer(app);
  const memory = new Memory(path.join(ROOT, "data", "memory.json"));
  let link!: BrainLink;
  const hub = new Hub(server, () => link.helloMessage());
  link = new BrainLink(hub, memory);

  // ---- HTTP API: lets Vision (or anything else) feed and read the brain ------
  app.get("/api/state", (_req, res) => res.json({ connected: link.connected, report: link.state }));
  app.get("/api/stream", (_req, res) => hub.addSse(res));
  app.post("/api/stimulus", async (req, res) => {
    const b = req.body as Partial<PerceiveInput> & { modality?: Modality };
    if (!b.modality) return res.status(400).json({ error: "modality required" });
    try {
      const r = await link.perceive(b as PerceiveInput);
      res.json({ delivered: r.delivered, label: r.stimulus.label, appraisal: r.stimulus.appraisal, notes: r.notes });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  await new Promise<void>((ok) => server.listen(PORT, HOST, ok));
  const url = `http://localhost:${PORT}`;
  console.log(`\n${bold("VISION BRAIN")}  ${green(url)}  ${dim(`(${compiled ? "built" : "dev"}, memory: ${memory.items.length} items, vision model: ${vlmEnabled() ? "on" : "off"})`)}`);
  console.log(`${dim("open the page, then type here. Try:")} ${cyan('hear "hello friend, I love you"')}\n`);
  startRepl(link, ROOT, url);
}

main().catch((e) => { console.error(e); process.exit(1); });
