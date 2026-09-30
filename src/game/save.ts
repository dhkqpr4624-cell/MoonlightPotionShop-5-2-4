/**
 * localStorage 저장. 저장 데이터에는 버전이 있고, 형식이 맞지 않으면 쓰지 않는다.
 * 판매금과 주문 상태는 한 덩어리(JSON 한 개)로 저장되므로
 * 새로고침 시점과 상관없이 "돈은 받았는데 주문은 안 끝난" 상태가 생기지 않는다.
 * (2단계: JSON 내보내기·가져오기와 버전 마이그레이션을 이 파일에 추가)
 */
import type { GameState } from "./types.ts";

export const SAVE_KEY = "moonlight-potion-shop/save";
export const SAVE_VERSION = 1;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 최소한의 형식 검사 */
export function isValidSave(data: unknown): data is GameState {
  if (!isObject(data)) return false;
  if (data.saveVersion !== SAVE_VERSION) return false;
  if (typeof data.money !== "number" || !Number.isFinite(data.money) || data.money < 0) return false;
  if (!["title", "counter", "workbench"].includes(data.scene as string)) return false;
  if (typeof data.nextOrderNumber !== "number") return false;
  if (!Array.isArray(data.records) || !Array.isArray(data.paidOrderIds)) return false;
  if (!isObject(data.deck) || !isObject(data.stats)) return false;
  if (data.order !== null) {
    if (!isObject(data.order) || !Array.isArray(data.order.tasks)) return false;
    if (!["arrived", "brewing", "bottled", "paid"].includes(data.order.status as string)) return false;
  }
  return true;
}

export function loadGame(storage: StorageLike | null = defaultStorage()): GameState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return isValidSave(data) ? data : null;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* 무시 */
  }
}
