<p align="center">
<img alt="Artificial Brain" src="assets/Vision.png" width="140">
</p>

<p align="center">
<a href="https://discord.com/users/thearijiiiitttt_"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
<a href="#-setup"><img alt="Node" src="https://img.shields.io/badge/node-18%2B-339933?style=flat-square&logo=node.js&logoColor=white" /></a>
<a href="#-setup"><img alt="Bun" src="https://img.shields.io/badge/bun-supported-f9f1e1?style=flat-square&logo=bun&logoColor=black" /></a>
</p>

<p align="center">
<b>Artificial Brain</b> : an artificial brain that runs in the browser and is driven from your terminal
</p>

> **New to this project?** Don’t worry this guide walks you through everything step by step, with no skipped steps.


## Table of Contents

1. [What is Artificial Brain?](#-what-is-artificial-brain)
2. [Before You Start](#-before-you-start)
3. [Installation](#-installation)
4. [Running the Brain](#-running-the-brain)
5. [Talking to the Brain](#-talking-to-the-brain)
6. [What Happens Inside](#-what-happens-inside)
7. [The Visual Brain](#-the-visual-brain)
8. [Plug into Artificial](#-plug-into-artificial)
9. [Honest Limits](#-honest-limits)
10. [Troubleshooting](#-troubleshooting)

<br/>

## What is Artificial Brain?

**Artificial Brain** is an artificial brain that runs **inside the browser** (dark theme, three anatomical views: left, right, top) and receives all its sensory input **from your terminal**.

It stays completely quiet until you give it something:

```
see   →  Artificial
hear  →  language / tone
smell →  olfactory
pain  →  nociception
```

```
terminal  ──►  senses + memory  ──►  browser brain  ──►  emotion + decision
   ▲                                                    │
   └────────────  “feels HAPPY ← NACC 83 %, VTA 75 %”  ◄┘
```

**What it actually does**
- Appraises every input for reward, threat, loss, anger, disgust, pain, social value, novelty, face presence and familiarity
- Stores and recognises past episodes
- Lights up real brain regions and white-matter pathways
- Simulates ten neuromodulators with visible chemistry
- Reads emotion out of the activity pattern (emotion is never hard-coded)
- Races ten possible actions and commits to one with a measurable reaction time
- Can stream its live state to a parent Artificial system

<br/>

## Before You Start

You need:
- **Node.js 18 or newer**
- Any modern browser
- (Optional) an OpenRouter API key if you want a real Artificial model to interpret images

No API key is required for the basic pixel-analysis + lexicon mode.

<br/>

## Installation

```bash
cd artificial-brain
npm install 
#OR
bun install
```

<br/>

## Running the Brain

```bash
npm run dev          # starts the server and bundles the browser app
                     # restart after you edit server code
```

Then open **http://localhost:7070**.

Production:

```bash
npm run build && npm start
```

Tests:

```bash
npm test
```

<br/>

## Talking to the Brain

Type commands in the **same terminal** that is running the server:

```bash
see ./inbox/photo.jpg --is "a smiling puppy"
see "C:\Users\me\Pictures\cobra.png" --is "a cobra"
hear "you are a stupid idiot, shut up!"
smell "rotten garbage"
pain 0.8 "touched a hot stove"
status
demo
```

`help` shows every command.

| Command | Effect |
| ------- | ------ |
| `see <path> [--is "..."]` | Feed an image + optional meaning |
| `hear "..."` | Feed text / spoken language |
| `smell "..."` | Feed an olfactory description |
| `pain <0–1> "..."` | Feed pain intensity + description |
| `status` | Print current emotion, decision and chemistry |
| `demo` | Run a short sequence of stimuli |
| `sleep` | Put the brain to sleep (slow waves) |
| `help` | List all commands |

<br/>

## What Happens Inside

1. **Senses** (`src/server/senses.ts`)  
   Turn raw input into an appraisal vector: reward, threat, loss, anger, disgust, pain, social, novelty, face, familiarity.  
   - Text is scored by a small affect lexicon that understands negation and intensifiers (`src/shared/lexicon.ts`).  
   - Images are analysed with `sharp` (brightness, colour, edges, skin-tone, red/dark dominance). Pixels alone cannot tell a cobra from a rope, so you can supply meaning with `--is "..."`, a descriptive filename, or set `OPENROUTER_API_KEY` + `OPENROUTER_Artificial_MODEL` (see `.env.example`).

2. **Memory** (`src/server/memory.ts` → `data/memory.json`)  
   The brain recognises previously seen images (fingerprint) and text (overlap). Familiar items become less novel and old feelings return. Every episode is stored together with how it felt.

3. **Where activity appears** (`src/shared/perception.ts`)  
   - Reward → VTA, nucleus accumbens, vmPFC, OFC  
   - Threat → amygdala, PAG, locus coeruleus, hypothalamus  
   - Loss → subgenual cingulate + dopamine dip  
   - Disgust → insula + olfactory cortex  
   - Anger → putamen, ACC, hypothalamus  
   - Pain → S1, insula, ACC, PAG  
   - Novelty → hippocampus, superior colliculus, LC

4. **Dynamics** (`src/shared/simulation.ts`)  
   77 nodes (37 regions, mostly bilateral), ~130 directed pathways (excitatory and inhibitory), global inhibition, adaptation, and ten neuromodulators (dopamine, serotonin, noradrenaline, adrenaline, cortisol, oxytocin, endorphin, acetylcholine, GABA, melatonin). Roughly 7 200 drawn neurons fire stochastically according to their region’s rate.

5. **Emotion is read out, never set** (`emotion.ts`)  
   Each emotion label is a weighted blend of the regions that implement it. The “because …” explanation is generated from the same activity pattern.

6. **Decision** (`decision.ts`)  
   A race among ten actions (observe, approach, greet, investigate, flee, freeze, confront, withdraw, reject, recoil). Evidence accumulates from regions, actions inhibit one another, noradrenaline lowers the threshold (urgency), a close race raises it (hesitation). The first action to cross the threshold commits and is logged with its reaction time.

7. **Sleep**  
   The `sleep` command gates the senses and introduces slow waves. Danger or pain wakes the brain.

<br/>

## The Visual Brain

The brain starts pure black-and-white. A region only receives its system colour (Artificial = cyan, reward = yellow, threat = red, …) while it is active, then fades back to grey. White-matter tracts light only when both ends are active.

**Chemistry is drawn inside the brain**:
- Soft halo at the release site (dopamine at VTA, serotonin at the raphe, noradrenaline at locus coeruleus, acetylcholine at basal forebrain…)
- Hollow rings that travel along pathways to the sites of action
- Faint whole-brain wash for the circulating chemicals (cortisol, adrenaline, GABA, melatonin)

Nothing is drawn until a chemical rises above its resting level, so the brain remains black-and-white until something actually happens.

Renderer details:
- ~38 000 neurons per view (≈ 30 000 on a gyri-patterned cortex, the rest in deep nuclei, cerebellum and brainstem)
- Per-pixel lighting (key light upper-left, specular highlight, glowing rim)
- Tone-mapping so bright regions never clip to flat white
- Bloom
- Spinal cord, arched corpus callosum and white-matter tracts
- Automatically reduces cortex density on slower machines

Slow machine? Open `http://localhost:7070/?density=0.6`.

Each of the three views slowly orbits. Drag any view to take manual control; it resumes spinning a moment after you release the mouse.

| Key | Action |
| --- | ------ |
| `L` | Toggle region labels |
| `E` | Toggle signal pathways |
| `R` | Toggle continuous spin |
| `P` | Pause / unpause |

### Brain Region Abbreviations

| Short | Full Name | Role in this model |
|-------|-----------|--------------------|
| **LGN** | Lateral Geniculate Nucleus | First relay for what the eyes see |
| **V1** | Primary Visual Cortex | Edges, light, contrast |
| **V2V4** | Extrastriate Visual Cortex (V2/V4) | Colour, shape, texture |
| **MT** | Motion Area (MT/V5) | Movement in the scene |
| **IT** | Inferior Temporal Cortex | Recognising what an object is |
| **FFA** | Fusiform Face Area | Faces |
| **MGN** | Medial Geniculate Nucleus | First relay for sound |
| **A1** | Primary Auditory Cortex | Pitch, loudness, timing |
| **WERN** | Wernicke’s Area | Understanding words |
| **BROCA** | Broca’s Area | Forming a reply |
| **S1** | Somatosensory Cortex | Touch, pressure, where it hurts |
| **M1** | Primary Motor Cortex | Sending movement commands |
| **PMC** | Premotor / Supplementary Motor | Planning movement |
| **PPC** | Posterior Parietal Cortex | Spatial attention |
| **CB** | Cerebellum | Smoothing and timing movement |
| **TPJ** | Temporoparietal Junction | What is that person thinking / feeling |
| **DLPFC** | Dorsolateral Prefrontal Cortex | Working memory, deliberate choice |
| **MPFC** | Medial Prefrontal Cortex | Self and other people |
| **VMPFC** | Ventromedial Prefrontal Cortex | Value, calming the amygdala |
| **OFC** | Orbitofrontal Cortex | How good or bad is this |
| **TPOLE** | Temporal Pole | Meaning of people and things |
| **ACC** | Anterior Cingulate Cortex | Conflict, effort, the “ouch” of pain |
| **SGACC** | Subgenual Cingulate | Sadness and low mood |
| **PCC** | Posterior Cingulate / Precuneus | Self, mind-wandering, rumination |
| **INS** | Insula | Gut feeling, disgust, pain, body state |
| **AMY** | Amygdala | Is this dangerous or important? |
| **HIPP** | Hippocampus | Have I seen this before; making memories |
| **PHC** | Parahippocampal / Entorhinal | Place and context memory |
| **HYP** | Hypothalamus | Stress hormones, body response |
| **NACC** | Nucleus Accumbens | Pleasure and wanting |
| **VTA** | Ventral Tegmental Area / Substantia Nigra | Dopamine: “that was better than expected” |
| **CAUD** | Caudate Nucleus | Goal-directed action choice |
| **PUT** | Putamen | Habit and motor selection |
| **THAL** | Thalamus | Routes everything to cortex |
| **OLF** | Olfactory (Piriform) Cortex | Smell (wired straight into emotion & memory) |
| **SC** | Superior Colliculus | Snap attention to sudden things |
| **PAG** | Periaqueductal Grey | Freeze / fight / flee, pain control |
| **LC** | Locus Coeruleus | Alertness (releases noradrenaline) |
| **RAPHE** | Raphe Nuclei | Mood stability and calm (releases serotonin) |
| **BF** | Basal Forebrain | Attention (releases acetylcholine) |
| **RF** | Reticular Formation / Brainstem | Wakefulness and basic arousal |

### Neuromodulators

| Short | Full Name | Rough role |
|-------|-----------|------------|
| dopamine | Dopamine | Reward, motivation, “better than expected” |
| serotonin | Serotonin | Mood stability, calm |
| noradrenaline | Noradrenaline (Norepinephrine) | Alertness, urgency |
| adrenaline | Adrenaline (Epinephrine) | Fight-or-flight circulating effect |
| cortisol | Cortisol | Stress hormone |
| oxytocin | Oxytocin | Social bonding / trust |
| endorphin | Endorphins | Pain relief / pleasure |
| acetylcholine | Acetylcholine | Attention, learning |
| gaba | GABA | Inhibition / calming the brain |
| melatonin | Melatonin | Sleep / circadian |

In the browser console the live simulation is available as `brain`.

<br/>

## Plug into Artificial

`integration/artificialBridge.ts` is a zero-dependency client:

```ts
const brain = new BrainClient("http://localhost:7070");
await brain.perceive({
  modality: "artificial",
  image: framePath,
  tag: "a person smiling"
});
const s = await brain.state();
// s.emotion, s.decision, s.ArtificialEmotion, s.ArtificialDecision
```

Six actions that Artificial’s enum does not yet contain (flee, freeze, confront, withdraw, reject, recoil) currently map to `IGNORE`. See Artificial’s `docs/architecture-map.md` §5 for how to add them.

**HTTP API**

| Endpoint | Method | Purpose |
| -------- | ------ | ------- |
| `/api/stimulus` | POST | Inject a sensory stimulus |
| `/api/state` | GET | Current emotion, decision, chemistry |
| `/api/stream` | GET | Live Server-Sent Events stream |

<br/>

## Honest Limits

- This is a **functional model**, not a biophysically accurate simulation. Anatomy and pathways follow real outlines; the numbers are tuned for sensible behaviour, not fitted to experimental data. Region positions are approximate and the cortical surface is stylised.
- The simulation lives in the browser tab. Close the tab and the brain stops (server and memory remain).
- Without a Artificial model the system only sees pixels plus the text hints you supply. The OpenRouter path is written to the documented format but has not been tested against a live key.
- Lexicon is English-only.
- The HUD and renderer were verified by headless frame capture. Please open the page once and report anything that looks wrong.

<br/>


## Troubleshooting

| Problem | Solution |
| ------- | -------- |
| Page stays completely black | Send a stimulus first (`see`, `hear`…). The brain is intentionally black-and-white until something happens. |
| Image produces weak or wrong reaction | Add `--is "clear description"` or configure an OpenRouter Artificial model. Raw pixels are limited. |
| Cannot reach the page | Make sure `npm run dev` is still running and you opened exactly `http://localhost:7070`. |
| Low frame rate | Open with `?density=0.6` (or lower) to draw fewer neurons. |
| Memory does not persist | Ensure the process can write to `data/memory.json`. |

<br/>
