/**
 * '새 레시피 해금' 안내 (한 번만). 재료를 사서 레시피가 처음 쓸 수 있게 되면 뜬다.
 * 구매·해금은 이미 게임 상태에 저장된 뒤이고, 이 팝업은 그것을 알려 줄 뿐이다(확인 전 새로고침해도 돈이 다시 빠지지 않는다).
 * 확인하지 않은 안내는 저장(recipeNotices)에 남아 이어하기 때 다시 뜨고, 확인하면 다시 뜨지 않는다.
 * 물·기본 용액은 표시하지 않는다.
 */
import { useEffect, useRef } from "react";
import { getIngredient } from "../data/ingredients.ts";
import { getRecipe } from "../data/recipes.ts";
import { Icon } from "./Icon.tsx";
import { IngredientArt, PotionBottle } from "./art/PotionArt.tsx";

export function RecipeUnlockNotice({ recipeId, onConfirm }: { recipeId: string; onConfirm: () => void }) {
  const recipe = getRecipe(recipeId);
  const btn = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    btn.current?.focus();
  }, [recipeId]);
  return (
    <div className="modal-backdrop unlock-notice-backdrop" data-testid="recipe-notice-backdrop">
      <section className="unlock-notice" role="dialog" aria-modal="true" aria-labelledby="unlock-notice-title" data-testid="recipe-notice" data-recipe={recipe.id}>
        <p className="unlock-notice-kicker"><Icon name="unlock" size={22} /> 새 레시피 해금</p>
        <h2 id="unlock-notice-title" className="unlock-notice-name">
          <PotionBottle look={recipe.look} size={56} /> {recipe.name}
        </h2>
        <div className="unlock-eq" aria-label={`1병 기준: ${recipe.additives.map((ad) => `${getIngredient(ad.ingredientId).name} ${ad.amount}${getIngredient(ad.ingredientId).unit}`).join(" 더하기 ")}, 그러면 ${recipe.name}`}>
          {recipe.additives.map((ad, i) => {
            const ing = getIngredient(ad.ingredientId);
            return (
              <span key={ad.ingredientId} className="unlock-eq-part">
                {i > 0 && <span className="unlock-eq-op" aria-hidden="true">+</span>}
                <span className="unlock-eq-item">
                  <IngredientArt ingredient={ing} size={72} />
                  <span className="unlock-eq-name">{ing.name}</span>
                  <strong className="unlock-eq-amt" data-testid={`notice-${ing.id}`}>{ad.amount}{ing.unit}</strong>
                </span>
              </span>
            );
          })}
          <span className="unlock-eq-op" aria-hidden="true">=</span>
          <span className="unlock-eq-item unlock-eq-result">
            <PotionBottle look={recipe.look} size={78} />
            <span className="unlock-eq-name">{recipe.name}</span>
          </span>
        </div>
        <p className="unlock-basis">1병 기준</p>
        <p className="unlock-guide">{recipe.additives.length === 2 ? "두 재료를" : "재료를 모두"} 계량해 넣고 저으면 완성!</p>
        <p className="unlock-next" data-testid="notice-next">다음 영업부터 주문이 들어와요.</p>
        <button ref={btn} type="button" className="btn btn-primary btn-big" onClick={onConfirm} data-testid="recipe-notice-ok">
          확인
        </button>
      </section>
    </div>
  );
}
