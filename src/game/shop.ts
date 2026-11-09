/**
 * 상점 규칙 (순수 함수). 가격은 언제나 data/shop.ts 에서 읽는다. 화면이 보낸 값을 믿지 않는다.
 *  - 이미 산 상품을 다시 사도 돈을 빼지 않는다. 잔액이 모자라면 아무것도 바꾸지 않는다.
 *  - 기본 장식은 처음부터 가진 것으로 본다(값 0, 살 수 없음).
 *  - 장착은 가진 장식만. 다시 장착할 때는 돈이 들지 않는다.
 *  - 편의품 켜기는 산 것만. 끄기는 언제나.
 */
import { DECOR_SLOTS, GADGETS, getDecor, getGadget, THEME_IDS, type DecorSlot, type GadgetId, type ThemeId } from "../data/shop.ts";
import type { ShopState } from "./types.ts";

export function defaultShop(): ShopState {
  return { owned: [], equipped: { counter: "basic", wall: "basic", bench: "basic" }, toggles: { glasses: false, autoCauldron: false } };
}

export function ownsItem(shop: ShopState, itemId: string): boolean {
  const d = getDecor(itemId);
  if (d && d.theme === "basic") return true;
  return shop.owned.includes(itemId);
}

export type BuyFailure = "unknown" | "notForSale" | "already" | "insufficient";
export type BuyResult = { ok: true; money: number; shop: ShopState; cost: number } | { ok: false; reason: BuyFailure };

export function tryBuy(money: number, shop: ShopState, itemId: string): BuyResult {
  const d = getDecor(itemId);
  const g = getGadget(itemId);
  if (!d && !g) return { ok: false, reason: "unknown" };
  if (d && d.theme === "basic") return { ok: false, reason: "notForSale" };
  if (shop.owned.includes(itemId)) return { ok: false, reason: "already" };
  const cost = (d?.price ?? g?.price)!;
  if (money < cost) return { ok: false, reason: "insufficient" };
  const owned = [...shop.owned, itemId];
  // 편의품은 사자마자 켜 둔다 (상점 창에서 언제든 끌 수 있다)
  const toggles = g ? { ...shop.toggles, [g.id]: true } : shop.toggles;
  return { ok: true, money: money - cost, cost, shop: { ...shop, owned, toggles } };
}

export function tryEquip(shop: ShopState, slot: DecorSlot, theme: ThemeId): ShopState | null {
  if (!DECOR_SLOTS.includes(slot) || !THEME_IDS.includes(theme)) return null;
  if (!ownsItem(shop, `${slot}:${theme}`)) return null;
  if (shop.equipped[slot] === theme) return null;
  return { ...shop, equipped: { ...shop.equipped, [slot]: theme } };
}

export function trySetGadget(shop: ShopState, id: GadgetId, on: boolean): ShopState | null {
  if (!GADGETS.some((g) => g.id === id)) return null;
  // 마녀의 자동 솥은 켜기·끄기가 없다 (가지고 있으면 늘 적용)
  if (id === "autoCauldron") return null;
  if (on && !shop.owned.includes(id)) return null;
  if (shop.toggles[id] === on) return null;
  return { ...shop, toggles: { ...shop.toggles, [id]: on } };
}

/** 편의품이 실제로 켜져 있는지 (산 것 + 켬). 자동 솥은 가지고 있으면 늘 켜진 것으로 본다 */
export function gadgetOn(shop: ShopState, id: GadgetId): boolean {
  if (id === "autoCauldron") return shop.owned.includes(id);
  return shop.owned.includes(id) && shop.toggles[id];
}

export const BUY_MESSAGE: Record<BuyFailure, string> = {
  unknown: "없는 상품이에요.",
  notForSale: "처음부터 가진 장식이에요.",
  already: "이미 산 상품이에요.",
  insufficient: "달빛 동전이 모자라요.",
};
