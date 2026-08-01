import type {
  EnemyAction,
  Resolution,
  ResolutionLine,
  ResolvedNode,
} from "../types";

// ============================================================
// The exchange resolver.
// Implements the rules fixed in the design doc §6.3 / §8:
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

  // --- aggregate player output ---
  let attack = 0;
  let poison = 0;
  let defendPool = 0;
  let sidestepAtActionBeat = false;

  for (const r of landed) {
    const e = r.effect!;
    switch (e.keyword) {
      case "attack":
        attack += e.value ?? 0;
        break;
      case "poison":
        poison += e.value ?? 0;
        break;
      case "defend":
      case "guard":
        defendPool += e.value ?? 0;
        break;
      case "sidestep":
        if (r.node.beat === action.beat) sidestepAtActionBeat = true;
        break;
    }
  }

  if (attack > 0) good(`Attack ${attack} — strike lands on the Battery.`);
  if (poison > 0) good(`Poison ${poison} — rot takes hold.`);

  // --- enemy resolution ---
  const hitDamage = action.perHit.find((e) => e.keyword === "damage")?.value ?? 0;
  const onHitMove = action.onHit.find((e) => e.keyword === "move")?.value ?? 0;

  let damageTaken = 0;
  let pushedBack = 0;
  let neutralized = false;
  let sidestepped = false;

  if (sidestepAtActionBeat) {
    sidestepped = true;
    neutralized = true;
    good(
      `Sidestep on beat ${action.beat} — all ${action.instances} shots pass through empty air.`
    );
  } else {
    let pool = defendPool;
    let hitsThatLanded = 0;
    let fullyBlocked = 0;

    for (let i = 0; i < action.instances; i++) {
      const block = Math.min(pool, hitDamage);
      pool -= block;
      const remaining = hitDamage - block;
      if (remaining > 0) {
        damageTaken += remaining;
        hitsThatLanded++;
        // on-hit effects trigger only on a hit that is NOT fully prevented
        pushedBack += Math.abs(onHitMove);
      } else {
        fullyBlocked++;
      }
    }

    if (defendPool > 0) {
      neutral(
        `Defend ${defendPool} pool — ${fullyBlocked} shot${fullyBlocked === 1 ? "" : "s"} fully absorbed.`
      );
    }
    if (hitsThatLanded > 0) {
      bad(
        `${hitsThatLanded} shot${hitsThatLanded === 1 ? "" : "s"} land — ${damageTaken} damage taken.`
      );
      if (pushedBack > 0)
        bad(`Knockback — driven back ${pushedBack} unit${pushedBack === 1 ? "" : "s"}.`);
    }
    neutralized = hitsThatLanded === 0;
    if (neutralized && defendPool > 0)
      good("Every shot absorbed — the action is fully neutralised.");
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
