# SPLITPULSE

An on-rails, first-person **alchemical action rhythm** prototype.

You advance through danger on rails, read the enemy's next move, build a timed
response out of a **fixed ability diagram** and scavenged **materials**, then
**perform that response in rhythm**. The parts of the phrase you strike become
real; the parts you miss just go dark.

This is a vertical slice that proves one complete combat exchange end-to-end,
per §14 (Prototype Scope) of the design document.

---

## Play

```bash
npm install
npm run dev      # open the printed localhost URL
```

`npm run build` type-checks and produces a static `dist/` you can host anywhere.

### Controls

| Phase | Keys | Action |
| --- | --- | --- |
| **Title** | `Enter` / `Space` | Begin a run |
| **Gather** | `F` `J` `K` | Collect a material into the belt (timed) |
| | `Space` | Head to the fight |
| **Approach** | `← ↑ → ↓` | Dodge the incoming shot in its telegraphed direction |
| **Configure** | `← →` | Cycle ability |
| | `1…n` | Select an open slot |
| | `Q…Y` | Insert a belt material into the selected slot |
| | `⌫` | Clear the slot · `Space` commit & execute |
| **Execute** | shown letter keys | Strike each node as its ring snaps shut |
| **Resolve** | `Space` | Continue (chain, or back to the approach) |

---

## The three worlds

The prototype deliberately runs **two visual languages** at once, exactly as the
design doc frames it: the physical world is *crude, low-resolution and unstable*;
the alchemical system is *precise, geometric and unnaturally clear*.

- **Gather** — a keyboard-labelled point-and-click diorama on a timer.
- **Approach** — a real low-poly 3D arena (React Three Fiber) rendered to a low
  internal resolution and scaled up nearest-neighbour for a PS1 look. The player
  is *carried along authored spline paths* through the space (no free steering);
  a tracking camera holds the enemy in frame; hits knock you **back along the
  route**; reaching the attack position opens the exchange. Dodges are relative
  to your current facing, and each incoming shot shows a crisp dodge telegraph.
- **Configure / Execute** — razor-sharp SVG diagrams layered over the world,
  with a diagonal split-screen showing your performed phrase against the enemy's
  fixed action timeline.

---

## The combat rules (the authority)

`src/game/resolve.ts` is the single source of truth for an exchange. It
implements the rules fixed in the design doc:

- Only **successful** nodes contribute; a missed node removes only its own
  effect and never cancels the phrase.
- **Sidestep** on the enemy action's beat negates the *entire* action.
- **Defend** is a numeric pool allocated across incoming hits.
- A **fully prevented** hit does not trigger its attached *on-hit* effects; a
  **partially** prevented hit still counts as a hit.
- A **Chain** is earned when the enemy action is fully neutralised (sidestepped,
  or every shot absorbed) — the opening holds and you configure again.

The canonical worked example from §6.3 resolves exactly as written: against the
Cinder Battery's three `Damage 2` missiles, landing `Defend 2` fully blocks one
missile, the other two deal **4** damage, and their on-hit `Move` pushes you
back **2**.

Everything visual *consumes* this timeline; nothing visual redefines it.

---

## Content in this slice

- **Materials** — Emberdust (`Attack 2`), Tidebrass (`Defend 2`),
  Nightcap Spore (`Poison 2`), each with limited charges.
- **Abilities** — *Basic Strike* (one fixed strike + one slot) and *Prism Step*
  (a dodging phrase with a fixed Sidestep on beat 3 and two colouring slots —
  the chain-capable answer to the enemy).
- **Enemy** — the *Cinder Battery*: fires 3 missiles on beat 3, each `Damage 2`,
  `Move -1` on hit. Its details stay **unlearned** until you've seen it resolve.

---

## Stack

`Vite · TypeScript · React · Zustand · React Three Fiber / three / drei · SVG · WebAudio`

The arena is React Three Fiber over three.js, driven by an authored segment
graph of Catmull–Rom spline paths and named markers (`PATH_*`,
`ATTACK_POSITION_*`, `CAMERA_LOOK_TARGET`) — no navmesh, no AI, just curves. The
alchemical interface stays SVG layered over the world. The musical layer is a
small procedural WebAudio synth so each node carries its own tone and misses
leave audible holes — no audio assets required. The 3D chunk is code-split and
loads only when the fight begins.

## Layout

```
src/
  data/content.ts     materials, abilities, the Cinder Battery
  game/resolve.ts     the deterministic exchange resolver (authority)
  game/nodes.ts       node → effect / colour / glyph helpers
  arena/graph.ts      named markers + spline segment graph (authored traversal)
  arena/Scene.tsx     low-poly environment, landmarks, enemy turret (R3F)
  arena/ArenaRig.tsx  spline traversal, tracking camera, relative dodges, shots
  store.ts            Zustand game-state machine
  audio.ts            procedural WebAudio synth
  components/         Diagram (SVG), Toolbelt, EnemyPreview, Hud
  phases/             Title · Gather · Approach · Configure · Execute · Resolve · EndScreen
```
