/**
 * 장식 미리보기: 실제 창구(마을길·손님·덧문·벽·테이블 순서 그대로) 또는 제작대(서랍 재료 포함)에
 * 고른 테마를 '화면에만' 임시로 입혀 보여 준다. 돈·소유·저장된 장착 상태는 바꾸지 않는다.
 * 돌아가기·Esc를 누르면 원래 모습으로 돌아간다. 이 화면에서는 주문·제조를 건드리지 않는다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { appearanceOf } from "../data/appearances.ts";
import { getCustomer } from "../data/customers.ts";
import { decorOf, SLOT_LABEL, type DecorSlot, type ThemeId } from "../data/shop.ts";
import { WORKBENCH_SCENE as WB } from "../data/shopArt.ts";
import { assetUrl } from "../lib/assets.ts";
import { ownsItem } from "../game/shop.ts";
import { currentOrder } from "../game/reducer.ts";
import { shopIngredients } from "../game/unlocks.ts";
import type { GameState } from "../game/types.ts";
import { Icon } from "./Icon.tsx";
import { SceneNpc, ShopScene, useSceneLayout } from "./art/ShopScene.tsx";
import { IngredientPile } from "./art/IngredientPile.tsx";

export function DecorPreview({ state, slot, theme, onBuy, onEquip, onBack }: {
  state: GameState;
  slot: DecorSlot;
  theme: ThemeId;
  onBuy: () => void;
  onEquip: () => void;
  onBack: () => void;
}) {
  const item = decorOf(slot, theme);
  const owned = ownsItem(state.shop, item.id);
  const short = state.money < item.price;
  const backRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);
  // 미리보기에만 쓰는 장착 상태 (저장된 상태는 그대로)
  const look = { ...state.shop.equipped, [slot]: theme };

  return (
    <div className="decor-preview" role="dialog" aria-modal="true" aria-label={`${item.name} 미리보기`} data-testid="decor-preview" data-slot={slot} data-theme={theme}>
      <div className="preview-stage">
        {slot === "bench" ? <BenchPreview state={state} theme={look.bench} /> : <CounterPreview state={state} wall={look.wall} counter={look.counter} />}
      </div>
      <div className="preview-bar" data-testid="preview-bar">
        <p className="preview-title">
          <span className="tag tag-on">미리보기</span> {SLOT_LABEL[slot]} · <strong>{item.name}</strong>
          {owned ? <span className="tag tag-owned">보유</span> : <span className="tag tag-price"><Icon name="coin" size={16} /> {item.price}</span>}
        </p>
        <p className="preview-note">아직 바뀌지 않았어요. 돌아가면 원래 모습 그대로예요.{!owned && short ? ` 달빛 동전이 ${item.price - state.money}개 더 필요해요.` : ""}</p>
        <div className="preview-actions">
          <button ref={backRef} type="button" className="btn btn-light" onClick={onBack} data-testid="preview-back">
            <Icon name="back" size={18} /> 돌아가기
          </button>
          {owned ? (
            <button type="button" className="btn btn-primary" onClick={onEquip} data-testid="preview-equip">적용하기</button>
          ) : (
            <button type="button" className="btn btn-gold" onClick={onBuy} disabled={short || state.activeTask !== null} data-testid="preview-buy" data-sfx="sell">
              구매하고 적용 ({item.price})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CounterPreview({ state, wall, counter }: { state: GameState; wall: ThemeId; counter: ThemeId }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const layout = useSceneLayout(boxRef);
  const order = currentOrder(state);
  const app = order ? appearanceOf(order) : null;
  const closed = state.day?.status === "closed";
  return (
    <div ref={boxRef} className="counter counter--scene preview-counter">
      <ShopScene layout={layout} shutterMode={closed || !order ? "closed" : "open"} wall={wall} counter={counter}>
        {order && app && !closed && (
          <SceneNpc app={app} species={getCustomer(order.customerId).artKey} layout={layout} mood="order" label={`${app.species} ${app.name}`} />
        )}
      </ShopScene>
    </div>
  );
}

function BenchPreview({ state, theme }: { state: GameState; theme: ThemeId }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 1180, h: 700 });
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const m = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    m();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(m) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const s = Math.min(box.w / WB.width, box.h / WB.height);
  const left = (box.w - WB.width * s) / 2;
  const top = (box.h - WB.height * s) / 2;
  const r = (b: { x: number; y: number; width: number; height: number }) => ({ left: left + b.x * s, top: top + b.y * s, width: b.width * s, height: b.height * s });
  return (
    <div ref={boxRef} className="preview-bench" data-testid="preview-bench">
      <img className="bench-table" src={assetUrl(decorOf("bench", theme).image)} alt="" draggable={false} style={r({ x: 0, y: 0, width: WB.width, height: WB.height })} data-testid="preview-bench-img" />
      {shopIngredients().filter((i) => state.unlockedIngredients.includes(i.id)).map((ing) => {
        const d = WB.drawers[ing.drawer];
        return (
          <div key={ing.id} className="preview-pile" style={r(d)}>
            <IngredientPile ing={ing} width={d.width * s} height={d.height * s * 0.8} picked={false} />
          </div>
        );
      })}
    </div>
  );
}
