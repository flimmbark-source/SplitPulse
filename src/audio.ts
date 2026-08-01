// ============================================================
// Tiny procedural synth (WebAudio, no asset files).
// The diagram is a phrase: each node has a tonal identity,
// correct hits complete the phrase, misses leave audible holes.
// ============================================================

let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

interface ToneOpts {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  glide?: number; // target freq to glide to
}

function tone({ freq, dur = 0.18, type = "triangle", gain = 0.18, glide }: ToneOpts) {
  const c = ac();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur = 0.12, gain = 0.14) {
  const c = ac();
  const t = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  src.connect(hp).connect(g).connect(c.destination);
  src.start(t);
}

// pentatonic-ish palette so any combination sounds musical
const SCALE = [261.63, 311.13, 349.23, 392.0, 466.16, 523.25, 622.25];

export const sfx = {
  clock: () => tone({ freq: 130.81, dur: 0.05, type: "square", gain: 0.05 }),
  hit: (idx: number) =>
    tone({ freq: SCALE[idx % SCALE.length], dur: 0.22, type: "triangle", gain: 0.22 }),
  attack: () => tone({ freq: 523.25, dur: 0.16, type: "sawtooth", gain: 0.2, glide: 784 }),
  defend: () => tone({ freq: 392, dur: 0.26, type: "sine", gain: 0.2 }),
  poison: () => tone({ freq: 233.08, dur: 0.34, type: "sine", gain: 0.16, glide: 174 }),
  sidestep: () => tone({ freq: 659.25, dur: 0.2, type: "triangle", gain: 0.22, glide: 987 }),
  miss: () => tone({ freq: 98, dur: 0.14, type: "square", gain: 0.09 }),
  select: () => tone({ freq: 880, dur: 0.05, type: "square", gain: 0.08 }),
  assign: () => tone({ freq: 587.33, dur: 0.09, type: "triangle", gain: 0.14 }),
  dodge: () => noise(0.14, 0.1),
  enemyFire: () => {
    tone({ freq: 140, dur: 0.4, type: "sawtooth", gain: 0.18, glide: 60 });
    noise(0.3, 0.12);
  },
  impact: () => {
    tone({ freq: 80, dur: 0.3, type: "square", gain: 0.22, glide: 40 });
    noise(0.2, 0.16);
  },
  attackPrompt: () => tone({ freq: 330, dur: 0.5, type: "sawtooth", gain: 0.22, glide: 660 }),
  chain: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, dur: 0.14, type: "triangle", gain: 0.2 }), i * 70)
    );
  },
  collect: () => tone({ freq: 740, dur: 0.12, type: "triangle", gain: 0.16, glide: 1100 }),
};
