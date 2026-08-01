import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../store";
import Diagram, { type ExecState } from "../components/Diagram";
import EnemyDiagram from "../components/EnemyDiagram";
import { nodeEffect } from "../game/nodes";
import { resolveExchange } from "../game/resolve";
import { CINDER_BATTERY } from "../data/content";
import { sfx } from "../audio";
import type { ResolvedNode } from "../types";

const BEAT_MS = 620;
const LEAD_IN = 1300; // count-in before beat 1
const RING_LEAD = 860; // how long the ring contracts before target
const WINDOW = 150; // ± hit window (ms)
const END_PAD = 900;

type Status = "pending" | "hit" | "miss";

export default function Execute() {
  const { abilities, selectedAbility, assignments, belt, enemyLearned, commitExecution } =
    useGame();
  const ability = abilities[selectedAbility];
  const action = CINDER_BATTERY.action;

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
        if (avoided) {
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

  const displayBeat = Math.max(0, Math.min(ability.beats, Math.floor((now - LEAD_IN) / BEAT_MS) + 1));
  const counting = now < LEAD_IN;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#05030a", overflow: "hidden" }}>
      {/* diagonal luminous divider */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "58%",
          width: 3,
          height: "140%",
          background: "linear-gradient(180deg, transparent, var(--pulse), transparent)",
          transform: "rotate(9deg)",
          boxShadow: "0 0 24px var(--pulse)",
          opacity: 0.7,
          zIndex: 5,
        }}
      />

      {/* ENEMY SIDE (upper-right) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "42%",
          height: "100%",
          padding: "88px 24px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignItems: "flex-end",
          textAlign: "right",
        }}
      >
        <div style={{ width: "100%" }}>
          <div className="tag" style={{ color: "var(--attack)" }}>enemy action · fixed timeline</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 26 }}>
            {enemyLearned ? action.name : "??? UNLEARNED"}
          </div>
        </div>

        {/* the enemy's authored diagram — one pulse to one resolution beat */}
        <div style={{ width: "100%", height: 150, marginTop: 4 }}>
          <EnemyDiagram
            action={action}
            now={now}
            leadIn={LEAD_IN}
            beatMs={BEAT_MS}
            firing={firing}
            sidestepped={sidestepped}
            learned={enemyLearned}
          />
        </div>
        <div className="tag" style={{ color: "var(--ink-dim)", maxWidth: 260 }}>
          all {action.instances} shots resolve on one beat — one timing to answer
        </div>
      </div>

      {/* PLAYER SIDE (lower-left) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "58%",
          height: "100%",
          padding: "70px 20px 24px 32px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="tag" style={{ color: "var(--pulse)" }}>your phrase · performed</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 26 }}>{ability.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="tag">beat</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 40, lineHeight: 1, color: "var(--pulse)" }}>
              {counting ? "…" : displayBeat}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
          <Diagram ability={ability} belt={belt} assignments={assignments} exec={exec} showKeys />
        </div>

        <div className="tag" style={{ textAlign: "center" }}>
          press the shown key as the ring snaps to the node · missed nodes just go dark
        </div>
      </div>

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
    </div>
  );
}
