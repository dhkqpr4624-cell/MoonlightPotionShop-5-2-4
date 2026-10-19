/**
 * 창구 (Phase 4, PNG 창구). 창밖 손님이 아치 창 안에 서 있고 아래에 나무 테이블이 있다(art/ShopScene.tsx).
 * 카운터 왼쪽: 주문서 / 가운데: 포션을 건네는 받침 / 오른쪽: 행동 버튼(위치 고정).
 * 손님 표정: 주문(order) · 쉬운 설명(explain) · 만족(happy) · 조금 아쉬움(meh) · 불만족(sad)
 * 등장·퇴장·반응은 화면 연출일 뿐이고, 판매금·다음 손님은 버튼을 누른 즉시 상태로 처리된다.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Dispatch } from "react";
import { getCustomer } from "../data/customers.ts";
import { appearanceOf, type Appearance } from "../data/appearances.ts";
import { getRecipe } from "../data/recipes.ts";
import { SHOP_ART } from "../data/shopArt.ts";
import { assetUrl } from "../lib/assets.ts";
import { isLastCustomer, type Action } from "../game/reducer.ts";
import { QUALITY_LABEL, QUALITY_PERCENT } from "../game/outcome.ts";
import type { DayState, Order } from "../game/types.ts";
import type { Mood } from "./art/AnimalArt.tsx";
import { PotionBottle } from "./art/PotionArt.tsx";
import { SceneNpc, ShopScene, npcBox, useSceneLayout, type SceneLayout } from "./art/ShopScene.tsx";
import { Icon } from "./Icon.tsx";
import { IntroCard } from "./IntroCard.tsx";

export const OPEN_ANIM_MS = 1500;
const LEAVE_MS = 700;

/** 대사창 자리: 넓은 화면은 손님 오른쪽(얼굴 옆), 좁은 화면은 위쪽 가득 */
function speechStyle(app: Appearance | null, layout: SceneLayout): { style: CSSProperties; side: boolean } {
  const pad = 12;
  if (!app || layout.narrow) return { style: { left: pad, right: pad, top: pad }, side: false };
  const b = npcBox(app, layout);
  const standScreenX = layout.sceneLeft + (b.left + app.display.centerX * b.k) * layout.s;
  const left = standScreenX + 200 * layout.s;
  const width = Math.min(430, layout.width - left - 16);
  if (width < 280) return { style: { left: pad, right: pad, top: pad }, side: false };
  const headTop = layout.sceneTop + (b.top + Math.max(0, app.display.headY - 260) * b.k) * layout.s;
  return { style: { left, width, top: Math.max(pad, headTop) }, side: true };
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
  const app = appearanceOf(order);
  const recipe = getRecipe(order.recipeId);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const layout = useSceneLayout(boxRef, contentRef);
  // 좁은 화면: 위에 놓인 대사창 높이만큼 손님 귀 끝을 내려 둔다
  const speechRef = useRef<HTMLDivElement | null>(null);
  const [speechBottom, setSpeechBottom] = useState(0);
  useLayoutEffect(() => {
    const el = speechRef.current;
    if (!el) return;
    const measure = () => setSpeechBottom(el.offsetTop + el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [order.id, layout.narrow, layout.width, layout.height]);

  // 오늘 손님들의 그림을 미리 읽어 다음 손님이 바로 보이게
  useEffect(() => {
    for (const o of day.orders) {
      const a = appearanceOf(o);
      if (!a) continue;
      const img = new Image();
      img.src = assetUrl(a.image);
    }
  }, [day.dayNumber, day.orders.length]);

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
  const [leaving, setLeaving] = useState<{ order: Order; mood: Mood; key: string } | null>(null);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), LEAVE_MS + 200);
    return () => window.clearTimeout(t);
  }, [leaving]);
  const callNext = () => {
    if (order.status !== "paid") return;
    setLeaving({ order, mood: moodOf(order), key: order.id });
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

  const speech = speechStyle(app, layout);
  const reserveTop = speech.side ? 0 : speechBottom + 8;
  const leavingApp = leaving ? appearanceOf(leaving.order) : null;
  const leavingCustomer = leaving ? getCustomer(leaving.order.customerId) : null;
  const displayName = app?.name ?? customer.name;
  const displaySpecies = app?.species ?? customer.species;

  return (
    <div
      ref={boxRef}
      className={`counter counter--scene ${opening ? "is-opening" : ""} ${arriving ? "is-arriving" : ""} ${layout.narrow ? "is-narrow" : ""}`}
      style={{ "--scene-s": layout.s.toFixed(4) } as CSSProperties}
    >
      <ShopScene layout={layout} shutterMode={opening ? "opening" : "open"}>
        {leaving && leavingApp && leavingCustomer && (
          <SceneNpc
            key={`leave-${leaving.key}`}
            app={leavingApp}
            species={leavingCustomer.artKey}
            layout={layout}
            mood={leaving.mood}
            className="npc--leaving"
            reserveTop={reserveTop}
            label={`${leavingApp.species} ${leavingApp.name}`}
          />
        )}
        {app && (
          <SceneNpc
            key={order.id}
            app={app}
            species={customer.artKey}
            layout={layout}
            mood={mood}
            className="npc--here"
            reserveTop={reserveTop}
            react={celebrating && order.status === "paid" ? `react-${mood}` : ""}
            label={`${app.species} ${app.name}`}
            testId="customer"
          />
        )}
      </ShopScene>
      <div className="counter-stage" style={{ height: layout.tableY }}>
        <div ref={speechRef} className={`speech-stack ${speech.side ? "is-side" : "is-top"}`} key={`speech-${order.id}`} style={speech.style} data-testid="speech-stack">
          <div className="speech" role="status" aria-live="polite" data-testid="speech">
            <div className="speech-name">
              <span className="name-tag" data-testid="npc-name">{displayName}</span> {displaySpecies}
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

      <div
        className="counter-base"
        style={{ top: layout.tableY, left: layout.counterLeft, width: layout.counterWidth, height: layout.counterH }}
        data-testid="counter-base"
      >
        <div className="counter-top" ref={contentRef}>
        {/* 작은 주문 요약: 손님 순서와 정상 판매가(품질 감액 전 금액)만. 자세한 주문은 손님 대사와 제작대 주문서에서 */}
        <div className="order-ticket order-ticket--mini" aria-label="주문 요약" data-testid="order-ticket">
          <div className="ticket-row" data-testid="ticket-customer">
            손님 <strong>{day.currentIndex + 1} / {day.orders.length}</strong>
          </div>
          <div className="ticket-row ticket-price" data-testid="ticket-price">
            정상 판매가 <Icon name="coin" size={18} /> <strong>{order.price}G</strong>
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
