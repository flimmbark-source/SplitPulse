import { useEffect } from "react";
import { useGame } from "./store";
import { unlockAudio } from "./audio";
import Title from "./phases/Title";
import Gather from "./phases/Gather";
import Approach from "./phases/Approach";
import Configure from "./phases/Configure";
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

  return (
    <div className="stage">
      {phase === "title" && <Title />}
      {phase === "gather" && <Gather />}
      {phase === "approach" && <Approach />}
      {phase === "configure" && <Configure />}
      {phase === "execute" && <Execute />}
      {phase === "resolve" && <Resolve />}
      {(phase === "gameover" || phase === "victory") && <EndScreen />}

      {(phase === "approach" ||
        phase === "configure" ||
        phase === "execute" ||
        phase === "resolve") && <Hud />}

      <div className="grain" />
    </div>
  );
}
