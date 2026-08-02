import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../store";
import Diagram, { type ExecState } from "../components/Diagram";
import { nodeEffect } from "../game/nodes";
import { resolveExchange } from "../game/resolve";
import { actionToDiagram, describeAction } from "../data/content";
import { sfx } from "../audio";
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
  const enemyResolve = targetOf(action.beat);
  const lastTarget = Math.max(...nodes.map((n) => targetOf(n.beat)), enemyResolve);

  const statusRef = useRef<Record<string, Status>>(
    Object.fromEntries(nodes.map((n) => [n.id, "pending" as Status]))
  );
  const startRef = useRef(0);
  const finishedRef = useRef(false);
  const firedRef = useRef(false);
  const lastBeatTickRef = useRef(0);

  const [now, setNow] = useState(0);
  const [firing, setFiring] = useState(false);
  const [sidestepped, setSidestepped] = useState(false);
  const [flash, setFlash] = useState<null | "hit" | "avoid">(null);
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
          case "sidestep": sfx.sidestep(); setSidestepped(true); break;
          default: sfx.hit(node.beat);
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

      // enemy fire
      if (!firedRef.current && t >= enemyResolve) {
        firedRef.current = true;
        setFiring(true);
        // did a sidestep land on the action's beat?
        const ss = nodes.find(
          (n) => n.beat === action.beat && n.fixedEffect?.keyword === "sidestep"
        );
        const avoided = ss ? statusRef.current[ss.id] === "hit" : false;
        setSidestepped(avoided);
        // resolve the enemy action live and show what it did to you, right now
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
        if (avoided || res.actionNeutralized) {
          setFlash("avoid");
        } else {
          setFlash("hit");
          sfx.enemyFire();
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

      {/* PLAYER SIDE — left */}
      <section
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "50%",
          height: "100%",
          padding: "64px 18px 44px 34px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div>
          <div className="tag" style={{ color: "var(--pulse)" }}>you · performed</div>
          <div className="display-title">{ability.name}</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, marginTop: 6 }}>
          <Diagram ability={ability} belt={belt} assignments={assignments} exec={exec} showKeys />
        </div>
        <div className="tag" style={{ textAlign: "center", opacity: 0.7 }}>
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

      {/* §9.4 collision — the shots cross the seam on the FIRE beat */}
      {firing &&
        Array.from({ length: action.instances }).map((_, i) => (
          <div
            key={i}
            className="missile-streak"
            style={{
              top: `${44 + (i - 1) * 6}%`,
              // sidestep => veer up and fade past the player; else strike the seam
              animationName: sidestepped ? "streak-miss" : "streak-hit",
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
          {enemyFx.sidestep ? (
            <div style={{ fontSize: 46, color: "var(--sidestep)", textShadow: "0 0 20px rgba(255,206,74,0.7)" }}>
              SIDESTEP!
            </div>
          ) : enemyFx.neutral ? (
            <div style={{ fontSize: 40, color: "var(--defend)", textShadow: "0 0 20px rgba(79,157,255,0.7)" }}>
              BLOCKED!
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
