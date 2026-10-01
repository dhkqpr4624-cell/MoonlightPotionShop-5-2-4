import { useEffect, useState, type Dispatch } from "react";
import { getCustomer, type Customer } from "../data/customers.ts";
import { getRecipe } from "../data/recipes.ts";
import { getIngredient } from "../data/ingredients.ts";
import { assetUrl } from "../lib/assets.ts";
import { isLastCustomer, type Action } from "../game/reducer.ts";
import type { DayState, Order } from "../game/types.ts";
import { FoxArt, type Mood } from "./art/FoxArt.tsx";
import { PotionBottle } from "./art/PotionArt.tsx";
import { NightBackdrop } from "./art/NightBackdrop.tsx";
import { Shutters } from "./art/Shutters.tsx";

export const OPEN_ANIM_MS = 1500;

function CustomerSprite({ customer, mood }: { customer: Customer; mood: Mood }) {
  const [broken, setBroken] = useState(false);
  if (customer.image && !broken) {
    return <img className="customer-img" src={assetUrl(customer.image)} alt={customer.name} onError={() => setBroken(true)} />;
  }
  return <FoxArt mood={mood} />;
}

export function CounterScene({
  day,
  order,
  dispatch,
  opening,
  onOpenEnd,
  onCloseDay,
}: {
  day: DayState;
  order: Order;
  dispatch: Dispatch<Action>;
  /** 다음 날(또는 첫날) 시작 직후: 덧문이 열리고 첫 손님이 등장하는 연출 */
  opening: boolean;
  onOpenEnd: () => void;
  onCloseDay: () => void;
}) {
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
    dispatch({ type: "DELIVER", orderId: order.id });
  };

  useEffect(() => {
    if (!opening) return;
    const t = window.setTimeout(onOpenEnd, OPEN_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [opening, onOpenEnd]);

  // 다음 손님 등장 연출. 클릭과 같은 렌더에서 잠그므로, '다음 손님'을 두 번 눌러도
  // 같은 자리에 나타나는 '주문 받기'가 눌리지 않는다.
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    if (!arriving) return;
    const t = window.setTimeout(() => setArriving(false), 800);
    return () => window.clearTimeout(t);
  }, [arriving]);
  const callNext = () => {
    if (order.status !== "paid") return;
    setArriving(true);
    dispatch({ type: "NEXT_CUSTOMER", fromOrderId: order.id });
  };

  const last = isLastCustomer(day);
  const locked = opening || celebrating || arriving;

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
    <div className={`counter ${opening ? "is-opening" : ""} ${arriving ? "is-arriving" : ""}`}>
      <NightBackdrop />
      <Shutters mode={opening ? "opening" : "open"} />
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
          <div className="ticket-title">
            손님 {day.currentIndex + 1} / {day.orders.length} · 주문서 #{order.id.replace("order-", "")}
          </div>
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
            <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "ACCEPT_ORDER" })} disabled={locked} data-testid="accept">
              주문 받기 → 제조대로
            </button>
          )}
          {order.status === "brewing" && (
            <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "GO_WORKBENCH" })} data-testid="back-to-bench">
              제조대로 돌아가기
            </button>
          )}
          {order.status === "bottled" && (
            <button type="button" className="btn btn-gold btn-big" onClick={deliver} disabled={locked} data-testid="deliver">
              🧪 포션 전달하기
            </button>
          )}
          {order.status === "paid" && (
            <>
              <p className="paid-text" data-testid="paid-text">
                판매 완료! 달빛 동전 {order.price}개를 받았어요.
                {last && " 오늘의 마지막 손님이었어요."}
              </p>
              {/* 전달 버튼을 두 번 눌러도 감사 장면을 건너뛰지 않도록, 동전 연출 동안은 잠시 비활성 */}
              {last ? (
                <button type="button" className="btn btn-gold btn-big" disabled={locked} onClick={onCloseDay} data-testid="close-day">
                  🌙 영업 마감
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-big"
                  disabled={locked}
                  onClick={callNext}
                  data-testid="next"
                >
                  다음 손님 맞이하기
                </button>
              )}
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
