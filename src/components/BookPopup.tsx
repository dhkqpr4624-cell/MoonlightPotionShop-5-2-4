/**
 * 책 모양 팝업 (레시피 / 이번 주문). 배경은 펼친 책 PNG(public/assets/shop/workbench/book-panel.png, 1536×1024).
 * 글자는 HTML로 양쪽 종이 안쪽(PAGE_L·PAGE_R)에만 놓고, 길면 종이 안에서 스크롤한다. 글자 크기는 책 너비에 맞춰 커진다.
 *
 * 레시피: 왼쪽 면에 고른 레시피의 이름과 '1병당 재료'(재료 아이콘·이름·양·단위)만 크게. 오른쪽 면은 레시피 고르기 목록.
 *         물·기본 용액·만드는 순서·이번 주문의 총량이나 정답은 보여 주지 않는다. 잠긴 레시피는 잠김과 필요한 재료만.
 * 이번 주문: 왼쪽 면에 손님이 한 원래 말과 '네?' 쉬운 설명. 오른쪽 면은 '힌트' 버튼 하나.
 *         누르면 재료별로 필요한 식만 보여 준다(계산 결과·정답·풀이 없음). 공개 기록은 게임 규칙(REVEAL_HINT)이 남긴다.
 *
 * - 저장된 주문 데이터(order.script, order.tasks)만 읽는다. 열 때 새 주문이나 대사를 만들지 않는다.
 * - 닫기: 닫기 버튼·Esc·책 바깥 클릭. 바깥 클릭은 click 이벤트로 닫아 뒤쪽 항아리에 클릭이 전달되지 않는다.
 * - 열려 있는 동안 뒤쪽 조작은 막히고, 초점은 팝업 안에서만 돈다. 닫으면 연 버튼으로 초점을 돌린다(부모가 처리).
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { appearanceOf } from "../data/appearances.ts";
import { getCustomer } from "../data/customers.ts";
import { getIngredient } from "../data/ingredients.ts";
import { getRecipe, RECIPES, type Recipe } from "../data/recipes.ts";
import { WORKBENCH_SCENE as WB } from "../data/shopArt.ts";
import { assetUrl } from "../lib/assets.ts";
import { orderHints } from "../game/explain.ts";
import { isRecipeAvailable, requiredIngredients } from "../game/unlocks.ts";
import type { GameState, Order } from "../game/types.ts";
import { Icon } from "./Icon.tsx";
import { IngredientArt, PotionBottle } from "./art/PotionArt.tsx";

export type BookKind = "recipe" | "order";

/** 책 PNG(1536×1024) 안의 종이 안쪽 (장식 테두리·가운데 접힘선 피함) */
const BOOK = { w: 1536, h: 1024 };
const PAGE_L = { x: 222, y: 128, w: 482, h: 632 };
const PAGE_R = { x: 852, y: 128, w: 466, h: 632 };
const pct = (p: { x: number; y: number; w: number; h: number }) => ({
  left: `${(p.x / BOOK.w) * 100}%`, top: `${(p.y / BOOK.h) * 100}%`, width: `${(p.w / BOOK.w) * 100}%`, height: `${(p.h / BOOK.h) * 100}%`,
});

export function BookPopup({ kind, state, order, onClose, onRevealHint }: {
  kind: BookKind; state: GameState; order: Order; onClose: () => void; onRevealHint: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !boxRef.current) return;
    const items = [...boxRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0']")];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const onBackdrop = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  const title = kind === "recipe" ? "레시피" : "이번 주문";

  // 레시피 목록: 지금 게임의 레시피 + (이전 버전 주문을 마치는 중이면) 그 주문의 레시피
  const current = getRecipe(order.recipeId);
  const list: Recipe[] = [...(current.legacy ? [current] : []), ...Object.values(RECIPES).filter((r) => !r.legacy)];
  const [selected, setSelected] = useState(current.id);
  const recipe = getRecipe(selected);

  return (
    <div className="book-backdrop" onClick={onBackdrop} data-testid="book-backdrop">
      <div className="book-popup" role="dialog" aria-modal="true" aria-label={title} ref={boxRef} onKeyDown={trap} data-testid="book-popup" data-kind={kind}>
        <img className="book-bg" src={assetUrl(WB.bookPanel)} alt="" draggable={false} />
        <div className="book-page book-page-l" style={pct(PAGE_L)} tabIndex={0} data-testid="book-page-left">
          {kind === "recipe" ? <RecipeCard recipe={recipe} state={state} /> : <OrderTalk order={order} />}
        </div>
        <div className="book-page book-page-r" style={pct(PAGE_R)} tabIndex={0} data-testid="book-page-right">
          {kind === "recipe" ? (
            <RecipeList list={list} selected={selected} onSelect={setSelected} state={state} />
          ) : (
            <OrderHint order={order} onReveal={onRevealHint} />
          )}
        </div>
        <button type="button" className="book-close" onClick={onClose} ref={closeRef} aria-label={`${title} 닫기`} data-testid="popup-close" data-sfx="page">
          <Icon name="close" size={22} /> 닫기
        </button>
      </div>
    </div>
  );
}

/** 왼쪽 면: 고른 레시피의 이름과 1병당 재료만 크게 */
function RecipeCard({ recipe, state }: { recipe: Recipe; state: GameState }) {
  const usable = recipe.legacy || isRecipeAvailable(recipe, state.unlockedIngredients);
  return (
    <div className="rb" data-testid="recipe-card" data-recipe={recipe.id} data-locked={usable ? "false" : "true"}>
      <div className="rb-head">
        <PotionBottle look={recipe.look} size={64} />
        <h2 className="rb-name" data-testid="recipe-name">{recipe.name}</h2>
      </div>
      {usable ? (
        <>
          <h3 className="rb-sub">1병당 재료</h3>
          <ul className="rb-ings">
            {recipe.additives.map((ad) => {
              const ing = getIngredient(ad.ingredientId);
              return (
                <li key={ad.ingredientId} className="rb-ing">
                  <span className="rb-ing-icon"><IngredientArt ingredient={ing} size={54} /></span>
                  <span className="rb-ing-name">{ing.name}</span>
                  <strong className="rb-ing-amt" data-testid={`recipe-${ad.ingredientId}`}>{ad.amount}{ing.unit}</strong>
                </li>
              );
            })}
          </ul>
          {recipe.legacy && <p className="rb-note">이전 버전 레시피 (진행 중이던 주문용)</p>}
        </>
      ) : (
        <>
          <p className="rb-locked" data-testid="recipe-status"><Icon name="lock" size={24} /> 잠김</p>
          <h3 className="rb-sub">필요한 재료</h3>
          <ul className="rb-ings">
            {requiredIngredients(recipe).map((id) => {
              const ing = getIngredient(id);
              const have = state.unlockedIngredients.includes(id);
              return (
                <li key={id} className={`rb-ing ${have ? "" : "is-locked"}`}>
                  <span className="rb-ing-icon"><IngredientArt ingredient={ing} size={54} /></span>
                  <span className="rb-ing-name">{ing.name}</span>
                  <span className="rb-ing-state">{have ? "있음" : <><Icon name="lock" size={18} /> 서랍에서 해금</>}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** 오른쪽 면: 레시피 고르기 */
function RecipeList({ list, selected, onSelect, state }: { list: Recipe[]; selected: string; onSelect: (id: string) => void; state: GameState }) {
  return (
    <div className="rb-list-wrap">
      <h3 className="rb-sub">레시피 고르기</h3>
      <ul className="rb-list" role="list">
        {list.map((r) => {
          const usable = r.legacy || isRecipeAvailable(r, state.unlockedIngredients);
          return (
            <li key={r.id}>
              <button
                type="button"
                className={`rb-pick ${r.id === selected ? "is-on" : ""} ${usable ? "" : "is-locked"}`}
                aria-pressed={r.id === selected}
                onClick={() => onSelect(r.id)}
                data-testid={`pick-recipe-${r.id}`}
                data-sfx="page"
              >
                <PotionBottle look={r.look} size={34} />
                <span className="rb-pick-name">{r.name}</span>
                {!usable && <span className="rb-pick-lock"><Icon name="lock" size={18} /> 잠김</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 왼쪽 면: 손님이 한 원래 말 + '네?' 쉬운 설명 */
function OrderTalk({ order }: { order: Order }) {
  const customer = getCustomer(order.customerId);
  const app = appearanceOf(order);
  const [showEasy, setShowEasy] = useState(order.askCount > 0);
  return (
    <div className="ob">
      <h2 className="ob-title">이번 주문</h2>
      <p className="book-who">
        <span className="name-tag">{app?.name ?? customer.name}</span> {app?.species ?? customer.species}
      </p>
      <blockquote className="book-quote ob-quote" data-testid="order-original">
        <p>{order.script.greet}</p>
        <p>“{order.script.original}”</p>
      </blockquote>
      <button type="button" className="btn btn-light book-easy-btn" aria-expanded={showEasy} onClick={() => setShowEasy((v) => !v)} data-testid="popup-easy-toggle" data-sfx="page">
        {showEasy ? "쉬운 설명 접기" : "‘네?’ 쉬운 설명 보기"}
      </button>
      {showEasy && (
        <blockquote className="book-quote book-quote-easy ob-quote" data-testid="order-easy">
          <p>{order.script.easy}</p>
        </blockquote>
      )}
    </div>
  );
}

/** 오른쪽 면: '힌트' 버튼 → 재료별 식 (정답·계산 결과 없음) */
function OrderHint({ order, onReveal }: { order: Order; onReveal: () => void }) {
  const [open, setOpen] = useState(false);
  const hints = orderHints(order);
  return (
    <div className="ob-hint">
      {!open ? (
        <div className="ob-hint-start">
          <button
            type="button"
            className="btn btn-hint btn-big ob-hint-btn"
            onClick={() => {
              setOpen(true);
              onReveal();
            }}
            data-testid="order-hint"
            data-sfx="page"
          >
            <Icon name="bulb" size={26} /> 힌트
          </button>
          <p className="ob-hint-note">누르면 재료마다 필요한 식을 보여 줘요. 힌트를 봐도 판매금은 줄지 않아요.</p>
        </div>
      ) : (
        <div data-testid="order-hints">
          <h3 className="ob-hint-title"><Icon name="bulb" size={24} /> 힌트</h3>
          <ul className="ob-hint-list">
            {hints.map((h) => (
              <li key={h.ingredientId} className="ob-hint-item" data-testid={`hint-${h.ingredientId}`} data-mode={h.mode}>
                <span className="ob-hint-ing"><IngredientArt ingredient={getIngredient(h.ingredientId)} size={40} /> {h.name}</span>
                <span className="ob-hint-text">{h.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
