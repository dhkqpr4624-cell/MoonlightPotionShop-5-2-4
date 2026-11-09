/**
 * 상점 창: 편의품 2종과 꾸미기 3칸(창구 카운터·상점 벽·제작대).
 * 가격·보유·적용 중을 구분해 보여 준다. 구매·장착·켜기는 게임 규칙(reducer → game/shop.ts)이 다시 검사한다.
 * 미리보기는 돈·소유·장착 상태를 바꾸지 않는다(App이 화면에만 임시로 적용).
 * 창밖 마을 배경은 상품이 아니다.
 */
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { DECOR_ITEMS, DECOR_SLOTS, GADGETS, SLOT_LABEL, type DecorSlot, type GadgetId, type ThemeId } from "../data/shop.ts";
import { COUNTER_SCENE } from "../data/shopArt.ts";
import { assetUrl } from "../lib/assets.ts";
import { ownsItem } from "../game/shop.ts";
import type { GameState } from "../game/types.ts";
import { Icon } from "./Icon.tsx";
import { josa } from "../lib/josa.ts";

export type ShopTab = "gadget" | DecorSlot;

export function ShopModal({
  state, tab, onTab, onBuy, onEquip, onGadget, onPreview, onClose,
}: {
  state: GameState;
  tab: ShopTab;
  onTab: (t: ShopTab) => void;
  onBuy: (itemId: string) => void;
  onEquip: (slot: DecorSlot, theme: ThemeId) => void;
  onGadget: (id: GadgetId, on: boolean) => void;
  onPreview: (slot: DecorSlot, theme: ThemeId) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const shop = state.shop;
  const measuring = state.activeTask !== null;
  const buy = (id: string, price: number, name: string) => {
    if (state.money < price) {
      setNote(`달빛 동전이 ${price - state.money}개 더 필요해요. (가격 ${price} · 지금 ${state.money})`);
      return;
    }
    onBuy(id);
    setNote(`${josa(name, "을/를")} 샀어요.`);
  };
  const onBackdrop = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  const tabs: [ShopTab, string][] = [["gadget", "편의품"], ...DECOR_SLOTS.map((s): [ShopTab, string] => [s, SLOT_LABEL[s]])];

  return (
    <div className="modal-backdrop shop-backdrop" onClick={onBackdrop} data-testid="shop-backdrop">
      <section className="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-title" data-testid="shop-modal">
        <header className="shop-head">
          <h2 id="shop-title"><Icon name="bag" size={24} /> 상점</h2>
          <div className="hud-chip hud-money" aria-label={`달빛 동전 ${state.money}개`}>
            <Icon name="coin" size={20} /> <span data-testid="shop-money">{state.money}</span>
          </div>
          <button ref={closeRef} type="button" className="btn btn-light" onClick={onClose} data-testid="shop-close">
            <Icon name="close" size={18} /> 닫기
          </button>
        </header>
        <p className="shop-sub">재료는 제작대 서랍에서 사요. 여기 상품은 꼭 사지 않아도 되는 선택 구매예요. 창밖 마을 풍경은 바뀌지 않아요.</p>
        <nav className="shop-tabs" role="tablist" aria-label="상품 종류">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`shop-tab ${tab === id ? "is-on" : ""}`} onClick={() => { setNote(null); onTab(id); }} data-testid={`shop-tab-${id}`}>
              {label}
            </button>
          ))}
        </nav>
        {note && <p className="shop-note" role="status" data-testid="shop-note">{note}</p>}
        {measuring && <p className="shop-note" role="status">계량 중에는 살 수 없어요. 계량을 마친 뒤에 사 주세요.</p>}

        <div className="shop-list" role="tabpanel">
          {tab === "gadget" &&
            GADGETS.map((g) => {
              const owned = shop.owned.includes(g.id);
              const on = owned && shop.toggles[g.id];
              return (
                <article key={g.id} className={`shop-card gadget-card ${owned ? "is-owned" : ""}`} data-testid={`item-${g.id}`}>
                  <div className="shop-thumb gadget-thumb"><Icon name={g.id === "glasses" ? "glasses" : "cauldron"} size={54} /></div>
                  <div className="shop-info">
                    <h3>{g.name}</h3>
                    <p className="shop-desc">{g.description}</p>
                    <p className="shop-state">
                      {owned ? <span className="tag tag-owned">보유</span> : <span className="tag tag-price"><Icon name="coin" size={16} /> {g.price}</span>}
                    </p>
                  </div>
                  <div className="shop-actions">
                    {!owned && (
                      <button type="button" className={`btn btn-gold ${state.money < g.price ? "is-short" : ""}`} disabled={measuring} onClick={() => buy(g.id, g.price, g.name)} data-testid={`buy-item-${g.id}`} data-sfx="sell">
                        구매 ({g.price})
                      </button>
                    )}
                    {owned && g.id === "autoCauldron" && (
                      <span className="tag tag-on" data-testid="auto-cauldron-always">항상 적용</span>
                    )}
                    {owned && g.id !== "autoCauldron" && (
                      <label className="switch-row" data-testid={`toggle-${g.id}`}>
                        <input type="checkbox" checked={on} onChange={(e: { currentTarget: HTMLInputElement }) => onGadget(g.id, e.currentTarget.checked)} data-testid={`toggle-input-${g.id}`} />
                        <span className="switch" aria-hidden="true" />
                        {on ? "켜짐" : "꺼짐"}
                      </label>
                    )}
                  </div>
                </article>
              );
            })}
          {tab !== "gadget" &&
            DECOR_ITEMS.filter((d) => d.slot === tab).map((d) => {
              const owned = ownsItem(shop, d.id);
              const equipped = shop.equipped[d.slot] === d.theme;
              return (
                <article key={d.id} className={`shop-card decor-card ${equipped ? "is-equipped" : ""}`} data-testid={`item-${d.id.replace(":", "-")}`}>
                  <DecorThumb slot={d.slot} image={d.image} />
                  <div className="shop-info">
                    <h3>{d.name}</h3>
                    <p className="shop-state">
                      {equipped ? <span className="tag tag-on">적용 중</span> : owned ? <span className="tag tag-owned">보유</span> : <span className="tag tag-price"><Icon name="coin" size={16} /> {d.price}</span>}
                    </p>
                  </div>
                  <div className="shop-actions">
                    {!equipped && (
                      <button type="button" className="btn btn-light" onClick={() => onPreview(d.slot, d.theme)} data-testid={`preview-${d.id.replace(":", "-")}`}>
                        <Icon name="eye" size={16} /> 미리보기
                      </button>
                    )}
                    {!owned && (
                      <button type="button" className={`btn btn-gold ${state.money < d.price ? "is-short" : ""}`} disabled={measuring} onClick={() => buy(d.id, d.price, d.name)} data-testid={`buy-item-${d.id.replace(":", "-")}`} data-sfx="sell">
                        구매 ({d.price})
                      </button>
                    )}
                    {owned && !equipped && (
                      <button type="button" className="btn btn-primary" onClick={() => onEquip(d.slot, d.theme)} data-testid={`equip-${d.id.replace(":", "-")}`}>
                        적용
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      </section>
    </div>
  );
}

/** 상품 그림: 벽은 창밖 마을과 겹쳐, 테이블은 아래쪽만, 제작대는 전체를 작게 */
function DecorThumb({ slot, image }: { slot: DecorSlot; image: string }) {
  return (
    <div className={`shop-thumb decor-thumb thumb-${slot}`} aria-hidden="true">
      {slot === "wall" && <img src={assetUrl(COUNTER_SCENE.village)} alt="" draggable={false} />}
      <img src={assetUrl(image)} alt="" draggable={false} />
    </div>
  );
}
