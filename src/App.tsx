import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createInitialState, currentOrder, OPENING_LINES, reducer, type Action } from "./game/reducer.ts";
import { clearSave, loadGame, saveGame } from "./game/save.ts";
import type { GameState } from "./game/types.ts";
import { newSeed } from "./lib/rng.ts";
import { TitleScreen, type LoadIssue } from "./components/TitleScreen.tsx";
import { Stage } from "./components/Stage.tsx";
import { TutorialGuide } from "./components/TutorialGuide.tsx";
import { PortraitNotice } from "./components/PortraitNotice.tsx";
import { CounterScene } from "./components/CounterScene.tsx";
import { WorkbenchScene } from "./components/WorkbenchScene.tsx";
import { ClosingScene } from "./components/ClosingScene.tsx";
import { RecipeUnlockNotice } from "./components/RecipeUnlockNotice.tsx";
import { OpeningScene } from "./components/OpeningScene.tsx";
import { GameOverScreen } from "./components/GameOverScreen.tsx";
import { LearningRecords } from "./components/LearningRecords.tsx";
import { SoundSettings } from "./components/SoundSettings.tsx";
import { ShopModal, type ShopTab } from "./components/ShopModal.tsx";
import { DecorPreview } from "./components/DecorPreview.tsx";
import type { HudProps } from "./components/SceneHud.tsx";
import { decorOf, type DecorSlot, type ThemeId } from "./data/shop.ts";
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
    // 저장은 그대로 읽어 두고, 화면은 늘 타이틀부터 ('이어하기'를 누르면 저장된 화면으로)
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
  /** 접속·새로고침하면 타이틀부터. 화면 상태일 뿐 저장(state.scene)은 바꾸지 않는다 */
  const [showTitle, setShowTitle] = useState(true);
  const [showRecords, setShowRecords] = useState(false);
  const [sound, setSound] = useState<SoundPrefs>(loadSoundSettings);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<ShopTab>("gadget");
  const [preview, setPreview] = useState<{ slot: DecorSlot; theme: ThemeId } | null>(null);

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

  // 튜토리얼을 끝까지 마친 순간 짧게 축하 (화면 효과일 뿐, 보상 없음)
  const [tutorialDone, setTutorialDone] = useState(false);
  const prevTutorial = useRef(state.tutorial?.status);
  useEffect(() => {
    if (prevTutorial.current === "active" && state.tutorial?.status === "done") setTutorialDone(true);
    prevTutorial.current = state.tutorial?.status;
  }, [state.tutorial?.status]);
  useEffect(() => {
    if (!tutorialDone) return;
    const t = window.setTimeout(() => setTutorialDone(false), 4000);
    return () => window.clearTimeout(t);
  }, [tutorialDone]);

  // 상태가 바뀔 때마다 저장. 읽지 못한 저장이 있으면 사용자가 고를 때까지 저장하지 않는다.
  useEffect(() => {
    if (!loadIssue) saveGame(state);
  }, [state, loadIssue]);

  /**
   * 새로 시작하기 (타이틀에서 교체 확인을 마친 뒤에만 불린다): 진행·돈·구매·해금·학습 기록을 처음으로 하고 첫 영업을 준비한 뒤
   * 오프닝부터 보여 준다. 덧문 열기·첫 손님·튜토리얼은 오프닝 마지막 대사를 넘긴 뒤(openingNext).
   */
  const newGame = useCallback(() => {
    clearSave();
    setLoadIssue(null);
    setMigratedFrom(null);
    setShutterFx(null);
    dispatch({ type: "RESET" });
    dispatch({ type: "START", seed: newSeed(), tutorial: true });
    setShowTitle(false);
  }, []);

  /** 오프닝 대사 넘기기. 마지막 대사를 넘기면 창구로 바뀌며 기존 덧문 열기 연출 → 첫 손님 → 튜토리얼 */
  const openingNext = useCallback((fromLine: number) => {
    dispatch({ type: "OPENING_NEXT", fromLine });
    if (fromLine >= OPENING_LINES.length - 1) {
      setShutterFx("opening");
      playSfx("shutterOpen");
    }
  }, []);

  /** 영업 중단 → 복구 지점(전날 또는 그날 영업 시작)으로. 창구에서 덧문을 다시 연다 */
  const restoreDay = useCallback((dayNumber: number) => {
    setShopOpen(false);
    setPreview(null);
    dispatch({ type: "RESTORE_CHECKPOINT", dayNumber });
    setShutterFx("opening");
    playSfx("shutterOpen");
  }, []);

  const applyImport = useCallback((next: GameState) => {
    setLoadIssue(null);
    setMigratedFrom(null);
    setShutterFx(null);
    dispatch({ type: "REPLACE_STATE", state: next });
  }, []);

  /** 이어하기: 저장된 화면(창구·제작대·마감)으로. 이미 한 행동·지급은 다시 하지 않는다 */
  const continueGame = () => {
    if (shutterFx || !state.day) return;
    setMigratedFrom(null);
    if (state.scene === "title") dispatch({ type: "START", seed: newSeed() });
    setShowTitle(false);
  };
  const goTitle = () => {
    setShopOpen(false);
    setPreview(null);
    dispatch({ type: "GO_TITLE" });
    setShowTitle(true);
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
  const closeShop = useCallback(() => setShopOpen(false), []);
  // 미리보기를 닫으면 상점 창으로 돌아간다 (장착 상태는 바뀌지 않았으므로 원래 모습 그대로)
  const backFromPreview = useCallback(() => {
    setPreview(null);
    setShopOpen(true);
  }, []);

  const day = state.day;
  const order = currentOrder(state);
  const openingOn = !showTitle && day !== null && state.opening !== null && !state.opening.done;
  const inGame = !showTitle && !openingOn && state.scene !== "title" && day !== null && order !== null;
  // 접속할 때 이미 중단 상태였으면 바로, 이번에 전달하며 중단됐으면 손님 반응을 먼저 보여 주고 나타낸다
  const bootOver = bootInfo.state.gameOver;
  const overDelayed = !!state.gameOver && !(bootOver && bootOver.orderId === state.gameOver.orderId && bootOver.money === state.gameOver.money);
  const overlayOpen = shopOpen || preview !== null;

  const hud: HudProps | undefined = inGame
    ? {
        dayLabel: `밤 ${day.dayNumber}일차 · ${day.status === "closed" ? "영업 마감" : `손님 ${day.currentIndex + 1}/${day.orders.length}`}`,
        money: state.money,
        sound,
        onSound: changeSound,
        onHome: goTitle,
        onShop: () => {
          setPreview(null);
          setShopOpen(true);
        },
        homeDisabled: shutterFx !== null || overlayOpen,
        shopDisabled: shutterFx !== null || overlayOpen || state.activeTask !== null,
      }
    : undefined;

  const tutorialOn = inGame && !state.gameOver && state.tutorial?.status === "active" && day.dayNumber === 1;

  return (
    <div className="app">
      {!inGame && showRecords ? (
        <main className="records-page">
          <LearningRecords state={state} onBack={() => setShowRecords(false)} />
        </main>
      ) : (
        <Stage>
          {!inGame && !openingOn && (
            <TitleScreen
              state={state}
              loadIssue={loadIssue}
              migratedFrom={migratedFrom}
              onContinue={continueGame}
              onNewGame={newGame}
              onImport={applyImport}
              onRecords={() => setShowRecords(true)}
              sound={<SoundSettings value={sound} onChange={changeSound} light />}
            />
          )}
          {openingOn && state.opening && <OpeningScene line={state.opening.line} onNext={openingNext} />}
          {inGame && state.scene === "counter" && (
            <CounterScene
              halted={state.gameOver !== null}
              day={day}
              order={order}
              dispatch={dispatch}
              opening={shutterFx === "opening"}
              onOpenEnd={endFx}
              onCloseDay={closeDay}
              equipped={state.shop.equipped}
              hud={hud}
            />
          )}
          {inGame && state.scene === "workbench" && (
            <WorkbenchScene state={state} order={order} dispatch={dispatch} hud={hud} overlayOpen={overlayOpen} tutorial={tutorialOn} />
          )}
          {inGame && state.scene === "closing" && (
            <ClosingScene
              state={state}
              animate={shutterFx === "closing"}
              onAnimEnd={endFx}
              onNextDay={nextDay}
              onTitle={goTitle}
              busy={shutterFx !== null}
              hud={hud}
            />
          )}
          {inGame && shopOpen && !preview && (
            <ShopModal
              state={state}
              tab={shopTab}
              onTab={setShopTab}
              onBuy={(itemId) => dispatch({ type: "BUY_ITEM", itemId })}
              onEquip={(slot, theme) => dispatch({ type: "EQUIP_DECOR", slot, theme })}
              onGadget={(id, on) => dispatch({ type: "SET_GADGET", id, on })}
              onPreview={(slot, theme) => {
                setShopOpen(false);
                setPreview({ slot, theme });
              }}
              onClose={closeShop}
            />
          )}
          {inGame && preview && (
            <DecorPreview
              state={state}
              slot={preview.slot}
              theme={preview.theme}
              onBack={backFromPreview}
              onEquip={() => {
                dispatch({ type: "EQUIP_DECOR", slot: preview.slot, theme: preview.theme });
                backFromPreview();
              }}
              onBuy={() => {
                const item = decorOf(preview.slot, preview.theme);
                if (state.money < item.price || state.activeTask !== null) return;
                dispatch({ type: "BUY_ITEM", itemId: item.id });
                dispatch({ type: "EQUIP_DECOR", slot: preview.slot, theme: preview.theme });
                backFromPreview();
              }}
            />
          )}
          {/* 새 레시피 해금 안내: 확인할 때까지 게임 화면 위에 (저장된 안내라 이어하기 때도 다시 뜬다) */}
          {inGame && state.recipeNotices.length > 0 && !shutterFx && !overlayOpen && (
            <RecipeUnlockNotice
              recipeId={state.recipeNotices[0]}
              onConfirm={() => dispatch({ type: "ACK_RECIPE_NOTICE", recipeId: state.recipeNotices[0] })}
            />
          )}
          {/* 첫 주문 튜토리얼 안내 (실제 행동을 해야 다음으로) */}
          {tutorialOn && !shutterFx && !overlayOpen && (
            <TutorialGuide state={state} onSkip={() => dispatch({ type: "TUTORIAL_SKIP" })} />
          )}
          {inGame && state.gameOver && (
            <GameOverScreen state={state} delayed={overDelayed} onRestore={restoreDay} onTitle={goTitle} />
          )}
          {inGame && tutorialDone && (
            <p className="tutorial-done" role="status" data-testid="tutorial-done">첫 주문 완성! 이제 다음 손님도 같은 순서로 만들어 보세요.</p>
          )}
        </Stage>
      )}
      <PortraitNotice />
    </div>
  );
}
