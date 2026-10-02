import { useCallback, useEffect, useReducer, useState } from "react";
import { createInitialState, currentOrder, reducer, type Action } from "./game/reducer.ts";
import { clearSave, loadGame, saveGame } from "./game/save.ts";
import type { GameState } from "./game/types.ts";
import { newSeed } from "./lib/rng.ts";
import { TitleScreen, type LoadIssue } from "./components/TitleScreen.tsx";
import { CounterScene } from "./components/CounterScene.tsx";
import { WorkbenchScene } from "./components/WorkbenchScene.tsx";
import { ClosingScene } from "./components/ClosingScene.tsx";
import { LearningRecords } from "./components/LearningRecords.tsx";
import { SoundSettings } from "./components/SoundSettings.tsx";
import { Icon } from "./components/Icon.tsx";
import { applySoundSettings, playSfx, unlockAudio, type SfxName } from "./audio/sfx.ts";
import { loadSoundSettings, saveSoundSettings, type SoundSettings as SoundPrefs } from "./audio/settings.ts";

type RootAction = Action | { type: "RESET" } | { type: "REPLACE_STATE"; state: GameState };

function rootReducer(state: GameState, action: RootAction): GameState {
  if (action.type === "RESET") return createInitialState();
  if (action.type === "REPLACE_STATE") return action.state;
  return reducer(state, action);
}

interface Boot {
  state: GameState;
  issue: LoadIssue | null;
  migratedFrom: number | null;
}

function boot(): Boot {
  const r = loadGame(newSeed());
  if (r.kind === "ok") {
    // 저장된 화면으로 바로 복구 (옮겨 온 Phase 1 저장은 타이틀에서 안내 후 시작)
    return { state: r.state, issue: null, migratedFrom: r.migratedFrom };
  }
  if (r.kind === "error") {
    // 읽지 못한 저장은 덮어쓰지 않는다: 사용자가 고를 때까지 저장을 멈춘다
    return { state: createInitialState(), issue: { reason: r.reason, errors: r.errors, raw: r.raw }, migratedFrom: null };
  }
  return { state: createInitialState(), issue: null, migratedFrom: null };
}

/** 덧문 연출: 방금 누른 버튼에 대한 화면 효과일 뿐, 저장하지 않는다 (최종 모습은 day.status가 정함) */
type ShutterFx = "opening" | "closing" | null;

export default function App() {
  const [bootInfo] = useState(boot);
  const [state, dispatch] = useReducer(rootReducer, bootInfo.state);
  const [loadIssue, setLoadIssue] = useState<LoadIssue | null>(bootInfo.issue);
  const [migratedFrom, setMigratedFrom] = useState<number | null>(bootInfo.migratedFrom);
  const [shutterFx, setShutterFx] = useState<ShutterFx>(null);
  const [showRecords, setShowRecords] = useState(false);
  const [sound, setSound] = useState<SoundPrefs>(loadSoundSettings);

  const changeSound = useCallback((next: SoundPrefs) => {
    setSound(next);
    saveSoundSettings(next);
    applySoundSettings(next);
  }, []);

  // 첫 클릭·터치·키 입력에서 오디오를 깨우고, 버튼을 누르면 버튼 효과음 (data-sfx로 바꾸거나 none으로 끔)
  useEffect(() => {
    applySoundSettings(sound);
    const unlock = () => unlockAudio();
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest("button") : null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      const name = (el as HTMLElement).dataset.sfx ?? "click";
      if (name !== "none") playSfx(name as SfxName);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("click", onClick, true);
    };
    // 설정 변경은 changeSound에서 반영한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상태가 바뀔 때마다 저장. 읽지 못한 저장이 있으면 사용자가 고를 때까지 저장하지 않는다.
  useEffect(() => {
    if (!loadIssue) saveGame(state);
  }, [state, loadIssue]);

  const reset = useCallback(() => {
    clearSave();
    setLoadIssue(null);
    setMigratedFrom(null);
    setShutterFx(null);
    dispatch({ type: "RESET" });
  }, []);

  const applyImport = useCallback((next: GameState) => {
    setLoadIssue(null);
    setMigratedFrom(null);
    setShutterFx(null);
    dispatch({ type: "REPLACE_STATE", state: next });
  }, []);

  const start = () => {
    if (shutterFx) return;
    if (!state.day) {
      setShutterFx("opening"); // 첫 영업: 덧문을 열고 첫 손님 등장
      playSfx("shutterOpen");
    }
    setMigratedFrom(null);
    dispatch({ type: "START", seed: newSeed() });
  };

  const closeDay = () => {
    if (shutterFx || !state.day) return;
    setShutterFx("closing");
    dispatch({ type: "CLOSE_DAY", dayNumber: state.day.dayNumber, now: new Date().toISOString() });
  };

  const nextDay = () => {
    if (shutterFx || !state.day || state.day.status !== "closed") return;
    setShutterFx("opening");
    playSfx("shutterOpen");
    dispatch({ type: "NEXT_DAY", fromDay: state.day.dayNumber, seed: newSeed() });
  };

  const endFx = useCallback(() => setShutterFx(null), []);

  const day = state.day;
  const order = currentOrder(state);
  const inGame = state.scene !== "title" && day !== null && order !== null;

  return (
    <div className="app">
      {inGame && (
        <header className="top-bar">
          <button type="button" className="btn btn-ghost small" onClick={() => dispatch({ type: "GO_TITLE" })} disabled={shutterFx !== null}>
            <Icon name="home" size={18} /> 처음 화면
          </button>
          <div className="day-badge" data-testid="day-badge">
            밤 {day.dayNumber}일차 · {day.status === "closed" ? "영업 마감" : `손님 ${day.currentIndex + 1} / ${day.orders.length}`}
          </div>
          <div className="top-right">
            <SoundSettings value={sound} onChange={changeSound} />
            <div className="money" data-testid="money" aria-label={`달빛 동전 ${state.money}개`}>
              <Icon name="coin" size={22} />
              <span data-testid="money-value">{state.money}</span>
            </div>
          </div>
        </header>
      )}
      <main className="stage">
        {!inGame && showRecords && <LearningRecords state={state} onBack={() => setShowRecords(false)} />}
        {!inGame && !showRecords && (
          <TitleScreen
            state={state}
            loadIssue={loadIssue}
            migratedFrom={migratedFrom}
            onStart={start}
            onReset={reset}
            onImport={applyImport}
            onRecords={() => setShowRecords(true)}
            sound={<SoundSettings value={sound} onChange={changeSound} light />}
          />
        )}
        {inGame && state.scene === "counter" && (
          <CounterScene
            day={day}
            order={order}
            dispatch={dispatch}
            opening={shutterFx === "opening"}
            onOpenEnd={endFx}
            onCloseDay={closeDay}
          />
        )}
        {inGame && state.scene === "workbench" && <WorkbenchScene state={state} order={order} dispatch={dispatch} />}
        {inGame && state.scene === "closing" && (
          <ClosingScene
            state={state}
            animate={shutterFx === "closing"}
            onAnimEnd={endFx}
            onNextDay={nextDay}
            onTitle={() => dispatch({ type: "GO_TITLE" })}
            busy={shutterFx !== null}
          />
        )}
      </main>
    </div>
  );
}
