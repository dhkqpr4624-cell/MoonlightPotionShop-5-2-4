// Phase 4: 직접 젓기 입력(StirTracker), 소리 설정 저장, 오디오 실패 시에도 게임이 멈추지 않는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { MAX_STEP, PROGRESS_PER_UNIT, StirTracker, TIP_LIMIT, clampTip } from "../src/game/stirInput.ts";
import { DEFAULT_SOUND, SETTINGS_KEY, loadSoundSettings, normalizeSoundSettings, saveSoundSettings } from "../src/audio/settings.ts";
import { applySoundSettings, isStirSoundActive, playSfx, startStir, stopStir, unlockAudio, updateStir, _resetAudioForTest } from "../src/audio/sfx.ts";
import { STIR_MAX_STEP } from "../src/game/reducer.ts";
import { SHOP_ART } from "../src/data/shopArt.ts";
import { memoryStorage } from "./helpers.ts";

/** 원을 따라 n걸음 저었을 때 쌓인 진행도 */
function circle(t: StirTracker, steps: number, r = 0.6, id = 1): number {
  let total = 0;
  for (let i = 1; i <= steps; i++) {
    const a = (i / 16) * Math.PI * 2;
    total += t.move(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return total;
}

test("젓기: 누르고 가만히 있거나 단순 클릭만 하면 진행도가 0", () => {
  const t = new StirTracker();
  assert.equal(t.begin(1, { x: 0.2, y: 0.1 }), true);
  let total = 0;
  for (let i = 0; i < 500; i++) total += t.move(1, { x: 0.2, y: 0.1 });
  for (let i = 0; i < 500; i++) total += t.move(1, { x: 0.2 + (i % 2) * 0.005, y: 0.1 }); // 미세한 떨림
  total += t.end(1);
  assert.equal(total, 0);
  // 클릭 100번
  for (let i = 0; i < 100; i++) {
    t.begin(1, { x: 0.3, y: 0 });
    total += t.end(1);
  }
  assert.equal(total, 0);
});

test("젓기: 원을 그리거나 좌우로 오가면 움직인 거리만큼 쌓여 결국 100에 닿는다", () => {
  const t = new StirTracker();
  t.begin(1, { x: 0.6, y: 0 });
  let total = circle(t, 16 * 12);
  total += t.end(1);
  assert.ok(total >= 100, `원 젓기 진행도 ${total}`);

  const u = new StirTracker();
  u.begin(2, { x: -0.5, y: 0 });
  let back = 0;
  for (let i = 0; i < 200; i++) back += u.move(2, { x: i % 2 ? -0.5 : 0.5, y: 0 }) ;
  back += u.end(2);
  // 한 번에 1.0을 움직였지만 MAX_STEP으로 잘리므로 걸음당 MAX_STEP*PROGRESS_PER_UNIT
  assert.ok(Math.abs(back - 200 * MAX_STEP * PROGRESS_PER_UNIT) <= 2, `왕복 진행도 ${back}`);
});

test("젓기: 한 번에 크게 튄 좌표는 잘려서 한 번의 움직임으로 완료되지 않는다", () => {
  const t = new StirTracker();
  t.begin(1, { x: -100, y: -100 });
  const got = t.move(1, { x: 1e9, y: 1e9 }) + t.end(1);
  assert.ok(got <= Math.ceil(MAX_STEP * PROGRESS_PER_UNIT), `한 번 이동 ${got}`);
  assert.ok(got < 100);
  // NaN·Infinity 좌표도 안전
  const n = new StirTracker();
  n.begin(1, { x: NaN, y: 0 });
  assert.equal(n.move(1, { x: Infinity, y: -Infinity }), 0);
  assert.equal(n.end(1), 0);
});

test("젓기: 막대 끝은 솥 안쪽으로 제한된다(손이 솥 밖으로 나가도)", () => {
  const p = clampTip({ x: 5, y: 5 });
  assert.ok(Math.hypot(p.x, p.y) <= TIP_LIMIT + 1e-9);
  const t = new StirTracker();
  t.begin(1, { x: 3, y: 0 });
  t.move(1, { x: 0, y: -3 });
  assert.ok(Math.hypot(t.tip.x, t.tip.y) <= TIP_LIMIT + 1e-9);
});

test("젓기: 두 번째 손가락은 무시하고, 잡은 손가락을 떼면 다시 잡을 수 있다", () => {
  const t = new StirTracker();
  assert.equal(t.begin(1, { x: 0.5, y: 0 }), true);
  assert.equal(t.begin(2, { x: -0.5, y: 0 }), false);
  let other = 0;
  for (let i = 0; i < 50; i++) other += t.move(2, { x: i % 2 ? 0.5 : -0.5, y: 0 });
  assert.equal(other, 0, "다른 손가락 움직임은 진행도에 들어가지 않음");
  assert.equal(t.end(2), 0, "다른 손가락을 떼도 잡은 상태 유지");
  assert.equal(t.active, true);
  const first = circle(t, 32) + t.end(1);
  assert.ok(first > 0);
  assert.equal(t.active, false);
  // 놓은 뒤 다시 잡으면 이어서 저을 수 있음(진행도 자체는 게임 상태에 누적)
  assert.equal(t.begin(2, { x: 0.6, y: 0 }), true);
  assert.ok(circle(t, 32, 0.6, 2) + t.end(2) > 0);
});

test("젓기: 한 번에 보내는 양은 리듀서 한도(STIR_MAX_STEP) 안이다", () => {
  const t = new StirTracker();
  t.begin(1, { x: -0.8, y: 0 });
  for (let i = 0; i < 100; i++) {
    const got = t.move(1, { x: i % 2 ? -0.8 : 0.8, y: 0 });
    assert.ok(got <= STIR_MAX_STEP, `한 번 전송 ${got}`);
  }
});

test("소리 설정: 기본값·정규화·저장·불러오기", () => {
  assert.deepEqual(normalizeSoundSettings(null), DEFAULT_SOUND);
  assert.deepEqual(normalizeSoundSettings({ enabled: "yes", volume: 9 }), { enabled: true, volume: 1 });
  assert.deepEqual(normalizeSoundSettings({ enabled: false, volume: -3 }), { enabled: false, volume: 0 });
  assert.deepEqual(normalizeSoundSettings({ volume: NaN }), DEFAULT_SOUND);
  const s = memoryStorage();
  assert.deepEqual(loadSoundSettings(s), DEFAULT_SOUND, "저장이 없으면 기본값");
  assert.equal(saveSoundSettings({ enabled: false, volume: 0.35 }, s), true);
  assert.deepEqual(loadSoundSettings(s), { enabled: false, volume: 0.35 });
  assert.equal(JSON.parse(s.getItem(SETTINGS_KEY)!).version, 1);
  s.setItem(SETTINGS_KEY, "{망가진");
  assert.deepEqual(loadSoundSettings(s), DEFAULT_SOUND, "망가진 설정은 기본값");
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } };
  assert.deepEqual(loadSoundSettings(broken), DEFAULT_SOUND);
  assert.equal(saveSoundSettings(DEFAULT_SOUND, broken), false);
});

test("효과음: Web Audio가 없는 환경에서도 오류 없이 지나간다", () => {
  _resetAudioForTest();
  assert.doesNotThrow(() => {
    unlockAudio();
    applySoundSettings({ enabled: true, volume: 0.5 });
    playSfx("click");
    playSfx("pourLiquid");
    startStir();
    updateStir(0.8);
    stopStir();
  });
  assert.equal(isStirSoundActive(), false);
});

test("효과음: AudioContext 생성이 실패해도 게임 코드에 오류가 퍼지지 않는다", () => {
  _resetAudioForTest();
  const g = globalThis as Record<string, unknown>;
  const prev = g.AudioContext;
  g.AudioContext = class { constructor() { throw new Error("NotAllowedError"); } };
  try {
    assert.doesNotThrow(() => {
      unlockAudio();
      playSfx("complete");
      startStir();
      stopStir();
    });
  } finally {
    g.AudioContext = prev;
    _resetAudioForTest();
  }
});

test("그림 파일: shopArt가 가리키는 파일이 public/에 있고 외부 주소를 쓰지 않는다", () => {
  for (const path of Object.values(SHOP_ART)) {
    if (!path) continue;
    assert.ok(!/^https?:/.test(path), path);
    assert.ok(existsSync(`public/${path}`), `public/${path}`);
  }
  for (const f of readdirSync("public/assets/shop")) {
    const svg = readFileSync(`public/assets/shop/${f}`, "utf8");
    assert.ok(!/(href|src)=["']https?:/.test(svg.replace(/xmlns(:\w+)?="[^"]+"/g, "")), `${f}에 외부 주소`);
  }
});

test("젓기 버튼은 화면 코드 어디에도 없다", () => {
  const src = readFileSync("src/components/WorkbenchScene.tsx", "utf8");
  assert.ok(!src.includes('data-testid="stir"'));
  assert.ok(!/저어\s*주기|젓기 버튼/.test(src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));
  assert.ok(src.includes("막대를 잡고 움직여 포션을 저어 주세요."));
});
