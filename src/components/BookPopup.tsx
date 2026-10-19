/**
 * 책 모양 팝업 (레시피 / 이번 주문). 배경은 펼친 책 PNG(public/assets/shop/workbench/book-panel.png, 1536×1024).
 * 글자는 HTML로 양쪽 종이 안쪽(PAGE_L·PAGE_R)에만 놓고, 길면 종이 안에서 스크롤한다.
 *
 * - 저장된 주문 데이터(order.script 등)만 읽는다. 열 때 새 주문이나 대사를 만들지 않는다.
 * - 기본 화면에는 계산식이나 정답을 보여 주지 않는다.
 * - 닫기: 닫기 버튼·Esc·책 바깥 클릭. 바깥 클릭은 click 이벤트로 닫아 뒤쪽 항아리에 클릭이 전달되지 않는다.
 * - 열려 있는 동안 뒤쪽 조작은 막히고, 초점은 팝업 안에서만 돈다. 닫으면 연 버튼으로 초점을 돌린다(부모가 처리).
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { appearanceOf } from "../data/appearances.ts";
import { getCustomer } from "../data/customers.ts";
import { getIngredient } from "../data/ingredients.ts";
import { getRecipe } from "../data/recipes.ts";
import { WORKBENCH_SCENE as WB } from "../data/shopArt.ts";
import { assetUrl } from "../lib/assets.ts";
import { isRecipeAvailable, requiredIngredients } from "../game/unlocks.ts";
import type { GameState, Order } from "../game/types.ts";
import { Icon } from "./Icon.tsx";
import { PotionBottle } from "./art/PotionArt.tsx";

export type BookKind = "recipe" | "order";

/** 책 PNG(1536×1024) 안의 종이 안쪽 (장식 테두리·가운데 접힘선 피함) */
const BOOK = { w: 1536, h: 1024 };
const PAGE_L = { x: 222, y: 128, w: 482, h: 632 };
const PAGE_R = { x: 852, y: 128, w: 466, h: 632 };
const pct = (p: { x: number; y: number; w: number; h: number }) => ({
  left: `${(p.x / BOOK.w) * 100}%`, top: `${(p.y / BOOK.h) * 100}%`, width: `${(p.w / BOOK.w) * 100}%`, height: `${(p.h / BOOK.h) * 100}%`,
});

export function BookPopup({ kind, state, order, onClose }: { kind: BookKind; state: GameState; order: Order; onClose: () => void }) {
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
    const items = [...boxRef.current.querySelectorAll<HTMLElement>("button, [tabindex='0']")];
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

  return (
    <div className="book-backdrop" onClick={onBackdrop} data-testid="book-backdrop">
      <div className="book-popup" role="dialog" aria-modal="true" aria-labelledby="book-title" ref={boxRef} onKeyDown={trap} data-testid="book-popup" data-kind={kind}>
        <img className="book-bg" src={assetUrl(WB.bookPanel)} alt="" draggable={false} />
        <div className="book-page book-page-l" style={pct(PAGE_L)} tabIndex={0} data-testid="book-page-left">
          <h2 id="book-title" className="book-title">{title}</h2>
          {kind === "recipe" ? <RecipeLeft order={order} /> : <OrderLeft order={order} />}
        </div>
        <div className="book-page book-page-r" style={pct(PAGE_R)} tabIndex={0} data-testid="book-page-right">
          {kind === "recipe" ? <RecipeRight state={state} order={order} /> : <OrderRight order={order} />}
        </div>
        <button type="button" className="book-close" onClick={onClose} ref={closeRef} aria-label={`${title} 닫기`} data-testid="popup-close" data-sfx="page">
          <Icon name="close" size={22} /> 닫기
        </button>
      </div>
    </div>
  );
}

function RecipeLeft({ order }: { order: Order }) {
  const recipe = getRecipe(order.recipeId);
  return (
    <>
      <div className="book-recipe-name">
        <PotionBottle look={recipe.look} size={56} />
        <strong data-testid="recipe-name">{recipe.name}</strong>
      </div>
      <p>{recipe.summary}</p>
      <p className="book-muted">{recipe.lookText}</p>
      {recipe.legacy && <p className="book-note">이 레시피는 이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요. 다음 영업부터는 기력 포션 주문이 나와요.</p>}
    </>
  );
}

function RecipeRight({ state, order }: { state: GameState; order: Order }) {
  const recipe = getRecipe(order.recipeId);
  const usable = isRecipeAvailable(recipe, state.unlockedIngredients);
  return (
    <>
      <h3 className="book-sub">1병당 넣는 재료</h3>
      <ul className="book-list">
        {recipe.additives.map((ad) => {
          const ing = getIngredient(ad.ingredientId);
          return (
            <li key={ad.ingredientId}>
              <strong>{ing.name}</strong> <span data-testid={`recipe-${ad.ingredientId}`}>{ad.amount}{ing.unit}</span>
              <span className="book-muted"> · 직접 계량</span>
            </li>
          );
        })}
        <li>
          <strong>{recipe.baseSolution.name}</strong> {recipe.baseSolution.amountMl}mL
          <span className="book-muted"> · 자동</span>
        </li>
      </ul>
      <p className="book-note">기본 용액은 병 수에 맞춰 자동으로 담겨요. 계량 문제가 아니에요. 첨가물을 더한 양이 병 전체의 양은 아니에요.</p>
      <h3 className="book-sub">해금 상태</h3>
      <p data-testid="recipe-status">
        {recipe.legacy ? "이전 버전 레시피 (진행 중이던 영업용)" : usable ? "사용 가능" : "아직 못 써요"}
      </p>
      {!recipe.legacy && (
        <ul className="book-list">
          {requiredIngredients(recipe).map((id) => (
            <li key={id}>
              {getIngredient(id).name}: {state.unlockedIngredients.includes(id) ? "해금됨" : "해금 필요"}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OrderLeft({ order }: { order: Order }) {
  const customer = getCustomer(order.customerId);
  const app = appearanceOf(order);
  const [showEasy, setShowEasy] = useState(order.askCount > 0);
  return (
    <>
      <p className="book-who">
        <span className="name-tag">{app?.name ?? customer.name}</span> {app?.species ?? customer.species}
      </p>
      <h3 className="book-sub">손님이 한 말</h3>
      <blockquote className="book-quote" data-testid="order-original">
        <p>{order.script.greet}</p>
        <p>“{order.script.original}”</p>
      </blockquote>
      <button type="button" className="btn btn-light book-easy-btn" aria-expanded={showEasy} onClick={() => setShowEasy((v) => !v)} data-testid="popup-easy-toggle" data-sfx="page">
        {showEasy ? "쉬운 설명 접기" : "‘네?’ 쉬운 설명 보기"}
      </button>
      {showEasy && (
        <blockquote className="book-quote book-quote-easy" data-testid="order-easy">
          <p>{order.script.easy}</p>
        </blockquote>
      )}
    </>
  );
}

function OrderRight({ order }: { order: Order }) {
  const recipe = getRecipe(order.recipeId);
  return (
    <>
      <h3 className="book-sub">주문 내용</h3>
      <ul className="book-list" data-testid="order-memo">
        {order.script.memo.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
      <h3 className="book-sub">지금 필요한 일</h3>
      <ul className="book-list" data-testid="order-tasks">
        {order.tasks.map((t) => {
          const ing = getIngredient(t.ingredientId);
          const how = t.mode === "specified" ? "손님 지정량 그대로" : t.mode === "concept" ? "지난번과 비교해 고르기" : "계산해서 계량";
          const status = t.status === "done" ? `넣음 (${t.addedAmount}${ing.unit})` : t.status === "measured" ? "계량함, 아직 안 넣음" : "아직";
          return (
            <li key={t.problemId}>
              <strong>{ing.name}</strong>({ing.unit}) · {how} — {status}
            </li>
          );
        })}
        <li>
          젓기 — {order.stirProgress >= 100 ? "다 저음" : `${order.stirProgress}%`}
        </li>
      </ul>
      <p className="book-muted">
        {recipe.name} · 정상 판매금 {order.price}
      </p>
    </>
  );
}
