import { useEffect, useState, type Dispatch } from "react";
import { getCustomer, type Customer } from "../data/customers.ts";
import { getRecipe } from "../data/recipes.ts";
import { getIngredient } from "../data/ingredients.ts";
import { assetUrl } from "../lib/assets.ts";
import { newSeed } from "../lib/rng.ts";
import type { Action } from "../game/reducer.ts";
import type { GameState, Order } from "../game/types.ts";
import { FoxArt, type Mood } from "./art/FoxArt.tsx";
import { PotionBottle } from "./art/PotionArt.tsx";
import { NightBackdrop } from "./art/NightBackdrop.tsx";

function CustomerSprite({ customer, mood }: { customer: Customer; mood: Mood }) {
  const [broken, setBroken] = useState(false);
  if (customer.image && !broken) {
    return <img className="customer-img" src={assetUrl(customer.image)} alt={customer.name} onError={() => setBroken(true)} />;
  }
  return <FoxArt mood={mood} />;
}

export function CounterScene({ state, dispatch }: { state: GameState; dispatch: Dispatch<Action> }) {
  const order = state.order as Order;
  const customer = getCustomer(order.customerId);
  const recipe = getRecipe(order.recipeId);

  // 판매금 획득 연출: 이번 화면에서 실제로 '전달하기'를 눌렀을 때만 재생 (새로고침 후 재생 안 함).
  // 클릭과 같은 렌더에서 celebrating=true가 되므로, 더블클릭의 두 번째 클릭이
  // 같은 자리에 나타나는 '다음 손님' 버튼을 누르지 못한다.
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!celebrating) return;
    const t = window.setTimeout(() => setCelebrating(false), 1600);
    return () => window.clearTimeout(t);
  }, [celebrating]);
  const coinPop = celebrating && order.status === "paid" ? order.price : null;
  const deliver = () => {
    if (order.status !== "bottled") return;
    setCelebrating(true);
    dispatch({ type: "DELIVER" });
  };

  const mood: Mood = order.status === "paid" ? "happy" : order.status === "bottled" ? "curious" : "neutral";
  const speech =
    order.status === "arrived"
      ? [order.lines.greet, order.lines.order]
      : order.status === "brewing"
        ? [order.lines.waiting]
        : order.status === "bottled"
          ? ["와, 제 포션이에요?"]
          : [order.lines.thanks];

  return (
    <div className="counter">
      <NightBackdrop />
      <div className="counter-stage">
        <div className="customer" data-testid="customer">
          <CustomerSprite customer={customer} mood={mood} />
        </div>
        <div className="speech" role="status" aria-live="polite" data-testid="speech">
          <div className="speech-name">
            {customer.species} {customer.name}
          </div>
          {speech.map((line, i) => (
            <p key={i} className={i === speech.length - 1 ? "speech-main" : ""}>
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="counter-top">
        {(order.status === "bottled" || order.status === "paid") && (
          <div className={`counter-bottles ${order.status === "paid" ? "is-given" : ""}`}>
            {Array.from({ length: order.bottles }, (_, i) => (
              <PotionBottle key={i} look={recipe.look} size={40} />
            ))}
          </div>
        )}

        <div className="order-ticket" aria-label="주문서">
          <div className="ticket-title">주문서 #{order.id.replace("order-", "")}</div>
          <div className="ticket-line">
            <PotionBottle look={recipe.look} size={26} />
            <span>
              {recipe.name} <strong>{order.bottles}병</strong>
            </span>
          </div>
          <div className="ticket-sub">
            {recipe.additives.map((ad) => getIngredient(ad.ingredientId).name).join(" · ")} 계량 필요
          </div>
          <div className="ticket-price">
            판매가 <strong>{order.price}</strong> 달빛 동전
          </div>
        </div>

        <div className="counter-actions">
          {order.status === "arrived" && (
            <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "ACCEPT_ORDER" })} data-testid="accept">
              주문 받기 → 제조대로
            </button>
          )}
          {order.status === "brewing" && (
            <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "GO_WORKBENCH" })} data-testid="back-to-bench">
              제조대로 돌아가기
            </button>
          )}
          {order.status === "bottled" && (
            <button type="button" className="btn btn-gold btn-big" onClick={deliver} data-testid="deliver">
              🧪 포션 전달하기
            </button>
          )}
          {order.status === "paid" && (
            <>
              <p className="paid-text" data-testid="paid-text">
                판매 완료! 달빛 동전 {order.price}개를 받았어요.
              </p>
              {/* 전달 버튼을 두 번 눌러도 인사 장면을 건너뛰지 않도록, 동전 연출 동안은 잠시 비활성 */}
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={celebrating}
                onClick={() => dispatch({ type: "NEXT_CUSTOMER", seed: newSeed() })}
                data-testid="next"
              >
                다음 손님 맞이하기
              </button>
            </>
          )}
        </div>
      </div>

      {coinPop !== null && (
        <div className="coin-pop" data-testid="coin-pop" aria-hidden="true">
          +{coinPop} 🌙
        </div>
      )}
    </div>
  );
}
