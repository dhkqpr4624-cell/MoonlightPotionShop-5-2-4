/**
 * 영업 집계. 별도 카운터 없이 저장된 주문의 재료 과제에서 매번 계산한다.
 *
 * Phase 3 날 (rules 3)
 *  - 학습 문제 = 계산·비교 과제 (지정량 계량은 제외, 따로 표시)
 *  - 유효한 답 1회로 정답/오답 확정, 힌트 사용·해설 확인은 문제별 1회
 *  - 주문 품질(만족/조금 아쉬움/불만족) 개수
 *  - 여러 병 주문의 병 수와 맞춤·특별 주문 제조 건수를 구분
 * Phase 2 날 (rules 2, 마이그레이션된 하루)
 *  - 기존 기준: 첫 시도 정답 / 오답 후 수정 성공 / 힌트 사용
 */
import type { DayState, DaySummary, IngredientTask, Order } from "./types.ts";

/** 학습 문제(계산·비교)인지 — 지정량 계량은 아님 */
export function isLearningTask(t: IngredientTask): boolean {
  return t.mode === "calc" || t.mode === "concept";
}

export interface ProblemCounts {
  totalProblems: number;
  solved: number;
  correct: number;
  wrong: number;
  /** Phase 2 규칙 */
  firstTryCorrect: number;
  correctedAfterWrong: number;
  hintUsed: number;
  explanationViewed: number;
  reviewProblems: number;
  reviewCorrect: number;
  specifiedTasks: number;
  specifiedCorrect: number;
}

export function countTasks(tasks: readonly IngredientTask[], rules: 2 | 3): ProblemCounts {
  const c: ProblemCounts = {
    totalProblems: 0, solved: 0, correct: 0, wrong: 0, firstTryCorrect: 0, correctedAfterWrong: 0, hintUsed: 0,
    explanationViewed: 0, reviewProblems: 0, reviewCorrect: 0, specifiedTasks: 0, specifiedCorrect: 0,
  };
  for (const t of tasks) {
    if (!isLearningTask(t)) {
      c.specifiedTasks++;
      if (t.correct === true) c.specifiedCorrect++;
      continue;
    }
    c.totalProblems++;
    if (t.hintLevel > 0) c.hintUsed++;
    if (rules === 2) {
      if (t.status !== "pending") {
        c.solved++;
        if (t.firstCorrect === true) c.firstTryCorrect++;
        else if (t.firstCorrect === false) c.correctedAfterWrong++;
      }
      continue;
    }
    if (t.submitted !== null) {
      c.solved++;
      if (t.correct) c.correct++;
      else c.wrong++;
      if (t.explanationViewed) c.explanationViewed++;
    }
    if (t.reviewOf) {
      c.reviewProblems++;
      if (t.correct) c.reviewCorrect++;
    }
  }
  if (rules === 3) c.firstTryCorrect = c.correct;
  return c;
}

/** 오늘 창구에 온(queued가 아닌) 손님들의 집계 */
export function dayProblemCounts(day: DayState): ProblemCounts {
  return countTasks(day.orders.filter((o) => o.status !== "queued").flatMap((o) => o.tasks), day.rules);
}

export function summarizeDay(day: DayState, moneyAfter: number, closedAt: string): DaySummary {
  const paid: Order[] = day.orders.filter((o) => o.status === "paid");
  const c = countTasks(paid.flatMap((o) => o.tasks), day.rules);
  const base: DaySummary = {
    dayNumber: day.dayNumber,
    customersServed: paid.length,
    bottlesSold: paid.filter((o) => o.kind === "multiBottle").reduce((sum, o) => sum + o.bottles, 0),
    moneyEarned: day.moneyEarned,
    moneyAfter,
    totalProblems: c.totalProblems,
    firstTryCorrect: c.firstTryCorrect,
    correctedAfterWrong: day.rules === 2 ? c.correctedAfterWrong : 0,
    hintUsed: c.hintUsed,
    closedAt,
    ruleVersion: day.rules,
  };
  if (day.rules === 2) return base;
  return {
    ...base,
    specialOrders: paid.filter((o) => o.kind !== "multiBottle").length,
    wrong: c.wrong,
    explanationViewed: c.explanationViewed,
    reviewProblems: c.reviewProblems,
    reviewCorrect: c.reviewCorrect,
    specifiedTasks: c.specifiedTasks,
    specifiedCorrect: c.specifiedCorrect,
    quality: {
      great: paid.filter((o) => o.quality === "great").length,
      okay: paid.filter((o) => o.quality === "okay").length,
      poor: paid.filter((o) => o.quality === "poor").length,
    },
  };
}

/** 마감 화면 격려 문장. 꾸중·속도 비교 없이, 실제로 한 일을 짚어 준다 */
export function encouragement(s: DaySummary): string[] {
  const lines: string[] = [];
  if (s.ruleVersion === 3) {
    lines.push(`오늘 손님 ${s.customersServed}명에게 포션을 만들어 전했어요.`);
    if (s.totalProblems > 0 && s.firstTryCorrect === s.totalProblems) lines.push("계산 문제를 모두 정확하게 풀었어요!");
    else if ((s.wrong ?? 0) > 0) lines.push(`다르게 계량한 ${s.wrong}문제는 해설로 풀이를 확인할 수 있어요. 비슷한 문제가 다음 영업에 복습으로 찾아와요.`);
    if ((s.reviewCorrect ?? 0) > 0) lines.push(`복습 문제를 ${s.reviewCorrect}개 해결했어요. 꾸준히 연습한 덕분이에요.`);
    if (s.hintUsed > 0) lines.push("힌트를 잘 활용해서 풀이 방법을 찾았어요.");
  } else {
    lines.push(`오늘 ${s.totalProblems}가지 재료를 모두 정확하게 계량해서 손님 ${s.customersServed}명에게 포션을 전했어요.`);
    if (s.correctedAfterWrong > 0) lines.push(`다시 계산해서 바르게 고친 재료가 ${s.correctedAfterWrong}개 있어요. 끝까지 고쳐 낸 것이 멋져요.`);
    if (s.hintUsed > 0) lines.push("힌트를 잘 활용해서 스스로 답을 찾았어요.");
  }
  lines.push("다음 밤에도 손님들이 포션을 기다리고 있어요. 준비되면 ‘다음 날 영업’을 눌러 주세요.");
  return lines;
}
