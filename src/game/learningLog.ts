/**
 * 개인 학습 기록 보기·내보내기용 정리.
 * - 완료: 유효한 답을 낸 문제 (problemLog)
 * - 미완료: 오늘 주문을 받았지만 아직 답을 내지 않은 과제
 * - 계산 정답률은 계산·비교 문제만 (손님이 지정한 양을 그대로 넣는 과제는 제외)
 */
import { getIngredient } from "../data/ingredients.ts";
import { LEARNING_TYPE_IDS, LEARNING_TYPES, type LearningTypeId } from "../data/learningTypes.ts";
import { CHOICE_LABEL } from "./explain.ts";
import { QUALITY_LABEL } from "./outcome.ts";
import type { GameState, OrderKind, ShiftChoice, TaskMode } from "./types.ts";

export const KIND_LABEL: Record<OrderKind, string> = {
  multiBottle: "여러 병",
  customMultiplier: "맞춤 배수",
  lifeItem: "생활 소재 특별",
  pointShift: "곱의 변화 비교",
};

export const MODE_LABEL: Record<TaskMode, string> = { calc: "계산", specified: "지정량 계량", concept: "비교" };

export interface ProblemRow {
  problemId: string;
  status: "완료" | "미완료";
  dayNumber: number;
  customerNumber: number;
  orderKind: OrderKind;
  mode: TaskMode;
  ingredient: string;
  learningType: LearningTypeId | null;
  typeLabel: string;
  condition: string;
  expression: string;
  target: string;
  submitted: string | null;
  correct: boolean | null;
  hintUsed: boolean;
  hintLevel: number;
  explanationViewed: boolean;
  isReview: boolean;
  reviewOf: string | null;
}

function fmt(mode: TaskMode, v: string, unit: string): string {
  if (mode === "concept") return CHOICE_LABEL[v as ShiftChoice] ?? v;
  return `${v}${unit}`;
}

export function problemRows(state: GameState): ProblemRow[] {
  const rows: ProblemRow[] = state.problemLog.map((r) => {
    const unit = getIngredient(r.ingredientId).unit;
    return {
      problemId: r.problemId,
      status: "완료",
      dayNumber: r.dayNumber,
      customerNumber: r.customerNumber,
      orderKind: r.orderKind,
      mode: r.mode,
      ingredient: getIngredient(r.ingredientId).name,
      learningType: r.learningType,
      typeLabel: r.learningType ? `${LEARNING_TYPES[r.learningType].number} ${LEARNING_TYPES[r.learningType].label}` : "지정량 (계산 없음)",
      condition: r.condition,
      expression: r.mode === "specified" ? "-" : `${r.a} × ${r.b}`,
      target: fmt(r.mode, r.target, unit),
      submitted: fmt(r.mode, r.submitted, unit),
      correct: r.correct,
      hintUsed: r.hintLevel > 0,
      hintLevel: r.hintLevel,
      explanationViewed: r.explanationViewed,
      isReview: r.isReview,
      reviewOf: r.reviewOf,
    };
  });
  const day = state.day;
  if (day && day.status === "open" && day.rules === 3) {
    day.orders.forEach((o, i) => {
      if (o.status !== "arrived" && o.status !== "brewing") return;
      for (const t of o.tasks) {
        if (t.submitted !== null) continue;
        const ing = getIngredient(t.ingredientId);
        rows.push({
          problemId: t.problemId,
          status: "미완료",
          dayNumber: day.dayNumber,
          customerNumber: i + 1,
          orderKind: o.kind,
          mode: t.mode,
          ingredient: ing.name,
          learningType: t.problem.learningType,
          typeLabel: t.problem.learningType ? `${LEARNING_TYPES[t.problem.learningType].number} ${LEARNING_TYPES[t.problem.learningType].label}` : "지정량 (계산 없음)",
          condition: o.script.memo[0],
          expression: "-",
          target: "-",
          submitted: null,
          correct: null,
          hintUsed: t.hintLevel > 0,
          hintLevel: t.hintLevel,
          explanationViewed: false,
          isReview: t.reviewOf !== null,
          reviewOf: t.reviewOf,
        });
      }
    });
  }
  return rows;
}

export interface TypeStat {
  type: LearningTypeId;
  label: string;
  problems: number;
  correct: number;
  hintUsed: number;
  explanationViewed: number;
  review: number;
  reviewCorrect: number;
}

/** 유형별 문제 수와 정답 수 (Phase 3 완료 문제 기준) */
export function typeStats(state: GameState): TypeStat[] {
  return LEARNING_TYPE_IDS.map((type) => {
    const rs = state.problemLog.filter((r) => r.learningType === type && r.mode !== "specified");
    return {
      type,
      label: `${LEARNING_TYPES[type].number} ${LEARNING_TYPES[type].label}`,
      problems: rs.length,
      correct: rs.filter((r) => r.correct).length,
      hintUsed: rs.filter((r) => r.hintLevel > 0).length,
      explanationViewed: rs.filter((r) => r.explanationViewed).length,
      review: rs.filter((r) => r.isReview).length,
      reviewCorrect: rs.filter((r) => r.isReview && r.correct).length,
    };
  });
}

export function orderRows(state: GameState) {
  return state.orderLog.map((o) => ({
    ...o,
    kindLabel: KIND_LABEL[o.kind],
    qualityLabel: o.quality ? QUALITY_LABEL[o.quality] : "이전 규칙(정액)",
  }));
}
