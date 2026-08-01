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
- **Approach** — a hand-rolled pseudo-3D first-person renderer drawn to a tiny
  `320×180` buffer and scaled up nearest-neighbour for a PS1 look (fog, a
  perspective grid, vertex snapping, incoming missiles with directional dodge
  telegraphs).
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

`Vite · TypeScript · React · Zustand · SVG · Canvas 2D · WebAudio`

The 3D approach is a bespoke Canvas renderer (no engine) so the PS1 aesthetic
and the deterministic timeline stay fully under our control; the musical layer is
a small procedural WebAudio synth so each node carries its own tone and misses
leave audible holes — no audio assets required.

## Layout

```
src/
  data/content.ts     materials, abilities, the Cinder Battery
  game/resolve.ts     the deterministic exchange resolver (authority)
  game/nodes.ts       node → effect / colour / glyph helpers
  store.ts            Zustand game-state machine
  audio.ts            procedural WebAudio synth
  components/         Diagram (SVG), Toolbelt, EnemyPreview, Hud
  phases/             Title · Gather · Approach · Configure · Execute · Resolve · EndScreen
```
