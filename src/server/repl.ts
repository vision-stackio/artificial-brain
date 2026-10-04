import fs from "fs";
import path from "path";
import readline from "readline";
import { BrainLink } from "./link";
import { EMOTION_COLOR, bold, cyan, dim, green, grey, red, tokenize, yellow } from "./term";
import { EmotionLabel, Modality } from "../shared/types";
import { CHEMS } from "../shared/chem";

const EMOTIONS: EmotionLabel[] = ["HAPPY", "EXCITED", "FEARFUL", "ANGRY", "DISGUSTED", "SAD", "PAIN", "CURIOUS", "SURPRISED"];
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?|avif)$/i;

const HELP = `
${bold("Give him senses")}  (nothing reaches the brain until you say so)
  ${cyan("see")} <image path | url> [--is "what it is"]   show him a picture
  ${cyan("see")}                                          show him the next unseen file in ./inbox
  ${cyan("hear")} <words or sound description>            something he hears, e.g.  hear "you are an idiot!"
  ${cyan("read")} <text>        ${cyan("smell")} <thing>        ${cyan("taste")} <thing>        ${cyan("touch")} <thing>
  ${cyan("pain")} [0-1] [what]                             a pain signal, e.g.  pain 0.8 "burnt my hand"
  ${cyan("think")} <thought>                               an internal thought / memory recall
  options on any of them:  --i 0.9 (strength 0-1)   --dur 6 (seconds)

${bold("The brain")}
  ${cyan("status")}              what he feels and wants to do right now
  ${cyan("feel")} <emotion> [0-1] force a feeling directly (${EMOTIONS.join(", ").toLowerCase()})
  ${cyan("sleep")} / ${cyan("wake")}      ${cyan("reset")}   calm everything down
  ${cyan("memory")}              what he remembers      ${cyan("forget")}   wipe memory
  ${cyan("demo")}                a scripted tour of different feelings

${cyan("help")}  ${cyan("exit")}
`;

export function startRepl(link: BrainLink, rootDir: string, url: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${bold("brain")} ${grey(">")} ` });
  const seenInbox = new Set<string>();
  let closed = false, wantsExit = false;

  const log = (msg = "") => {
    readline.clearLine(process.stdout, 0); readline.cursorTo(process.stdout, 0);
    console.log(msg);
    rl.prompt(true);
  };

  link.on((m) => {
    if (m.type === "emotion") {
      const col = EMOTION_COLOR[m.event.emotion] ?? grey;
      log(`  ${dim("brain")}  feels ${col(bold(m.event.emotion))} ${dim(`${Math.round(m.event.intensity * 100)}%`)}  ${dim("<-")} ${m.event.because || "baseline"}`);
    } else if (m.type === "decision") {
      const d = m.event;
      log(`  ${dim("brain")}  decides ${green(bold(d.action))} ${dim(`conf ${Math.round(d.confidence * 100)}%${d.reactionMs ? `, ${d.reactionMs} ms` : ""}`)}  ${dim("<-")} ${d.because}`);
    } else if (m.type === "episode") {
      log(`  ${dim("memory")} stored: felt ${m.peak.toLowerCase()} (valence ${m.valence >= 0 ? "+" : ""}${m.valence.toFixed(2)})`);
    }
  });
  link.hub.onConnect = (n) => log(`  ${green("browser connected")} ${dim(`(${n})`)}`);
  link.hub.onDisconnect = (n) => log(`  ${yellow("browser disconnected")} ${dim(`(${n} left)`)}`);

  const nextInbox = (): string | null => {
    const dir = path.join(rootDir, "inbox");
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f)).sort();
    const f = files.find((x) => !seenInbox.has(x)) ?? files[0];
    if (!f) return null;
    seenInbox.add(f);
    return path.join(dir, f);
  };

  async function perceive(modality: Modality, args: string[]) {
    // pull out flags
    let tag: string | undefined, intensity: number | undefined, duration: number | undefined;
    const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--is") tag = args[++i];
      else if (args[i] === "--i" || args[i] === "--intensity") intensity = Number(args[++i]);
      else if (args[i] === "--dur") duration = Number(args[++i]);
      else rest.push(args[i]);
    }
    let level: number | undefined, text = rest.join(" ");
    if (modality === "vision") {
      const target = rest[0] ?? nextInbox();
      if (!target) return log(red("  give me an image path/URL, or drop files in ./inbox"));
      text = target;
    } else if (modality === "pain") {
      if (rest[0] && !Number.isNaN(Number(rest[0]))) { level = Number(rest[0]); text = rest.slice(1).join(" "); }
    }
    try {
      const res = await link.perceive({ modality, text: modality === "vision" ? undefined : text, image: modality === "vision" ? text : undefined, level, tag, intensity, duration });
      const s = res.stimulus;
      log(`  ${bold(modality === "vision" ? "sees" : modality === "audio" ? "hears" : modality === "text-read" ? "reads" : modality === "pain" ? "feels" : modality)} ${cyan(`"${s.label}"`)} ${dim(`(${s.source}, strength ${Math.round(s.intensity * 100)}%)`)}`);
      for (const n of res.notes) log(`    ${dim(n)}`);
      const top = Object.entries(s.appraisal).filter(([k, v]) => !["valence", "arousal", "familiarity"].includes(k) && (v as number) > 0.3).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 4);
      if (top.length) log(`    ${dim("appraisal:")} ${top.map(([k, v]) => `${k} ${Math.round((v as number) * 100)}%`).join(", ")}`);
      if (!res.delivered) log(yellow(`  nobody is listening: open ${url} so the brain can react`));
    } catch (e) { log(red(`  ${(e as Error).message}`)); }
  }

  async function handle(line: string) {
    const t = tokenize(line.trim());
    if (!t.length) return;
    const [cmd, ...args] = t;
    switch (cmd.toLowerCase()) {
      case "help": case "?": console.log(HELP); break;
      case "see": case "look": await perceive("vision", args); break;
      case "hear": case "listen": await perceive("audio", args); break;
      case "read": await perceive("text-read", args); break;
      case "smell": await perceive("smell", args); break;
      case "taste": await perceive("taste", args); break;
      case "touch": await perceive("touch", args); break;
      case "think": await perceive("thought", args); break;
      case "pain": await perceive("pain", args); break;
      case "feel": {
        const e = (args[0] ?? "").toUpperCase() as EmotionLabel;
        if (!EMOTIONS.includes(e)) return log(red(`  emotions: ${EMOTIONS.join(", ").toLowerCase()}`));
        link.force(e, args[1] ? Number(args[1]) : 0.8);
        break;
      }
      case "sleep": case "wake": case "reset": link.command(cmd.toLowerCase() as "sleep" | "wake" | "reset"); log(dim(`  ${cmd} sent`)); break;
      case "status": {
        const s = link.state;
        if (!s) return log(yellow(`  no brain connected yet: open ${url}`));
        const col = EMOTION_COLOR[s.emotion] ?? grey;
        const n = s.neuromodulators;
        console.log(`  state     ${s.asleep ? "asleep" : "awake"}   t=${s.time.toFixed(1)}s`);
        console.log(`  feels     ${col(bold(s.emotion))} ${dim(`${Math.round(s.intensity * 100)}%`)}   valence ${s.valence.toFixed(2)}   arousal ${s.arousal.toFixed(2)}`);
        console.log(`  wants to  ${green(bold(s.decision))} ${dim(`conf ${Math.round(s.decisionConfidence * 100)}%`)}`);
        console.log(`  chemistry ${CHEMS.map((c) => `${c.label} ${Math.round(n[c.id] * 100)}`).join("  ")}`);
        console.log(`  busiest   ${s.topRegions.slice(0, 6).map((r) => `${r.node} ${Math.round(r.rate * 100)}%`).join("  ")}`);
        break;
      }
      case "memory": {
        const items = link.memory.items;
        if (!items.length) return log(dim("  no memories yet"));
        for (const it of items.slice(-15)) console.log(`  ${dim(it.kind.padEnd(5))} ${it.label.padEnd(36)} seen ${it.seen}x  ${it.peak.toLowerCase().padEnd(10)} ${it.valence >= 0 ? "+" : ""}${it.valence.toFixed(2)}`);
        break;
      }
      case "forget": link.memory.clear(); log(dim("  memory wiped")); break;
      case "demo": await demo(); break;
      case "exit": case "quit": wantsExit = true; rl.close(); break;
      default: log(red(`  unknown command "${cmd}" (try help)`));
    }
  }

  async function demo() {
    const steps: [Modality, string, string?][] = [
      ["audio", "hello my dear friend, I brought you a gift! I love you"],
      ["smell", "rotten garbage, disgusting and filthy"],
      ["text-read", "a cobra is on the road, run!!"],
      ["audio", "you are a stupid idiot, shut up!"],
      ["text-read", "my grandmother passed away, I feel so alone"],
      ["thought", "a weird glowing object floating in the sky"],
      ["pain", "0.8", "hand touched a hot stove"],
    ];
    log(dim("  demo: one stimulus every 9 seconds, watch the browser"));
    for (const [m, a, b] of steps) {
      if (closed) return;
      if (m === "pain") await perceive("pain", [a, b ?? ""]); else await perceive(m, [a]);
      await new Promise((r) => setTimeout(r, 9000));
    }
    log(dim("  demo finished"));
  }

  console.log(HELP);
  rl.prompt();
  rl.on("line", async (l) => { await handle(l); rl.prompt(); });
  rl.on("close", () => {
    closed = true;
    // typed exit / Ctrl+D in a real terminal quits; with no terminal attached (service, pipe) keep serving
    if (process.stdin.isTTY || wantsExit) { console.log("\nbye"); process.exit(0); }
  });
  return { log };
}
