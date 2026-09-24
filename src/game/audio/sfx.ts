import type { SfxId } from "../../data/audio";

/**
 * Tiny procedural sound effects so actions have audible feedback before real
 * SFX files exist. Each recipe is a couple of oscillators / filtered noise
 * bursts with a short envelope.
 */

let noiseBuffer: AudioBuffer | null = null;

function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.5);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

interface Opts {
  volume?: number;
  pitch?: number;
}

function env(ctx: AudioContext, out: AudioNode, peak: number, attack: number, decay: number, at = 0): GainNode {
  const g = ctx.createGain();
  const t = ctx.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, peak: number, dur: number, at = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  const t = ctx.currentTime + at;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  o.connect(env(ctx, out, peak, 0.005, dur, at));
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst(ctx: AudioContext, out: AudioNode, filter: BiquadFilterType, freq: number, q: number, peak: number, dur: number, at = 0) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const t = ctx.currentTime + at;
  src.connect(f).connect(env(ctx, out, peak, 0.004, dur, at));
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.05);
}

export function playSynthSfx(ctx: AudioContext, out: AudioNode, id: SfxId, opts: Opts): void {
  const v = opts.volume ?? 1;
  const p = (opts.pitch ?? 1) * (0.95 + Math.random() * 0.1);
  switch (id) {
    case "swing":
      burst(ctx, out, "bandpass", 1800 * p, 0.8, 0.25 * v, 0.12);
      break;
    case "chop":
      burst(ctx, out, "lowpass", 900 * p, 1, 0.7 * v, 0.09);
      tone(ctx, out, "triangle", 220 * p, 110 * p, 0.35 * v, 0.1);
      break;
    case "mine":
      tone(ctx, out, "square", 1400 * p, 900 * p, 0.12 * v, 0.08);
      tone(ctx, out, "triangle", 2600 * p, 2000 * p, 0.12 * v, 0.14);
      burst(ctx, out, "highpass", 2500, 1, 0.25 * v, 0.05);
      break;
    case "collect":
      burst(ctx, out, "bandpass", 3000 * p, 2, 0.2 * v, 0.1);
      tone(ctx, out, "sine", 700 * p, 1100 * p, 0.15 * v, 0.12);
      break;
    case "hit":
    case "enemy_hit":
      burst(ctx, out, "lowpass", 1400 * p, 1, 0.6 * v, 0.08);
      tone(ctx, out, "square", 180 * p, 60 * p, 0.25 * v, 0.1);
      break;
    case "player_hurt":
      tone(ctx, out, "sawtooth", 300 * p, 90 * p, 0.3 * v, 0.2);
      burst(ctx, out, "lowpass", 700, 1, 0.4 * v, 0.12);
      break;
    case "enemy_die":
      tone(ctx, out, "sawtooth", 260 * p, 50 * p, 0.3 * v, 0.35);
      burst(ctx, out, "lowpass", 500, 1, 0.3 * v, 0.3);
      break;
    case "pickup":
      tone(ctx, out, "square", 660 * p, 990 * p, 0.12 * v, 0.07);
      tone(ctx, out, "square", 990 * p, 1320 * p, 0.1 * v, 0.08, 0.06);
      break;
    case "coin":
      tone(ctx, out, "square", 1318, 1318, 0.1 * v, 0.06);
      tone(ctx, out, "square", 1760, 1760, 0.1 * v, 0.18, 0.06);
      break;
    case "chest":
      burst(ctx, out, "lowpass", 400, 1, 0.5 * v, 0.2);
      tone(ctx, out, "triangle", 130, 200, 0.3 * v, 0.25);
      break;
    case "rare":
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(ctx, out, "square", f, f, 0.09 * v, 0.22, i * 0.07));
      break;
    case "door":
      burst(ctx, out, "lowpass", 300, 2, 0.5 * v, 0.25);
      tone(ctx, out, "triangle", 90, 70, 0.3 * v, 0.3);
      break;
    case "ui":
      tone(ctx, out, "square", 880, 880, 0.06 * v, 0.04);
      break;
    case "deny":
      tone(ctx, out, "square", 180, 140, 0.12 * v, 0.14);
      break;
    case "levelup":
      [392, 523, 659, 784].forEach((f, i) => tone(ctx, out, "triangle", f, f, 0.2 * v, 0.3, i * 0.1));
      break;
    case "potion":
      [500, 700, 950].forEach((f, i) => tone(ctx, out, "sine", f, f * 1.2, 0.15 * v, 0.1, i * 0.06));
      break;
    case "dice":
      for (let i = 0; i < 5; i++) burst(ctx, out, "bandpass", 2500 + Math.random() * 1500, 4, 0.3 * v, 0.03, i * 0.06);
      break;
    case "card":
      // A quick papery flick as a card slides onto the felt.
      burst(ctx, out, "highpass", 3200, 1, 0.22 * v, 0.05);
      burst(ctx, out, "bandpass", 1400, 2, 0.12 * v, 0.03, 0.02);
      break;
  }
}
