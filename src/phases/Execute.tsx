import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../store";
import Diagram, { type ExecState } from "../components/Diagram";
import { effectLabel, keyColor, nodeEffect } from "../game/nodes";
import { KEYWORDS } from "../game/keywords";
import { resolveExchange } from "../game/resolve";
import { actionBeats, actionToDiagram, describeAction } from "../data/content";
import { sfx } from "../audio";
import WeaponPov from "../execute/WeaponPov";
import { anchorFor, clamp01 } from "../execute/anchors";
import type { ResolvedNode } from "../types";

const BEAT_MS = 620;
const LEAD_IN = 1300; // count-in before beat 1
const RING_LEAD = 860; // how long the ring contracts before target
const WINDOW = 150; // ± hit window (ms)
const END_PAD = 900;

type Status = "pending" | "hit" | "miss";

export default function Execute() {
  const { abilities, selectedAbility, assignments, belt, enemyLearned, enemyAction, commitExecution } =
    useGame();
  const ability = abilities[selectedAbility];
  const action = enemyAction;

  const nodes = useMemo(
    () => [...ability.nodes].sort((a, b) => a.beat - b.beat),
    [ability]
  );
  const targetOf = (beat: number) => LEAD_IN + (beat - 1) * BEAT_MS;
  const eventBeats = useMemo(() => actionBeats(action), [action]);
  const lastEnemyBeat = Math.max(...eventBeats);
  const enemyResolve = targetOf(lastEnemyBeat); // when the whole action is settled
  const totalInstances = action.events.reduce((s, e) => s + e.instances, 0);
  const lastTarget = Math.max(...nodes.map((n) => targetOf(n.beat)), enemyResolve);

  const statusRef = useRef<Record<string, Status>>(
    Object.fromEntries(nodes.map((n) => [n.id, "pending" as Status]))
  );
  const startRef = useRef(0);
  const finishedRef = useRef(false);
  const firedBeatsRef = useRef<Set<number>>(new Set());
  const outcomeRef = useRef(false);
  const lastBeatTickRef = useRef(0);

  const [now, setNow] = useState(0);
  const [flash, setFlash] = useState<null | "hit" | "avoid">(null);
  // damage / effect numbers that pop at a node's strike anchor on a hit
  const [hits, setHits] = useState<
    { id: number; x: number; y: number; text: string; color: string }[]
  >([]);
  const hitIdRef = useRef(0);
  const [enemyFx, setEnemyFx] = useState<
    null | { dmg: number; push: number; sidestep: boolean; neutral: boolean }
  >(null);

  // ---- finish + resolve ----
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const resolved: ResolvedNode[] = ability.nodes.map((n) => {
      const { effect, materialKey } = nodeEffect(n, assignments, belt);
      return { node: n, effect, materialKey, success: statusRef.current[n.id] === "hit" };
    });
    const res = resolveExchange(resolved, action);
    if (res.chainEarned) sfx.chain();
    else if (res.damageTaken > 0) sfx.impact();
    setTimeout(() => commitExecution(resolved, res), 650);
  };

  // ---- key input ----
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const t = performance.now() - startRef.current;
      // nearest pending node with this key inside the window
      let best: string | null = null;
      let bestDelta = Infinity;
      for (const n of nodes) {
        if (n.execKey !== key) continue;
        if (statusRef.current[n.id] !== "pending") continue;
        const d = Math.abs(t - targetOf(n.beat));
        if (d < bestDelta) {
          bestDelta = d;
          best = n.id;
        }
      }
      if (best && bestDelta <= WINDOW) {
        statusRef.current[best] = "hit";
        const node = nodes.find((n) => n.id === best)!;
        const { effect } = nodeEffect(node, assignments, belt);
        switch (effect?.keyword) {
          case "attack": sfx.attack(); break;
          case "defend": case "guard": sfx.defend(); break;
          case "poison": sfx.poison(); break;
          case "sidestep": sfx.sidestep(); break;
          default: sfx.hit(node.beat);
        }
        // the strike CONNECTS: pop its number at the anchor
        if (effect) {
          const a = anchorFor(node.execKey);
          const id = hitIdRef.current++;
          const color = effect.keyword === "attack" || effect.keyword === "poison"
            ? KEYWORDS[effect.keyword].color
            : keyColor(node.execKey, KEYWORDS[effect.keyword].color);
          setHits((h) => [...h, { id, x: a.x, y: a.y, text: effectLabel(effect), color }]);
          setTimeout(() => setHits((h) => h.filter((x) => x.id !== id)), 850);
        }
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // ---- clock ----
  useEffect(() => {
    startRef.current = performance.now();
    let raf = 0;
    const loop = () => {
      const t = performance.now() - startRef.current;
      setNow(t);
      if (import.meta.env.DEV) (window as unknown as { __exec: { now: number } }).__exec = { now: t };

      // count-in / beat ticks
      const beatIdx = Math.floor((t - LEAD_IN) / BEAT_MS);
      if (t < LEAD_IN) {
        const preTick = Math.floor(t / BEAT_MS);
        if (preTick !== lastBeatTickRef.current) {
          lastBeatTickRef.current = preTick;
          sfx.clock();
        }
      } else if (beatIdx !== lastBeatTickRef.current) {
        lastBeatTickRef.current = beatIdx;
        sfx.clock();
      }

      // auto-miss expired nodes
      for (const n of nodes) {
        if (statusRef.current[n.id] === "pending" && t > targetOf(n.beat) + WINDOW) {
          statusRef.current[n.id] = "miss";
          sfx.miss();
        }
      }

      // enemy fires on EACH of its event beats (visual + sound)
      for (const eb of eventBeats) {
        if (!firedBeatsRef.current.has(eb) && t >= targetOf(eb)) {
          firedBeatsRef.current.add(eb);
          sfx.enemyFire();
        }
      }

      // the OUTCOME is only decided once the LAST event's window has closed
      // (a Sidestep can land up to WINDOW ms after its beat). Only then do we
      // show the real numbers — so the popup can never contradict the chain.
      if (!outcomeRef.current && t >= enemyResolve + WINDOW + 60) {
        outcomeRef.current = true;
        const snapshot: ResolvedNode[] = ability.nodes.map((n) => {
          const { effect, materialKey } = nodeEffect(n, assignments, belt);
          return { node: n, effect, materialKey, success: statusRef.current[n.id] === "hit" };
        });
        const res = resolveExchange(snapshot, action);
        setEnemyFx({
          dmg: res.damageTaken,
          push: res.pushedBack,
          sidestep: res.sidestepped,
          neutral: res.actionNeutralized,
        });
        setTimeout(() => setEnemyFx(null), 1500);
        if (res.sidestepped || res.actionNeutralized) {
          setFlash("avoid");
          sfx.sidestep();
        } else {
          setFlash("hit");
          sfx.impact();
        }
        setTimeout(() => setFlash(null), 400);
      }

      if (t > lastTarget + END_PAD) {
        finish();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- derive exec visual state ----
  const exec: ExecState = useMemo(() => {
    const ring: Record<string, number> = {};
    for (const n of nodes) {
      const target = targetOf(n.beat);
      const p = (now - (target - RING_LEAD)) / RING_LEAD;
      ring[n.id] = Math.max(-1, Math.min(1, p));
    }
    // travelling pulse: find the edge whose beat span contains `now`
    let pulse: ExecState["pulse"] = null;
    for (const [from, to] of ability.edges) {
      const nf = ability.nodes.find((n) => n.id === from)!;
      const nt = ability.nodes.find((n) => n.id === to)!;
      const tf = targetOf(nf.beat);
      const tt = targetOf(nt.beat);
      if (now >= tf && now <= tt && tt > tf) {
        pulse = { from, to, p: (now - tf) / (tt - tf) };
        break;
      }
    }
    return { nodeState: { ...statusRef.current }, ring, pulse };
  }, [now, nodes, ability]);

  // ---- enemy exec state (same grammar, but authored & auto-resolving) ----
  const enemyDiagram = useMemo(() => actionToDiagram(action), [action]);
  const enemyExec: ExecState = useMemo(() => {
    const ring: Record<string, number> = {};
    const nodeState: Record<string, "pending" | "hit" | "miss"> = {};
    for (const n of enemyDiagram.nodes) {
      const target = targetOf(n.beat);
      ring[n.id] = Math.max(-1, Math.min(1, (now - (target - RING_LEAD)) / RING_LEAD));
      // charge nodes light as the pulse passes; the FIRE node lights on its beat
      nodeState[n.id] = now >= target ? "hit" : "pending";
    }
    let pulse: ExecState["pulse"] = null;
    for (const [from, to] of enemyDiagram.edges) {
      const nf = enemyDiagram.nodes.find((n) => n.id === from)!;
      const nt = enemyDiagram.nodes.find((n) => n.id === to)!;
      const tf = targetOf(nf.beat);
      const tt = targetOf(nt.beat);
      if (now >= tf && now <= tt && tt > tf) {
        pulse = { from, to, p: (now - tf) / (tt - tf) };
        break;
      }
    }
    return { nodeState, ring, pulse };
  }, [now, enemyDiagram]);

  const displayBeat = Math.max(0, Math.min(ability.beats, Math.floor((now - LEAD_IN) / BEAT_MS) + 1));
  const counting = now < LEAD_IN;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#05030a", overflow: "hidden" }}>
      {/* diagonal luminous divider — the seam between the two worlds */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          width: 2,
          height: "140%",
          background: "linear-gradient(180deg, transparent, var(--pulse), var(--attack), transparent)",
          transform: "rotate(8deg)",
          boxShadow: "0 0 20px rgba(108,240,255,0.5)",
          opacity: 0.55,
          zIndex: 5,
        }}
      />

      {/* shared beat readout, straddling the seam */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          zIndex: 8,
        }}
      >
        <div className="tag">beat</div>
        <div style={{ fontFamily: "var(--display)", fontSize: 34, lineHeight: 1 }}>
          {counting ? "—" : displayBeat}
          <span className="dim" style={{ fontSize: 16 }}> / {ability.beats}</span>
        </div>
      </div>

      {/* PLAYER SIDE — first-person weapon POV with aligned 2D prompts */}
      <section
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <WeaponPov
          startRef={startRef}
          nodes={nodes}
          statusRef={statusRef}
          leadIn={LEAD_IN}
          beatMs={BEAT_MS}
          ringLead={RING_LEAD}
        />

        {/* header */}
        <div style={{ position: "absolute", top: 56, left: 30, zIndex: 4 }}>
          <div className="tag" style={{ color: "var(--pulse)" }}>you · performed</div>
          <div className="display-title">{ability.name}</div>
        </div>

        {/* node prompts, aligned to each key's strike anchor */}
        {nodes.map((n) => {
          const target = targetOf(n.beat);
          if (now < target - RING_LEAD - 40 || now > target + 340) return null;
          const a = anchorFor(n.execKey);
          const ringP = clamp01(exec.ring[n.id]);
          const st = exec.nodeState[n.id];
          const kc = keyColor(n.execKey, "var(--pulse)");
          const { effect } = nodeEffect(n, assignments, belt);
          const ic = effect ? KEYWORDS[effect.keyword].color : "var(--ink-dim)";
          const ringSize = 44 + (1 - ringP) * 74;
          const ringCol = st === "hit" ? "var(--hit)" : ringP > 0.82 ? "var(--hit)" : kc;
          return (
            <div
              key={n.id}
              className="pop"
              style={{
                position: "absolute",
                left: `${a.x * 100}%`,
                top: `${a.y * 100}%`,
                transform: "translate(-50%,-50%)",
                zIndex: 4,
                opacity: st === "miss" ? 0.3 : 1,
                transition: "opacity 0.2s linear",
              }}
            >
              {/* contracting timing ring */}
              {st === "pending" && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: ringSize,
                    height: ringSize,
                    transform: "translate(-50%,-50%)",
                    borderRadius: "50%",
                    border: `2px solid ${ringCol}`,
                    boxShadow: `0 0 14px ${ringCol}`,
                  }}
                />
              )}
              {/* effect icon, tight above */}
              {effect && (
                <div
                  style={{
                    position: "absolute",
                    top: -22,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: ic,
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {KEYWORDS[effect.keyword].glyph}
                </div>
              )}
              {/* the key */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: `2px solid ${st === "hit" ? "var(--hit)" : kc}`,
                  background: st === "hit" ? "var(--hit)" : "#0c0c16",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: st === "hit" ? "#0c0c16" : kc,
                  fontFamily: "var(--mono)",
                  fontWeight: 700,
                  boxShadow: `0 0 16px ${st === "hit" ? "var(--hit)" : kc}`,
                }}
              >
                {n.execKey}
              </div>
            </div>
          );
        })}

        {/* strike numbers */}
        {hits.map((h) => (
          <div
            key={h.id}
            className="dmg-float"
            style={{
              position: "absolute",
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              zIndex: 6,
              color: h.color,
              fontFamily: "var(--display)",
              fontSize: 30,
              letterSpacing: "0.04em",
              textShadow: `0 0 16px ${h.color}, 0 2px 0 #000`,
              pointerEvents: "none",
            }}
          >
            {h.text}
          </div>
        ))}

        <div className="tag" style={{ position: "absolute", bottom: 30, left: 0, width: "100%", textAlign: "center", opacity: 0.7 }}>
          strike each key as its ring snaps shut
        </div>
      </section>

      {/* ENEMY SIDE — right, same grammar, mirrored */}
      <section
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
          padding: "64px 34px 44px 18px",
          display: "flex",
          flexDirection: "column",
          textAlign: "right",
        }}
      >
        <div>
          <div className="tag" style={{ color: "var(--attack)" }}>enemy · fixed · authored</div>
          <div className="display-title">{enemyLearned ? action.name : "??? UNLEARNED"}</div>
        </div>
        {/* mirror the layout so the FIRE node culminates at the seam,
            reflecting the player's phrase across the split */}
        <div style={{ flex: 1, minHeight: 0, marginTop: 6, transform: "scaleX(-1)" }}>
          <Diagram ability={enemyDiagram} belt={[]} assignments={{}} exec={enemyExec} />
        </div>
        <div className="tag" style={{ opacity: 0.8, color: "var(--attack)" }}>
          {enemyLearned ? describeAction(action) : "effects unknown — one resolution beat"}
        </div>
      </section>

      {/* §9.4 collision — the shots cross the seam once the outcome resolves,
          veering off if you slipped the action */}
      {enemyFx &&
        Array.from({ length: totalInstances }).map((_, i) => (
          <div
            key={i}
            className="missile-streak"
            style={{
              top: `${44 + (i - 1) * 6}%`,
              animationName: enemyFx.sidestep || enemyFx.neutral ? "streak-miss" : "streak-hit",
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}

      {/* count-in banner */}
      {counting && (
        <div
          className="hud"
          style={{
            top: "42%",
            left: "29%",
            transform: "translate(-50%,-50%)",
            fontFamily: "var(--display)",
            fontSize: 64,
            color: "var(--pulse)",
            zIndex: 20,
            textShadow: "0 0 24px var(--pulse)",
          }}
        >
          {Math.max(1, Math.ceil((LEAD_IN - now) / BEAT_MS))}
        </div>
      )}

      {/* impact / avoid full-frame flash */}
      {flash && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 15,
            pointerEvents: "none",
            background:
              flash === "hit"
                ? "radial-gradient(circle at 40% 55%, rgba(255,40,60,0.4), transparent 60%)"
                : "radial-gradient(circle at 40% 55%, rgba(108,240,255,0.35), transparent 60%)",
          }}
        />
      )}

      {/* the enemy action RESOLVES here — live, not in an after-report */}
      {enemyFx && (
        <div
          className="floatUp"
          style={{
            position: "absolute",
            top: "62%",
            left: "29%",
            transform: "translate(-50%,-50%)",
            zIndex: 22,
            textAlign: "center",
            pointerEvents: "none",
            fontFamily: "var(--display)",
          }}
        >
          {/* only celebrate on a FULL neutralise; otherwise show what actually
              got through, even if you slipped one of several beats */}
          {enemyFx.neutral ? (
            <div
              style={{
                fontSize: 46,
                color: enemyFx.sidestep ? "var(--sidestep)" : "var(--defend)",
                textShadow: enemyFx.sidestep
                  ? "0 0 20px rgba(255,206,74,0.7)"
                  : "0 0 20px rgba(79,157,255,0.7)",
              }}
            >
              {enemyFx.sidestep ? "SIDESTEP!" : "BLOCKED!"}
            </div>
          ) : (
            <>
              {enemyFx.dmg > 0 && (
                <div style={{ fontSize: 52, color: "var(--attack)", textShadow: "0 0 22px rgba(255,60,80,0.8)" }}>
                  −{enemyFx.dmg}
                </div>
              )}
              {enemyFx.push > 0 && (
                <div style={{ fontSize: 26, color: "var(--move)", letterSpacing: "0.1em" }}>
                  PUSHED −{enemyFx.push}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
