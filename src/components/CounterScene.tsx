import { useEffect, useState, type Dispatch } from "react";
import { getCustomer, type Customer } from "../data/customers.ts";
import { getRecipe } from "../data/recipes.ts";
import { assetUrl } from "../lib/assets.ts";
import { isLastCustomer, type Action } from "../game/reducer.ts";
import { QUALITY_LABEL, QUALITY_PERCENT } from "../game/outcome.ts";
import type { DayState, Order } from "../game/types.ts";
import { AnimalArt, type Mood } from "./art/AnimalArt.tsx";
import { PotionBottle } from "./art/PotionArt.tsx";
import { NightBackdrop } from "./art/NightBackdrop.tsx";
import { Shutters } from "./art/Shutters.tsx";
import { IntroCard } from "./IntroCard.tsx";

export const OPEN_ANIM_MS = 1500;

function CustomerSprite({ customer, mood }: { customer: Customer; mood: Mood }) {
  const [broken, setBroken] = useState(false);
  if (customer.image && !broken) {
    return <img className="customer-img" src={assetUrl(customer.image)} alt={customer.name} onError={() => setBroken(true)} />;
  }
  return <AnimalArt species={customer.artKey} mood={mood} label={`${customer.species} ${customer.name}`} />;
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
  opening: boolean;
  onOpenEnd: () => void;
  onCloseDay: () => void;
}) {
  const customer = getCustomer(order.customerId);
  const recipe = getRecipe(order.recipeId);

  // 판매 연출: '전달하기'를 누른 렌더에서 바로 잠가 더블클릭이 다음 버튼을 누르지 못하게
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!celebrating) return;
    const t = window.setTimeout(() => setCelebrating(false), 1600);
    return () => window.clearTimeout(t);
  }, [celebrating]);
  const deliver = () => {
    if (order.status !== "bottled") return;
    setCelebrating(true);
    dispatch({ type: "DELIVER", orderId: order.id, now: new Date().toISOString() });
  };

  useEffect(() => {
    if (!opening) return;
    const t = window.setTimeout(onOpenEnd, OPEN_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [opening, onOpenEnd]);

  // 다음 손님 등장: '다음 손님'을 두 번 눌러도 '오케이'가 눌리지 않게 잠깐 잠금
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
  const introOpen = !day.introSeen && day.newTypes.length > 0;
  const locked = opening || celebrating || arriving || introOpen;

  const mood: Mood =
    order.status === "paid" ? (order.quality === "okay" ? "meh" : order.quality === "poor" ? "sad" : "happy")
    : order.status === "bottled" ? "curious"
    : "neutral";
  const lines =
    order.status === "arrived" ? [order.script.greet, order.script.original]
    : order.status === "brewing" ? [order.script.waiting]
    : order.status === "bottled" ? ["와, 제 포션이에요?"]
    : [order.script.reaction ?? ""];

  return (
    <div className={`counter ${opening ? "is-opening" : ""} ${arriving ? "is-arriving" : ""}`}>
      <NightBackdrop />
      <Shutters mode={opening ? "opening" : "open"} />
      <div className="counter-stage">
        <div className="customer" data-testid="customer">
          <CustomerSprite customer={customer} mood={mood} />
        </div>
        <div className="speech-stack">
          <div className="speech" role="status" aria-live="polite" data-testid="speech">
            <div className="speech-name">{customer.species} {customer.name}</div>
            {lines.map((line, i) => (
              <p key={i} className={i === lines.length - 1 ? "speech-main" : ""}>{line}</p>
            ))}
          </div>
          {order.status === "arrived" && order.askCount > 0 && (
            <div className="speech speech-easy" data-testid="easy">
              <div className="speech-name">쉽게 다시 말하면</div>
              <p>{order.script.easy}</p>
            </div>
          )}
        </div>
      </div>

      <div className="counter-top">
        {(order.status === "bottled" || order.status === "paid") && (
          <div className={`counter-bottles ${order.status === "paid" ? "is-given" : ""}`}>
            {Array.from({ length: Math.min(order.bottles, 9) }, (_, i) => (
              <PotionBottle key={i} look={recipe.look} size={38} quality={order.quality} />
            ))}
          </div>
        )}

        <div className="order-ticket" aria-label="주문서">
          <div className="ticket-title">손님 {day.currentIndex + 1} / {day.orders.length} · 주문서 #{order.id.replace("order-", "")}</div>
          <ul className="ticket-memo" data-testid="ticket-memo">
            {order.script.memo.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}
          </ul>
          <div className="ticket-price">
            정상 판매금 <strong>{order.price}</strong> 달빛 동전
          </div>
        </div>

        <div className="counter-actions">
          {order.status === "arrived" && (
            <div className="ask-row">
              <button type="button" className="btn btn-light btn-big" onClick={() => dispatch({ type: "ASK_AGAIN", orderId: order.id })} disabled={locked} data-testid="ask">
                네?
              </button>
              <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "ACCEPT_ORDER", orderId: order.id })} disabled={locked} data-testid="accept">
                오케이 →
              </button>
            </div>
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
                {order.quality ? (
                  <>
                    <span className={`quality q-${order.quality}`} data-testid="quality">{QUALITY_LABEL[order.quality]}</span>{" "}
                    정상 판매금 {order.price}의 {QUALITY_PERCENT[order.quality]}% → 달빛 동전 <strong data-testid="reward">{order.reward}</strong>개를 받았어요.
                  </>
                ) : (
                  <>판매 완료! 달빛 동전 <strong data-testid="reward">{order.reward}</strong>개를 받았어요.</>
                )}
                {last && " 오늘의 마지막 손님이었어요."}
              </p>
              {last ? (
                <button type="button" className="btn btn-gold btn-big" disabled={locked} onClick={onCloseDay} data-testid="close-day">
                  🌙 영업 마감
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-big" disabled={locked} onClick={callNext} data-testid="next">
                  다음 손님 맞이하기
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {celebrating && order.status === "paid" && (
        <div className="coin-pop" data-testid="coin-pop" aria-hidden="true">+{order.reward} 🌙</div>
      )}

      {introOpen && !opening && (
        <IntroCard dayNumber={day.dayNumber} types={day.newTypes} onClose={() => dispatch({ type: "ACK_INTRO", dayNumber: day.dayNumber })} />
      )}
    </div>
  );
}
