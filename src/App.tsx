import { lazy, Suspense, useEffect } from "react";
import { useGame } from "./store";
import { unlockAudio } from "./audio";
import Title from "./phases/Title";
import Gather from "./phases/Gather";
import Configure from "./phases/Configure";

// the arena pulls in three/drei — load it only when the fight starts
const Approach = lazy(() => import("./phases/Approach"));
import Execute from "./phases/Execute";
import Resolve from "./phases/Resolve";
import EndScreen from "./phases/EndScreen";
import Hud from "./components/Hud";

export default function App() {
  const phase = useGame((s) => s.phase);

  // unlock the audio context on the first interaction
  useEffect(() => {
    const on = () => unlockAudio();
    window.addEventListener("keydown", on, { once: true });
    window.addEventListener("pointerdown", on, { once: true });
    return () => {
      window.removeEventListener("keydown", on);
      window.removeEventListener("pointerdown", on);
    };
  }, []);

  // the two world registers — physical (crude/warm) vs alchemical (cold/crisp)
  const physical = phase === "gather" || phase === "approach";
  const arcane =
    phase === "configure" || phase === "execute" || phase === "resolve";

  return (
    <div className={`stage ${physical ? "world-physical" : "world-arcane"}`}>
      {phase === "title" && <Title />}
      {phase === "gather" && <Gather />}
      {phase === "approach" && (
        <Suspense
          fallback={
            <div className="center-col" style={{ position: "absolute", inset: 0, justifyContent: "center" }}>
              <div className="tag blink">entering the arena…</div>
            </div>
          }
        >
          <Approach />
        </Suspense>
      )}
      {phase === "configure" && <Configure />}
      {phase === "execute" && <Execute />}
      {phase === "resolve" && <Resolve />}
      {(phase === "gameover" || phase === "victory") && <EndScreen />}

      {(phase === "approach" || arcane) && <Hud />}

      {physical ? (
        <>
          <div className="veil-warm" />
          <div className="dither" />
        </>
      ) : (
        <div className="grain" />
      )}
    </div>
  );
}
