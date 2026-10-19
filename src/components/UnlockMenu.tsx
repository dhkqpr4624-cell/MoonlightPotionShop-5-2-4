/**
 * 재료 해금 메뉴 (영업 마감 뒤). 돈으로 재료의 사용 권한을 한 번 사면 계속 쓴다.
 * 레시피는 따로 사지 않고, 필요한 재료를 모두 해금하면 자동으로 쓸 수 있다.
 * 판매할 새 재료가 없으면 그렇다고 안내한다(가짜 상품을 채우지 않음).
 * 실제 구매·차감 규칙은 game/unlocks.ts 와 리듀서(UNLOCK_INGREDIENT)가 내부 가격으로 검사한다.
 */
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { getIngredient } from "../data/ingredients.ts";
import { availableRecipes, isRecipeAvailable, requiredIngredients, shopIngredients } from "../game/unlocks.ts";
import { RECIPES } from "../data/recipes.ts";
import type { GameState } from "../game/types.ts";
import { Icon } from "./Icon.tsx";

export function UnlockMenu({ state, onUnlock, onClose }: { state: GameState; onUnlock: (id: string) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const items = shopIngredients();
  const forSale = items.filter((i) => !state.unlockedIngredients.includes(i.id) && i.unlockCost > 0);
  const recipes = Object.values(RECIPES).filter((r) => !r.legacy);
  const usable = availableRecipes(state.unlockedIngredients).length;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="unlock-title" data-testid="unlock-menu" onClick={(e: ReactMouseEvent<HTMLDivElement>) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 id="unlock-title">재료 해금</h3>
        <p className="small">재료를 한 번 해금하면 계속 쓸 수 있어요(재고가 줄지 않아요). 레시피에 필요한 재료를 모두 해금하면 그 레시피 주문이 나오기 시작해요.</p>
        <ul className="unlock-list" data-testid="unlock-ingredients">
          {items.map((ing) => {
            const owned = state.unlockedIngredients.includes(ing.id);
            const lack = state.money < ing.unlockCost;
            return (
              <li key={ing.id} data-testid={`unlock-${ing.id}`}>
                <span className="unlock-info">
                  <strong>{ing.name}</strong>
                  <span className="muted small">{ing.description}</span>
                </span>
                {owned ? (
                  <span className="unlock-state"><Icon name="check" size={16} /> 사용 가능</span>
                ) : (
                  <button type="button" className="btn btn-gold" disabled={lack} onClick={() => onUnlock(ing.id)} data-testid={`buy-${ing.id}`}>
                    <Icon name="coin" size={16} /> {ing.unlockCost} 해금
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {forSale.length === 0 && (
          <p className="unlock-empty" data-testid="unlock-empty">지금은 새로 해금할 재료가 없어요. 새 재료와 레시피는 다음 업데이트에서 추가될 예정이에요.</p>
        )}
        <h3>레시피</h3>
        <ul className="unlock-list" data-testid="unlock-recipes">
          {recipes.map((r) => (
            <li key={r.id}>
              <span className="unlock-info">
                <strong>{r.name}</strong>
                <span className="muted small">필요한 재료: {requiredIngredients(r).map((id) => getIngredient(id).name).join(", ")}</span>
              </span>
              <span className="unlock-state">{isRecipeAvailable(r, state.unlockedIngredients) ? "사용 가능" : "재료 필요"}</span>
            </li>
          ))}
        </ul>
        <p className="small muted">사용 가능한 레시피 {usable}개 · 달빛 동전 {state.money}개</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose} ref={closeRef} data-testid="unlock-close">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
