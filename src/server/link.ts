import { BrainReport, ClientToServer, Modality, ServerToClient, Stimulus } from "../shared/types";
import { Hub } from "./hub";
import { Memory } from "./memory";
import { SenseOpts, SenseResult, Senses } from "./senses";
import { vlmEnabled } from "./vlm";

export interface PerceiveInput {
  modality: Modality;
  text?: string;
  image?: string;       // path or URL
  level?: number;       // pain level
  tag?: string;
  intensity?: number;
  duration?: number;
}

type Listener = (m: ClientToServer) => void;

/** Ties the senses, the memory and the browser together. The terminal and the HTTP API both go through here. */
export class BrainLink {
  readonly memory: Memory;
  readonly senses: Senses;
  private listeners: Listener[] = [];
  lastStimulus: Stimulus | null = null;

  constructor(readonly hub: Hub, memory: Memory) {
    this.memory = memory;
    this.senses = new Senses(memory);
    hub.onMessage = (m) => {
      if (m.type === "episode" && m.memoryKey) this.memory.learn(m.memoryKey, m.valence, m.arousal, m.peak);
      for (const l of this.listeners) l(m);
    };
  }

  helloMessage(): ServerToClient { return { type: "hello", memoryCount: this.memory.items.length, hasVlm: vlmEnabled() }; }
  on(l: Listener) { this.listeners.push(l); }
  get connected() { return this.hub.clientCount > 0; }
  get state(): BrainReport | null { return this.hub.latest; }

  async perceive(i: PerceiveInput): Promise<SenseResult & { delivered: boolean }> {
    const opts: SenseOpts = { tag: i.tag, intensity: i.intensity, duration: i.duration };
    let res: SenseResult;
    switch (i.modality) {
      case "vision":
        if (!i.image) throw new Error("vision needs an image path or URL");
        res = await this.senses.see(i.image, opts);
        break;
      case "pain": res = this.senses.pain(i.level ?? 0.7, i.text ?? ""); break;
      default:
        if (!i.text) throw new Error(`${i.modality} needs some text describing it`);
        res = this.senses.text(i.modality, i.text, opts);
    }
    this.lastStimulus = res.stimulus;
    const delivered = this.hub.send({ type: "stimulus", stimulus: res.stimulus });
    return { ...res, delivered };
  }

  command(cmd: "sleep" | "wake" | "reset") { return this.hub.send({ type: "command", cmd }); }
  force(emotion: Extract<ServerToClient, { type: "force" }>["emotion"], level: number) { return this.hub.send({ type: "force", emotion, level }); }
}
