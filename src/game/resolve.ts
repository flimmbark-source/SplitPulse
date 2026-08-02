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
  const defendPool = acc.defend;
  const sidestepAtActionBeat = acc.sidestepBeats.has(action.beat);

  if (attack > 0) good(`Attack ${attack} — strike lands on the Battery.`);
  if (poison > 0) good(`Poison ${poison} — rot takes hold.`);

  // --- enemy resolution ---
  const hitDamage = action.perHit.find((e) => e.keyword === "damage")?.value ?? 0;
  const perHitMove = action.perHit.find((e) => e.keyword === "move")?.value ?? 0; // unblockable
  const onHitMove = action.onHit.find((e) => e.keyword === "move")?.value ?? 0;

  let damageTaken = 0;
  let pushedBack = 0;
  let neutralized = false;
  let sidestepped = false;

  if (sidestepAtActionBeat) {
    sidestepped = true;
    neutralized = true;
    good(`Sidestep on beat ${action.beat} — ${action.name} passes through empty air.`);
  } else {
    let pool = defendPool;
    let hitsThatLanded = 0;
    let fullyBlocked = 0;

    for (let i = 0; i < action.instances; i++) {
      // Defend mitigates damage; Move payloads are unblockable
      if (hitDamage > 0) {
        const block = Math.min(pool, hitDamage);
        pool -= block;
        const remaining = hitDamage - block;
        if (remaining > 0) {
          damageTaken += remaining;
          hitsThatLanded++;
          pushedBack += Math.abs(onHitMove);
        } else {
          fullyBlocked++;
        }
      }
      // an unblockable Move payload always lands (only Sidestep avoids it)
      pushedBack += Math.abs(perHitMove);
    }

    if (defendPool > 0 && hitDamage > 0) {
      neutral(`Defend ${defendPool} — ${fullyBlocked} of ${action.instances} absorbed.`);
    }
    if (damageTaken > 0) bad(`${damageTaken} damage taken.`);
    if (pushedBack > 0) bad(`Knockback — driven back ${pushedBack}.`);
    // fully neutralised only if nothing at all got through
    neutralized = damageTaken === 0 && pushedBack === 0;
    if (neutralized) good("Nothing gets through — the action is fully neutralised.");
  }

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
