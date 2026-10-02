/**
 * 창구 (Phase 4). 창 너머 손님이 가운데 서 있고 아래에 나무 카운터가 있다.
 * 카운터 왼쪽: 주문서 / 가운데: 포션을 건네는 받침 / 오른쪽: 행동 버튼(위치 고정).
 * 손님 표정: 주문(order) · 쉬운 설명(explain) · 만족(happy) · 조금 아쉬움(meh) · 불만족(sad)
 * 등장·퇴장·반응은 화면 연출일 뿐이고, 판매금·다음 손님은 버튼을 누른 즉시 상태로 처리된다.
 */
import { useEffect, useState, type Dispatch } from "react";
import { getCustomer, type Customer } from "../data/customers.ts";
import { getRecipe } from "../data/recipes.ts";
import { SHOP_ART } from "../data/shopArt.ts";
import { assetUrl } from "../lib/assets.ts";
import { isLastCustomer, type Action } from "../game/reducer.ts";
import { QUALITY_LABEL, QUALITY_PERCENT } from "../game/outcome.ts";
import type { DayState, Order } from "../game/types.ts";
import { AnimalArt, type Mood } from "./art/AnimalArt.tsx";
import { PotionBottle } from "./art/PotionArt.tsx";
import { NightBackdrop } from "./art/NightBackdrop.tsx";
import { Shutters } from "./art/Shutters.tsx";
import { Icon } from "./Icon.tsx";
import { IntroCard } from "./IntroCard.tsx";

export const OPEN_ANIM_MS = 1500;
const LEAVE_MS = 700;

function CustomerSprite({ customer, mood }: { customer: Customer; mood: Mood }) {
  const [broken, setBroken] = useState(false);
  if (customer.image && !broken) {
    return <img className="customer-img" src={assetUrl(customer.image)} alt={customer.name} onError={() => setBroken(true)} />;
  }
  return <AnimalArt species={customer.artKey} mood={mood} label={`${customer.species} ${customer.name}`} />;
}

function moodOf(order: Order): Mood {
  if (order.status === "paid") return order.quality === "okay" ? "meh" : order.quality === "poor" ? "sad" : "happy";
  if (order.status === "arrived" && order.askCount > 0) return "explain";
  return "order";
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

  // 다음 손님: 앞 손님은 인사하며 퇴장(연출), 새 손님 등장. 그동안 '오케이'는 잠금
  const [leaving, setLeaving] = useState<{ customer: Customer; mood: Mood; key: string } | null>(null);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), LEAVE_MS + 200);
    return () => window.clearTimeout(t);
  }, [leaving]);
  const callNext = () => {
    if (order.status !== "paid") return;
    setLeaving({ customer, mood: moodOf(order), key: order.id });
    dispatch({ type: "NEXT_CUSTOMER", fromOrderId: order.id });
  };

  const last = isLastCustomer(day);
  const introOpen = !day.introSeen && day.newTypes.length > 0;
  const arriving = leaving !== null;
  const locked = opening || celebrating || arriving || introOpen;
  const mood = moodOf(order);
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
        {leaving && (
          <div className="customer customer--leaving" key={`leave-${leaving.key}`} aria-hidden="true">
            <CustomerSprite customer={leaving.customer} mood={leaving.mood} />
          </div>
        )}
        <div className="customer customer--here" key={order.id} data-testid="customer" data-mood={mood}>
          {/* 반응 연출은 안쪽에만: 바깥(등장 연출)을 건드리지 않아 반응이 끝나도 등장이 다시 재생되지 않는다 */}
          <div className={`customer-body ${celebrating && order.status === "paid" ? `react-${mood}` : ""}`}>
            <CustomerSprite customer={customer} mood={mood} />
          </div>
        </div>
        <div className="speech-stack" key={`speech-${order.id}`}>
          <div className="speech" role="status" aria-live="polite" data-testid="speech">
            <div className="speech-name">
              <span className="name-tag">{customer.name}</span> {customer.species}
            </div>
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

      <div className="counter-top" style={{ backgroundImage: `url("${assetUrl(SHOP_ART.counterTop)}")` }}>
        <div className="order-ticket" aria-label="주문서">
          <div className="ticket-title">
            손님 {day.currentIndex + 1} / {day.orders.length} · 주문서 #{order.id.replace("order-", "")}
          </div>
          <ul className="ticket-memo" data-testid="ticket-memo">
            {order.script.memo.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}
          </ul>
          <div className="ticket-price">
            정상 판매금 <strong>{order.price}</strong> <Icon name="coin" size={16} />
          </div>
        </div>

        <div className="tray-spot" style={{ backgroundImage: `url("${assetUrl(SHOP_ART.tray)}")` }} aria-label="포션 건네는 곳">
          {(order.status === "bottled" || order.status === "paid") && (
            <div className={`counter-bottles ${order.status === "paid" ? "is-given" : ""}`}>
              {Array.from({ length: Math.min(order.bottles, 9) }, (_, i) => (
                <PotionBottle key={i} look={recipe.look} size={34} quality={order.quality} label={`${recipe.name}`} />
              ))}
            </div>
          )}
        </div>

        <div className="counter-actions">
          {order.status === "arrived" && (
            <div className="ask-row">
              <button type="button" className="btn btn-light btn-big" onClick={() => dispatch({ type: "ASK_AGAIN", orderId: order.id })} disabled={locked} data-testid="ask" data-sfx="page">
                네?
              </button>
              <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "ACCEPT_ORDER", orderId: order.id })} disabled={locked} data-testid="accept">
                오케이 <Icon name="arrow" />
              </button>
            </div>
          )}
          {order.status === "brewing" && (
            <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "GO_WORKBENCH" })} data-testid="back-to-bench">
              제조대로 돌아가기
            </button>
          )}
          {order.status === "bottled" && (
            <button type="button" className="btn btn-gold btn-big" onClick={deliver} disabled={locked} data-testid="deliver" data-sfx="sell">
              <Icon name="potion" /> 포션 전달하기
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
                <button type="button" className="btn btn-gold btn-big" disabled={locked} onClick={onCloseDay} data-testid="close-day" data-sfx="shutterClose">
                  <Icon name="moon" /> 영업 마감
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
        <div className="coin-pop" data-testid="coin-pop" aria-hidden="true">
          +{order.reward} <Icon name="coin" size={30} />
        </div>
      )}

      {introOpen && !opening && (
        <IntroCard dayNumber={day.dayNumber} types={day.newTypes} onClose={() => dispatch({ type: "ACK_INTRO", dayNumber: day.dayNumber })} />
      )}
    </div>
  );
}
