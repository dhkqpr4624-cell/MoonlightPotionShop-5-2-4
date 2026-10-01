/**
 * 내보내기·가져오기.
 * - 저장 데이터 파일: 다시 이어하기 위한 게임 상태 전체
 * - 학습 결과 파일: 개인 식별 정보 없이 문제별 기록과 영업별 집계 (가져오기 대상 아님)
 */
import { LEARNING_TYPES } from "../data/learningTypes.ts";
import { dayProblemCounts } from "./daySummary.ts";
import { interpretSaveData, SAVE_VERSION } from "./save.ts";
import type { GameState } from "./types.ts";

export const SAVE_FILE_FORMAT = "moonlight-potion-shop/save";
export const LEARNING_FILE_FORMAT = "moonlight-potion-shop/learning";
export const MAX_IMPORT_BYTES = 2_000_000;

export function buildSaveExport(state: GameState, now: string) {
  return {
    format: SAVE_FILE_FORMAT,
    saveVersion: SAVE_VERSION,
    exportedAt: now,
    game: state,
  };
}

export function buildLearningExport(state: GameState, now: string) {
  const day = state.day;
  return {
    format: LEARNING_FILE_FORMAT,
    version: 1,
    exportedAt: now,
    note: "이름 등 개인 식별 정보는 들어 있지 않습니다. dayNumber 0은 Phase 1(하루 영업 도입 전) 기록입니다.",
    days: state.dayHistory,
    currentDay:
      day && day.status === "open"
        ? {
            dayNumber: day.dayNumber,
            status: "영업 중",
            customerNumber: day.currentIndex + 1,
            customersServed: day.orders.filter((o) => o.status === "paid").length,
            moneyEarned: day.moneyEarned,
            ...dayProblemCounts(day),
          }
        : null,
    problems: state.records.map((r) => ({
      problemId: r.problemId,
      dayNumber: r.dayNumber,
      customerNumber: r.customerNumber,
      ingredientId: r.ingredientId,
      learningType: r.learningType,
      learningTypeLabel: `${LEARNING_TYPES[r.learningType].number} ${LEARNING_TYPES[r.learningType].label}`,
      expression: `${r.a} × ${r.b}`,
      a: r.a,
      b: r.b,
      answer: r.answer,
      firstAnswer: r.firstAnswer,
      firstCorrect: r.firstCorrect,
      attempts: r.attempts,
      hintUsed: r.hintLevel > 0,
      hintLevel: r.hintLevel,
      solved: r.solved,
      solvedAt: r.solvedAt,
    })),
  };
}

export type ImportResult =
  | { ok: true; state: GameState; migratedFrom: number | null }
  | { ok: false; errors: string[] };

/** 가져올 파일의 내용을 검사한다. 실패해도 현재 저장은 건드리지 않는다 */
export function parseImportText(text: string, seed: number): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errors: ["파일이 너무 큽니다."] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["JSON 파일이 아니거나 내용이 손상되었습니다."] };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, errors: ["저장 데이터 형식이 아닙니다."] };
  }
  const obj = data as Record<string, unknown>;
  let game: unknown = obj;
  if ("format" in obj) {
    if (obj.format === LEARNING_FILE_FORMAT) {
      return { ok: false, errors: ["학습 결과 파일은 기록 확인용이라 가져올 수 없어요. ‘저장 데이터’ 파일을 골라 주세요."] };
    }
    if (obj.format !== SAVE_FILE_FORMAT) return { ok: false, errors: ["달빛 포션 상점의 저장 파일이 아닙니다."] };
    game = obj.game;
  }
  const r = interpretSaveData(game, seed);
  if (!r.ok) return { ok: false, errors: r.errors };
  // 가져온 뒤에는 타이틀에서 이어하기로 시작
  return { ok: true, state: { ...r.state, scene: "title" }, migratedFrom: r.migratedFrom };
}

export function exportFileName(kind: "save" | "learning", state: GameState, now: Date): string {
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const dayPart = state.day ? `-day${state.day.dayNumber}` : "";
  return kind === "save" ? `moonlight-save${dayPart}-${d}.json` : `moonlight-learning${dayPart}-${d}.json`;
}
