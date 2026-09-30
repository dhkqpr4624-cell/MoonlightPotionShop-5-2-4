import { useCallback, useEffect, useReducer } from "react";
import { createInitialState, reducer } from "./game/reducer.ts";
import { clearSave, loadGame, saveGame } from "./game/save.ts";
import { TitleScreen } from "./components/TitleScreen.tsx";
import { CounterScene } from "./components/CounterScene.tsx";
import { WorkbenchScene } from "./components/WorkbenchScene.tsx";

type RootAction = Parameters<typeof reducer>[1] | { type: "RESET" };

function rootReducer(state: ReturnType<typeof createInitialState>, action: RootAction) {
  if (action.type === "RESET") return createInitialState();
  return reducer(state, action);
}

function init() {
  // 이어하기: 저장이 있으면 불러오되 항상 타이틀에서 시작
  const saved = loadGame();
  return saved ? { ...saved, scene: "title" as const } : createInitialState();
}

export default function App() {
  const [state, dispatch] = useReducer(rootReducer, undefined, init);

  // 상태가 바뀔 때마다 저장 (돈과 주문 상태는 한 JSON에 함께 저장된다)
  useEffect(() => {
    saveGame(state);
  }, [state]);

  const reset = useCallback(() => {
    clearSave();
    dispatch({ type: "RESET" });
  }, []);

  const showGame = state.scene !== "title" && state.order !== null;

  return (
    <div className="app">
      {showGame && (
        <header className="top-bar">
          <button type="button" className="btn btn-ghost small" onClick={() => dispatch({ type: "GO_TITLE" })}>
            ☾ 처음 화면
          </button>
          <div className="shop-name">달빛 포션 상점</div>
          <div className="money" data-testid="money" aria-label={`달빛 동전 ${state.money}개`}>
            <span className="coin" aria-hidden="true">🌙</span>
            <span data-testid="money-value">{state.money}</span>
          </div>
        </header>
      )}
      <main className="stage">
        {!showGame && <TitleScreen state={state} dispatch={dispatch} onReset={reset} />}
        {showGame && state.scene === "counter" && <CounterScene state={state} dispatch={dispatch} />}
        {showGame && state.scene === "workbench" && <WorkbenchScene state={state} dispatch={dispatch} />}
      </main>
    </div>
  );
}
