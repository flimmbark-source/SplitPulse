import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";
import Diagram from "../components/Diagram";
import Toolbelt from "../components/Toolbelt";
import EnemyPreview from "../components/EnemyPreview";
import { sfx } from "../audio";

const CONFIG_SECONDS = 60;

export default function Configure() {
  const {
    abilities,
    selectedAbility,
    assignments,
    selectedNode,
    belt,
    enemyLearned,
    cycleAbility,
    selectNode,
    assignToSelected,
    clearAssignment,
    setPhase,
  } = useGame();

  const ability = abilities[selectedAbility];
  const [time, setTime] = useState(CONFIG_SECONDS);
  const committedRef = useRef(false);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    sfx.attackPrompt();
    setPhase("execute");
  };

  // config timer — on expiry, commit whatever is configured
  useEffect(() => {
    const id = setInterval(() => {
      setTime((t) => {
        if (t <= 0.1) {
          clearInterval(id);
          commit();
          return 0;
        }
        return +(t - 0.1).toFixed(1);
      });
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        cycleAbility(-1);
        sfx.select();
        return;
      }
      if (e.key === "ArrowRight") {
        cycleAbility(1);
        sfx.select();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        commit();
        return;
      }
      if (e.key === "Backspace" && selectedNode) {
        clearAssignment(selectedNode);
        sfx.miss();
        return;
      }
      // number keys select a config node by slot
      if (/^[1-9]$/.test(e.key)) {
        const node = ability.nodes.find(
          (n) => n.kind === "config" && n.slot === Number(e.key)
        );
        if (node) {
          selectNode(node.id);
          sfx.select();
        }
        return;
      }
      // letter keys assign a belt material
      const k = e.key.toUpperCase();
      if (belt.find((b) => b.key === k && b.charges > 0)) {
        assignToSelected(k);
        sfx.assign();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ability, selectedNode, belt]);

  const urgent = time <= 10;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(120% 100% at 50% 0%, #14142a 0%, #07070c 60%)",
        display: "grid",
        gridTemplateColumns: "1fr minmax(300px, 460px) 1fr",
        gridTemplateRows: "auto 1fr auto",
        gap: 12,
        padding: "70px 24px 24px",
      }}
    >
      {/* top strip: configure banner + timer */}
      <div style={{ gridColumn: "1 / 4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="tag">attack configuration · world in slow motion</div>
          <div style={{ fontFamily: "var(--display)", fontSize: 24 }}>BUILD THE RESPONSE</div>
        </div>
        <div style={{ textAlign: "right", color: urgent ? "var(--attack)" : "var(--ink)" }}>
          <div className="tag">commit timer</div>
          <div className={urgent ? "blink" : ""} style={{ fontFamily: "var(--display)", fontSize: 34, lineHeight: 1 }}>
            {time.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* left: enemy preview */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <EnemyPreview learned={enemyLearned} />
      </div>

      {/* center: ability diagram */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="keycap sm">◄</span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: "0.04em" }}>{ability.name}</div>
            <div className="tag">
              {ability.nodes.filter((n) => n.kind === "config").length} slots · {ability.beats} beats
            </div>
          </div>
          <span className="keycap sm">►</span>
        </div>
        <div className="arcane-panel" style={{ width: "100%", aspectRatio: "1 / 0.8", padding: 16 }}>
          <Diagram
            ability={ability}
            belt={belt}
            assignments={assignments}
            selectedNode={selectedNode}
            onSelectNode={(id) => {
              const node = ability.nodes.find((n) => n.id === id);
              if (node?.kind === "config") {
                selectNode(id);
                sfx.select();
              }
            }}
          />
        </div>
        <div className="tag" style={{ maxWidth: 380, textAlign: "center", lineHeight: 1.6 }}>
          {ability.blurb}
        </div>
      </div>

      {/* right: instructions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <div className="arcane-panel" style={{ padding: "14px 16px", fontSize: 12, lineHeight: 1.9, maxWidth: 230 }}>
          <div className="tag" style={{ color: "var(--pulse)" }}>how to configure</div>
          <div><span className="keycap sm">◄</span> <span className="keycap sm">►</span> cycle ability</div>
          <div><span className="keycap sm">1</span>…<span className="keycap sm">n</span> select an open slot</div>
          <div><span className="keycap sm">Q</span>…<span className="keycap sm">Y</span> insert a material</div>
          <div><span className="keycap sm">⌫</span> clear the slot</div>
          <div><span className="keycap sm">Space</span> commit &amp; execute</div>
          <div style={{ marginTop: 8, color: "var(--sidestep)" }}>
            Tip: to keep the opening, neutralise the whole action — Sidestep on its beat, or Defend every shot.
          </div>
        </div>
      </div>

      {/* bottom: toolbelt */}
      <div style={{ gridColumn: "1 / 4", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div className="tag">prepared belt {selectedNode ? "— pick a material to slot it" : "— select a slot first (1…n)"}</div>
        <Toolbelt
          belt={belt}
          activeKeys={selectedNode ? undefined : []}
          onPick={(k) => {
            if (selectedNode) {
              assignToSelected(k);
              sfx.assign();
            }
          }}
        />
        <button className="btn" onClick={commit} style={{ marginTop: 4 }}>
          Commit ability ▸ Space
        </button>
      </div>
    </div>
  );
}
