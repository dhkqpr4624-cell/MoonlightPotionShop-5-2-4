/**
 * 효과음 (Web Audio로 직접 합성. 음원 파일·외부 스트리밍 없음).
 *
 * - 사용자의 첫 클릭·터치·키 입력 뒤에만 AudioContext를 만들고 깨운다(자동재생 제한 대응).
 * - AudioContext가 없거나 실패해도 모든 함수는 조용히 아무것도 하지 않는다 → 게임 진행에 영향 없음.
 * - 같은 소리를 아주 짧은 간격으로 반복하면 무시해 소리가 과하게 겹치지 않게 한다.
 * - 효과음은 '버튼을 누른 그 순간'에만 화면 코드가 부른다. 저장 상태를 불러오거나 새로고침할 때는 부르지 않는다.
 * - 젓기 소리는 startStir/updateStir/stopStir로 조작 중에만 난다.
 */
import { loadSoundSettings, type SoundSettings } from "./settings.ts";

export type SfxName =
  | "click" | "pick" | "drop" | "pourLiquid" | "pourPowder" | "correct" | "wrong"
  | "complete" | "bottle" | "sell" | "shutterOpen" | "shutterClose" | "page";

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let settings: SoundSettings = loadSoundSettings();
let unlocked = false;
const lastPlayed = new Map<SfxName, number>();
const MIN_GAP_MS = 70;
let stir: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;

function AudioCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensure(): Ctx | null {
  if (!unlocked || !settings.enabled) return null;
  try {
    if (!ctx) {
      const C = AudioCtor();
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = settings.volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    ctx = null;
    master = null;
    return null;
  }
}

/** 첫 사용자 입력에서 호출. 이후 소리를 낼 수 있다 */
export function unlockAudio(): void {
  unlocked = true;
  ensure();
}

export function applySoundSettings(next: SoundSettings): void {
  settings = next;
  try {
    if (master && ctx) master.gain.setTargetAtTime(next.volume, ctx.currentTime, 0.02);
    if (!next.enabled) stopStir();
  } catch {
    /* 무시 */
  }
}

function getNoise(c: Ctx): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 1.0);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseBuf = buf;
  return buf;
}

/** 부드러운 음 하나 */
function tone(c: Ctx, freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, start);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, start + dur);
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master as GainNode);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** 걸러 낸 잡음 (물·가루·나무 소리) */
function noise(c: Ctx, start: number, dur: number, opts: { freq: number; q?: number; gain?: number; type?: BiquadFilterType; sweepTo?: number }) {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const f = c.createBiquadFilter();
  f.type = opts.type ?? "bandpass";
  f.frequency.setValueAtTime(opts.freq, start);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, start + dur);
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master as GainNode);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.02);
}

export function playSfx(name: SfxName): void {
  const c = ensure();
  if (!c || !master) return;
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const last = lastPlayed.get(name) ?? -Infinity;
  if (nowMs - last < MIN_GAP_MS) return;
  lastPlayed.set(name, nowMs);
  try {
    const t = c.currentTime + 0.005;
    switch (name) {
      case "click":
        tone(c, 660, t, 0.07, { type: "triangle", gain: 0.12 });
        break;
      case "page":
        noise(c, t, 0.12, { freq: 2400, q: 0.7, gain: 0.08, type: "highpass" });
        break;
      case "pick":
        tone(c, 520, t, 0.08, { type: "triangle", gain: 0.12 });
        tone(c, 780, t + 0.05, 0.1, { type: "triangle", gain: 0.1 });
        break;
      case "drop":
        tone(c, 300, t, 0.12, { type: "sine", gain: 0.18, slideTo: 200 });
        break;
      case "pourLiquid":
        noise(c, t, 0.7, { freq: 900, q: 1.2, gain: 0.16, sweepTo: 500 });
        tone(c, 420, t + 0.45, 0.16, { gain: 0.1, slideTo: 760 });
        tone(c, 380, t + 0.62, 0.14, { gain: 0.08, slideTo: 700 });
        break;
      case "pourPowder":
        noise(c, t, 0.55, { freq: 5200, q: 0.8, gain: 0.12, type: "highpass" });
        tone(c, 1568, t + 0.1, 0.25, { gain: 0.05 });
        tone(c, 2093, t + 0.25, 0.25, { gain: 0.05 });
        break;
      case "correct":
        tone(c, 659, t, 0.18, { gain: 0.12 });
        tone(c, 988, t + 0.1, 0.28, { gain: 0.1 });
        break;
      case "wrong":
        // 놀라지 않게: 낮고 짧은 두 음
        tone(c, 392, t, 0.16, { type: "sine", gain: 0.09 });
        tone(c, 330, t + 0.12, 0.22, { type: "sine", gain: 0.08 });
        break;
      case "complete":
        [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.08, 0.35, { gain: 0.09 }));
        break;
      case "bottle":
        tone(c, 900, t, 0.06, { type: "triangle", gain: 0.1 });
        tone(c, 1350, t + 0.12, 0.08, { type: "triangle", gain: 0.08 });
        break;
      case "sell":
        tone(c, 1318, t, 0.12, { type: "triangle", gain: 0.1 });
        tone(c, 1760, t + 0.08, 0.2, { type: "triangle", gain: 0.1 });
        tone(c, 2093, t + 0.18, 0.25, { type: "sine", gain: 0.06 });
        break;
      case "shutterOpen":
        noise(c, t, 0.9, { freq: 260, q: 2, gain: 0.14, sweepTo: 520 });
        tone(c, 180, t + 0.8, 0.12, { type: "triangle", gain: 0.08 });
        break;
      case "shutterClose":
        noise(c, t, 0.9, { freq: 520, q: 2, gain: 0.14, sweepTo: 240 });
        tone(c, 120, t + 0.85, 0.18, { type: "triangle", gain: 0.12 });
        break;
    }
  } catch {
    /* 소리 실패는 무시 */
  }
}

/* -------------------- 젓기 소리 (조작 중에만) -------------------- */

export function startStir(): void {
  if (stir) return;
  const c = ensure();
  if (!c || !master) return;
  try {
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 1.4;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    stir = { src, gain, filter };
  } catch {
    stir = null;
  }
}

/** speed: 0~1 (최근 움직임의 빠르기) */
export function updateStir(speed: number): void {
  if (!stir || !ctx) return;
  try {
    const s = Math.max(0, Math.min(1, speed));
    stir.gain.gain.setTargetAtTime(0.02 + s * 0.14, ctx.currentTime, 0.05);
    stir.filter.frequency.setTargetAtTime(380 + s * 500, ctx.currentTime, 0.08);
  } catch {
    /* 무시 */
  }
}

export function stopStir(): void {
  const s = stir;
  stir = null;
  if (!s) return;
  try {
    const t = ctx ? ctx.currentTime : 0;
    s.gain.gain.setTargetAtTime(0.0001, t, 0.03);
    s.src.stop(t + 0.15);
  } catch {
    /* 무시 */
  }
}

export function isStirSoundActive(): boolean {
  return stir !== null;
}

/** 시험용: 소리 엔진 상태를 처음으로 */
export function _resetAudioForTest(): void {
  stopStir();
  ctx = null;
  master = null;
  unlocked = false;
  lastPlayed.clear();
}
