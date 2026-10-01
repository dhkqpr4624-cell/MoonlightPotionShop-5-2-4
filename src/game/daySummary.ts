/**
 * 영업 집계. 따로 세는 카운터를 두지 않고, 저장된 주문의 재료 과제에서 매번 계산한다.
 * → 새로고침·중복 클릭·오답 재입력이 있어도 숫자가 어긋나지 않는다.
 *
 * 집계 기준
 * - 재료 하나의 계량 = 문제 하나 (시도 횟수와 무관)
 * - 첫 시도 정답: 처음 제출한 답이 정답
 * - 수정 성공: 처음에는 틀렸고 나중에 정답
 * - 힌트 사용: 정답 전에 힌트를 1단계 이상 본 문제 (문제별 1회)
 */
import type { DayState, DaySummary, IngredientTask } from "./types.ts";

export interface ProblemCounts {
  totalProblems: number;
  solved: number;
  firstTryCorrect: number;
  correctedAfterWrong: number;
  hintUsed: number;
}

export function countTasks(tasks: readonly IngredientTask[]): ProblemCounts {
  let solved = 0, firstTry = 0, corrected = 0, hint = 0;
  for (const t of tasks) {
    if (t.status === "done") {
      solved++;
      if (t.firstCorrect === true) firstTry++;
      else if (t.firstCorrect === false) corrected++;
    }
    if (t.hintLevel > 0) hint++;
  }
  return {
    totalProblems: tasks.length,
    solved,
    firstTryCorrect: firstTry,
    correctedAfterWrong: corrected,
    hintUsed: hint,
  };
}

/** 오늘 창구에 온(queued가 아닌) 손님들의 문제 집계 */
export function dayProblemCounts(day: DayState): ProblemCounts {
  const tasks = day.orders.filter((o) => o.status !== "queued").flatMap((o) => o.tasks);
  return countTasks(tasks);
}

export function summarizeDay(day: DayState, moneyAfter: number, closedAt: string): DaySummary {
  const paid = day.orders.filter((o) => o.status === "paid");
  const c = countTasks(paid.flatMap((o) => o.tasks));
  return {
    dayNumber: day.dayNumber,
    customersServed: paid.length,
    bottlesSold: paid.reduce((sum, o) => sum + o.bottles, 0),
    moneyEarned: day.moneyEarned,
    moneyAfter,
    totalProblems: c.totalProblems,
    firstTryCorrect: c.firstTryCorrect,
    correctedAfterWrong: c.correctedAfterWrong,
    hintUsed: c.hintUsed,
    closedAt,
  };
}

/** 마감 화면의 격려 문장. 꾸중·속도 비교 없이, 실제로 한 일을 짚어 준다 */
export function encouragement(s: DaySummary): string[] {
  const lines: string[] = [];
  if (s.totalProblems > 0 && s.firstTryCorrect === s.totalProblems) {
    lines.push("오늘 모든 재료를 한 번에 정확하게 계량했어요!");
  } else {
    lines.push(`오늘 ${s.totalProblems}가지 재료를 모두 정확하게 계량해서 손님 ${s.customersServed}명에게 포션을 전했어요.`);
  }
  if (s.correctedAfterWrong > 0) {
    lines.push(`다시 계산해서 바르게 고친 재료가 ${s.correctedAfterWrong}개 있어요. 끝까지 고쳐 낸 것이 멋져요.`);
  }
  if (s.hintUsed > 0) {
    lines.push("힌트를 잘 활용해서 스스로 답을 찾았어요.");
  }
  lines.push("다음 밤에도 손님들이 포션을 기다리고 있어요. 준비되면 ‘다음 날 영업’을 눌러 주세요.");
  return lines;
}
