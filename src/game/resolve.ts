import type {
  EnemyAction,
  Resolution,
  ResolutionLine,
  ResolvedNode,
} from "../types";
import { KEYWORDS, newAcc } from "./keywords";

// ============================================================
// The exchange resolver.
// Player-side effects are folded into an accumulator through the
// keyword registry (game/keywords.ts) — the resolver never
// switches on keyword names, so new verbs are added there, not
// here. The enemy-vs-defence interaction stays centralised:
//  - Sidestep at the action's beat negates the whole action.
//  - Defend is a numeric pool allocated across incoming hits.
//  - A fully prevented hit does not trigger its on-hit effects.
//  - A partially prevented hit still counts as a hit.
//  - Chain is earned when the enemy action is fully neutralised.
// Only SUCCESSFUL nodes contribute; missed nodes are dropped.
// ============================================================

export function resolveExchange(
  resolved: ResolvedNode[],
  action: EnemyAction
): Resolution {
  const lines: ResolutionLine[] = [];
  const good = (text: string) => lines.push({ text, tone: "good" });
  const bad = (text: string) => lines.push({ text, tone: "bad" });
  const neutral = (text: string) => lines.push({ text, tone: "neutral" });

  const landed = resolved.filter((r) => r.success && r.effect);

  // --- fold player output through the keyword registry ---
  const acc = newAcc();
  for (const r of landed) KEYWORDS[r.effect!.keyword].apply?.(acc, r.effect!.value ?? 0, r);

  const attack = acc.attack;
  const poison = acc.poison;

  if (attack > 0) good(`Attack ${attack} — strike lands on the Battery.`);
  if (poison > 0) good(`Poison ${poison} — rot takes hold.`);

  // --- enemy resolution, event by event across the beats ---
  // A Sidestep landed on a beat avoids every event on that beat; Defend is a
  // shared pool drawn down across the damaging events in beat order.
  let damageTaken = 0;
  let pushedBack = 0;
  let pool = acc.defend;
  let sidestepped = false; // did any event get sidestepped

  for (const ev of [...action.events].sort((a, b) => a.beat - b.beat)) {
    if (acc.sidestepBeats.has(ev.beat)) {
      sidestepped = true;
      good(`Sidestep on beat ${ev.beat} — that volley passes through empty air.`);
      continue;
    }
    const hitDamage = ev.perHit.find((e) => e.keyword === "damage")?.value ?? 0;
    const perHitMove = ev.perHit.find((e) => e.keyword === "move")?.value ?? 0;
    const onHitMove = ev.onHit.find((e) => e.keyword === "move")?.value ?? 0;
    for (let i = 0; i < ev.instances; i++) {
      if (hitDamage > 0) {
        const block = Math.min(pool, hitDamage);
        pool -= block;
        const remaining = hitDamage - block;
        if (remaining > 0) {
          damageTaken += remaining;
          pushedBack += Math.abs(onHitMove);
        }
      }
      pushedBack += Math.abs(perHitMove); // unblockable
    }
  }

  if (damageTaken > 0) bad(`${damageTaken} damage taken.`);
  if (pushedBack > 0) bad(`Knockback — driven back ${pushedBack}.`);
  // fully neutralised only if nothing at all got through, on any beat
  const neutralized = damageTaken === 0 && pushedBack === 0;
  if (neutralized) good(`Nothing gets through — ${action.name} is fully neutralised.`);

  // a player-side Move keyword resists forced movement (dormant until a
  // material provides it, but wired through the registry accumulator)
  if (acc.selfMove > 0 && pushedBack > 0) {
    const braced = Math.min(pushedBack, acc.selfMove);
    pushedBack -= braced;
    good(`Move ${acc.selfMove} — braced against ${braced} of the knockback.`);
  }

  const chainEarned = neutralized;
  if (chainEarned) {
    good("► ACTION NEUTRALISED — the opening holds. CHAIN!");
  } else {
    neutral("The opening closes. The approach resumes.");
  }

  return {
    lines,
    playerDamageDealt: attack + poison, // poison also chips this exchange for the slice
    poisonApplied: poison,
    damageTaken,
    pushedBack,
    sidestepped,
    actionNeutralized: neutralized,
    chainEarned,
  };
}
