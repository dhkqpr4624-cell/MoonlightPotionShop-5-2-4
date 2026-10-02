/**
 * 게임 상태 전이 (Phase 3). 모든 규칙은 여기서 강제하고, 화면 연출로 진행 여부를 판단하지 않는다.
 *
 * 제조 단계(주문 상태 brewing 안에서)
 *   재료를 솥에 놓기(PLACE_INGREDIENT) → 계량 문제 → 답 확정(SUBMIT_*) → 결과 확인 → 투입(ADD_TO_CAULDRON)
 *   → 두 재료 투입 → 젓기(STIR, 누적) → 병에 담기(COMPLETE_POTION: 품질·보상 확정) → 전달(DELIVER: 1회 지급)
 *
 * 한 번만 일어나야 하는 행동은 대상 주문 ID나 일차를 함께 보내고, 현재 상태와 맞지 않으면 무시한다.
 */
import { getIngredient } from "../data/ingredients.ts";
import { MAX_INTRO_STAGE, INTRO_STAGES } from "../data/learningTypes.ts";
import { applyKey, validateAnswerInput, type InputKey } from "../lib/answerInput.ts";
import { equals, parseDecimal, toDecimalString } from "../lib/decimal.ts";
import { createRng } from "../lib/rng.ts";
import { correctFeedback, wrongFeedback } from "./feedback.ts";
import { planDay } from "./orderFactory.ts";
import { qualityOf, reactionLine, rewardFor } from "./outcome.ts";
import { isLearningTask, summarizeDay } from "./daySummary.ts";
import {
  CUSTOMERS_PER_DAY,
  STIR_TARGET,
  type AttemptRecord,
  type DayState,
  type GameState,
  type IngredientTask,
  type Order,
  type ProblemRecord,
  type ReviewCandidate,
  type ShiftChoice,
} from "./types.ts";

export const MAX_HINT_LEVEL = 3;
/** 젓기 한 번 전송(STIR 액션)의 최대 양. Phase 4부터 젓기 버튼은 없고 막대 드래그·키보드로만 젓는다 */
export const STIR_MAX_STEP = 25;

export type Action =
  | { type: "START"; seed: number }
  | { type: "GO_TITLE" }
  | { type: "ASK_AGAIN"; orderId: string }
  | { type: "ACK_INTRO"; dayNumber: number }
  | { type: "ACCEPT_ORDER"; orderId: string }
  | { type: "GO_COUNTER" }
  | { type: "GO_WORKBENCH" }
  | { type: "PLACE_INGREDIENT"; orderId: string; taskIndex: number }
  | { type: "CANCEL_MEASURE"; orderId: string }
  | { type: "INPUT_KEY"; key: InputKey }
  | { type: "SUBMIT_ANSWER"; now: string }
  | { type: "SUBMIT_CHOICE"; choice: ShiftChoice; now: string }
  | { type: "REQUEST_HINT" }
  | { type: "VIEW_EXPLANATION" }
  | { type: "ADD_TO_CAULDRON"; orderId: string; taskIndex: number }
  | { type: "STIR"; orderId: string; amount: number }
  | { type: "COMPLETE_POTION"; orderId: string }
  | { type: "DELIVER"; orderId: string; now: string }
  | { type: "NEXT_CUSTOMER"; fromOrderId: string }
  | { type: "CLOSE_DAY"; dayNumber: number; now: string }
  | { type: "NEXT_DAY"; fromDay: number; seed: number };

export function createInitialState(): GameState {
  return {
    saveVersion: 3,
    scene: "title",
    money: 0,
    nextOrderNumber: 1,
    day: null,
    decks: {},
    activeTask: null,
    draftAnswer: "",
    feedback: null,
    pour: null,
    problemLog: [],
    legacyRecords: [],
    review: [],
    orderLog: [],
    dayHistory: [],
    stats: { ordersCompleted: 0, potionsSold: 0, problemsSolved: 0 },
    paidOrderIds: [],
  };
}

export function currentOrder(state: GameState): Order | null {
  if (!state.day) return null;
  return state.day.orders[state.day.currentIndex] ?? null;
}

export function allTasksDone(order: Order): boolean {
  return order.tasks.length > 0 && order.tasks.every((t) => t.status === "done");
}

export function isStirred(order: Order): boolean {
  return order.stirProgress >= STIR_TARGET;
}

export function isLastCustomer(day: DayState): boolean {
  return day.currentIndex >= day.orders.length - 1;
}

export { isLearningTask };

const RESET_WORK = { activeTask: null, draftAnswer: "", feedback: null, pour: null } as const;

/** 새 영업일 준비 (주문 5건 생성 → 저장되므로 새로고침해도 같은 주문) */
function openDay(state: GameState, dayNumber: number, introStage: number, newTypes: DayState["newTypes"], seed: number): GameState {
  const rng = createRng(seed);
  const made = planDay({
    dayNumber, introStage, newTypes, decks: state.decks, nextOrderNumber: state.nextOrderNumber, review: state.review, rng,
  });
  return {
    ...state,
    ...RESET_WORK,
    decks: made.decks,
    nextOrderNumber: made.nextOrderNumber,
    day: {
      dayNumber, status: "open", rules: 3, introStage, newTypes, introSeen: newTypes.length === 0,
      orders: made.orders, currentIndex: 0, moneyEarned: 0,
    },
    scene: "counter",
  };
}

function withOrder(state: GameState, order: Order): GameState {
  const day = state.day as DayState;
  return { ...state, day: { ...day, orders: day.orders.map((o, i) => (i === day.currentIndex ? order : o)) } };
}

function updateTask(order: Order, index: number, task: IngredientTask): Order {
  return { ...order, tasks: order.tasks.map((t, i) => (i === index ? task : t)) };
}

function conditionText(order: Order, task: IngredientTask): string {
  const memo = order.script.memo;
  const ing = getIngredient(task.ingredientId);
  const line = memo.find((m) => m.startsWith(`${ing.name}(`)) ?? memo[1];
  return `${memo[0]} · ${line}`;
}

/** Phase 3 규칙: 유효한 답을 확정하고 기록·복습 후보를 갱신 */
function confirmSubmission(state: GameState, order: Order, index: number, submitted: string, correct: boolean, now: string): GameState {
  const day = state.day as DayState;
  const task = order.tasks[index];
  const updated: IngredientTask = {
    ...task,
    status: "measured",
    submitted,
    correct,
    attempts: 1,
    firstAnswer: submitted,
    firstCorrect: correct,
  };
  let next = withOrder(state, updateTask(order, index, updated));

  // 문제 기록 (문제 ID로 중복 방지)
  if (!next.problemLog.some((r) => r.problemId === task.problemId)) {
    const record: ProblemRecord = {
      problemId: task.problemId,
      dayNumber: day.dayNumber,
      customerNumber: day.currentIndex + 1,
      orderId: order.id,
      orderKind: order.kind,
      mode: task.mode,
      ingredientId: task.ingredientId,
      learningType: task.problem.learningType,
      condition: conditionText(order, task),
      a: task.problem.a,
      b: task.problem.b,
      target: task.mode === "concept" && task.concept ? task.concept.correct : task.problem.answer,
      submitted,
      correct,
      hintLevel: task.hintLevel,
      explanationViewed: false,
      isReview: task.reviewOf !== null,
      reviewOf: task.reviewOf,
      submittedAt: now,
    };
    next = { ...next, problemLog: [...next.problemLog, record] };
  }

  // 복습 후보
  if (isLearningTask(task) && task.problem.learningType) {
    if (task.reviewOf) {
      next = {
        ...next,
        review: next.review.map((c) =>
          c.id !== task.reviewOf ? c : {
            ...c,
            lastReviewDay: day.dayNumber,
            reviewProblemIds: c.reviewProblemIds.includes(task.problemId) ? c.reviewProblemIds : [...c.reviewProblemIds, task.problemId],
            status: correct ? "resolved" : c.status,
            resolvedProblemId: correct ? task.problemId : c.resolvedProblemId,
          },
        ),
      };
    } else if (!correct && !next.review.some((c) => c.sourceProblemId === task.problemId)) {
      const cand: ReviewCandidate = {
        id: `rev-${task.problemId}`,
        sourceProblemId: task.problemId,
        learningType: task.problem.learningType,
        a: task.problem.a,
        b: task.problem.b,
        createdDay: day.dayNumber,
        status: "open",
        lastReviewDay: null,
        reviewProblemIds: [],
        resolvedProblemId: null,
      };
      next = { ...next, review: [...next.review, cand] };
    }
  }
  return { ...next, draftAnswer: "", feedback: null, stats: { ...next.stats, problemsSolved: next.stats.problemsSolved + 1 } };
}

export function reducer(state: GameState, action: Action): GameState {
  const day = state.day;
  const order = currentOrder(state);
  const brewing = !!day && day.status === "open" && !!order && order.status === "brewing";

  switch (action.type) {
    case "START": {
      if (!day) return openDay(state, 1, 0, INTRO_STAGES[0], action.seed);
      if (day.status === "closed") return { ...state, scene: "closing" };
      if (!order) return state;
      return { ...state, scene: order.status === "brewing" ? "workbench" : "counter" };
    }

    case "GO_TITLE":
      return { ...state, scene: "title" };

    case "ASK_AGAIN": {
      // '네?'는 쉬운 설명만 보여 준다. 주문 숫자·조건·보상은 바뀌지 않는다
      if (!day || day.status !== "open" || !order || order.id !== action.orderId || order.status !== "arrived") return state;
      return withOrder(state, { ...order, askCount: order.askCount + 1 });
    }

    case "ACK_INTRO": {
      if (!day || day.dayNumber !== action.dayNumber || day.introSeen) return state;
      return { ...state, day: { ...day, introSeen: true } };
    }

    case "ACCEPT_ORDER": {
      if (!day || day.status !== "open" || !order || order.id !== action.orderId || order.status !== "arrived") return state;
      if (!day.introSeen) return state;
      return { ...withOrder(state, { ...order, status: "brewing" }), scene: "workbench", ...RESET_WORK };
    }

    case "GO_COUNTER":
      if (!day || day.status !== "open" || !order || order.status === "arrived") return state;
      return { ...state, scene: "counter" };

    case "GO_WORKBENCH":
      if (!day || day.status !== "open" || !order || (order.status !== "brewing" && order.status !== "bottled")) return state;
      return { ...state, scene: "workbench" };

    case "PLACE_INGREDIENT": {
      // 솥에 놓기 = 계량 문제 열기 (아직 투입 아님)
      if (!brewing || order!.id !== action.orderId) return state;
      if (state.activeTask !== null) return state; // 다른 계량 패널이 열려 있음
      const t = order!.tasks[action.taskIndex];
      if (!t || t.status !== "pending") return state; // 완료·확정한 재료는 다시 못 놓음
      return { ...state, activeTask: action.taskIndex, draftAnswer: "", feedback: null };
    }

    case "CANCEL_MEASURE": {
      // 답을 확정하기 전에만 재료를 선반으로 되돌릴 수 있다
      if (!brewing || order!.id !== action.orderId || state.activeTask === null) return state;
      const t = order!.tasks[state.activeTask];
      if (!t || t.status !== "pending") return state;
      return { ...state, activeTask: null, draftAnswer: "", feedback: null };
    }

    case "INPUT_KEY": {
      if (!brewing || state.activeTask === null) return state;
      const task = order!.tasks[state.activeTask];
      if (!task || task.status !== "pending" || task.mode === "concept") return state;
      const result = applyKey(state.draftAnswer, action.key);
      return {
        ...state,
        draftAnswer: result.text,
        feedback: result.notice
          ? { kind: "notice", title: result.notice, lines: [] }
          : state.feedback?.kind === "notice" || state.feedback?.kind === "format" ? null : state.feedback,
      };
    }

    case "SUBMIT_ANSWER": {
      if (!brewing || state.activeTask === null) return state;
      const o = order!;
      const index = state.activeTask;
      const task = o.tasks[index];
      if (!task || task.status !== "pending" || task.mode === "concept") return state;
      const checked = validateAnswerInput(state.draftAnswer);
      if (!checked.ok) {
        // 형식 오류는 답으로 확정하지 않고 학습 오답으로도 세지 않는다
        return { ...state, feedback: { kind: "format", title: checked.message, lines: [] } };
      }
      const correct = equals(checked.value, parseDecimal(task.problem.answer));

      if (o.rules === 2) {
        // Phase 2 규칙(마이그레이션된 하루): 오답이면 다시 입력, 정답이어야 확정
        const ing = getIngredient(task.ingredientId);
        const isFirst = task.attempts === 0;
        const updated: IngredientTask = {
          ...task,
          attempts: task.attempts + 1,
          firstAnswer: isFirst ? checked.text : task.firstAnswer,
          firstCorrect: isFirst ? correct : task.firstCorrect,
          lastWrongAnswer: correct ? task.lastWrongAnswer : checked.text,
          status: correct ? "measured" : "pending",
          submitted: correct ? checked.text : null,
          correct: correct ? true : null,
        };
        if (!correct) {
          return { ...withOrder(state, updateTask(o, index, updated)), feedback: wrongFeedback(task.problem, checked.text, ing.name) };
        }
        const rec: AttemptRecord = {
          problemId: task.problemId, dayNumber: day!.dayNumber, customerNumber: day!.currentIndex + 1, orderId: o.id,
          ingredientId: task.ingredientId, learningType: task.problem.learningType ?? "d1xN", a: task.problem.a, b: task.problem.b,
          answer: task.problem.answer, firstAnswer: updated.firstAnswer, firstCorrect: updated.firstCorrect, attempts: updated.attempts,
          hintLevel: updated.hintLevel, solved: true, solvedAt: action.now,
        };
        return {
          ...withOrder(state, updateTask(o, index, updated)),
          draftAnswer: "",
          feedback: correctFeedback(task.problem, ing.name, checked.text),
          legacyRecords: state.legacyRecords.some((r) => r.problemId === rec.problemId) ? state.legacyRecords : [...state.legacyRecords, rec],
          stats: { ...state.stats, problemsSolved: state.stats.problemsSolved + 1 },
        };
      }
      return confirmSubmission(state, o, index, checked.text, correct, action.now);
    }

    case "SUBMIT_CHOICE": {
      if (!brewing || state.activeTask === null) return state;
      const o = order!;
      const task = o.tasks[state.activeTask];
      if (!task || task.status !== "pending" || task.mode !== "concept" || !task.concept) return state;
      if (!["x10", "same", "d10"].includes(action.choice)) return state;
      return confirmSubmission(state, o, state.activeTask, action.choice, action.choice === task.concept.correct, action.now);
    }

    case "REQUEST_HINT": {
      // 힌트는 답을 확정하기 전에만 (감점 없음)
      if (!brewing || state.activeTask === null) return state;
      const task = order!.tasks[state.activeTask];
      if (!task || task.status !== "pending") return state;
      const level = Math.min(MAX_HINT_LEVEL, task.hintLevel + 1);
      return withOrder(state, updateTask(order!, state.activeTask, { ...task, hintLevel: level }));
    }

    case "VIEW_EXPLANATION": {
      if (!brewing || state.activeTask === null) return state;
      const task = order!.tasks[state.activeTask];
      if (!task || task.status !== "measured" || task.explanationViewed) return state;
      const next = withOrder(state, updateTask(order!, state.activeTask, { ...task, explanationViewed: true }));
      return {
        ...next,
        problemLog: next.problemLog.map((r) => (r.problemId === task.problemId ? { ...r, explanationViewed: true } : r)),
      };
    }

    case "ADD_TO_CAULDRON": {
      // 확정한 양(오답이면 학생이 입력한 양 그대로)을 솥에 넣는다
      if (!brewing || order!.id !== action.orderId || state.activeTask !== action.taskIndex) return state;
      const task = order!.tasks[action.taskIndex];
      if (!task || task.status !== "measured" || task.submitted === null) return state;
      const amount = task.mode === "concept" ? task.problem.answer : toDecimalString(parseDecimal(task.submitted));
      const updated: IngredientTask = { ...task, status: "done", addedAmount: amount };
      return {
        ...withOrder(state, updateTask(order!, action.taskIndex, updated)),
        activeTask: null,
        draftAnswer: "",
        feedback: null,
        pour: { seq: (state.pour?.seq ?? 0) + 1, ingredientId: task.ingredientId, amount, unit: task.problem.unit },
      };
    }

    case "STIR": {
      // 모든 재료가 들어간 뒤에만. 이동량을 누적하고, 다 저으면 더 늘지 않는다
      if (!brewing || order!.id !== action.orderId || !allTasksDone(order!) || isStirred(order!)) return state;
      const amount = Math.max(0, Math.min(STIR_MAX_STEP, Math.floor(action.amount)));
      if (amount === 0) return state;
      return withOrder(state, { ...order!, stirProgress: Math.min(STIR_TARGET, order!.stirProgress + amount) });
    }

    case "COMPLETE_POTION": {
      // 병에 담기: 모든 재료 투입 + 젓기 완료 후. 이때 품질과 판매금을 확정해 저장한다
      if (!brewing || order!.id !== action.orderId) return state;
      if (!allTasksDone(order!)) {
        return { ...state, feedback: { kind: "notice", title: "아직 솥에 넣지 않은 재료가 있어요.", lines: [] } };
      }
      if (!isStirred(order!)) {
        return { ...state, feedback: { kind: "notice", title: "솥을 끝까지 저어야 병에 담을 수 있어요.", lines: [] } };
      }
      const quality = qualityOf(order!);
      const reward = rewardFor(order!.price, quality);
      return {
        ...withOrder(state, {
          ...order!,
          status: "bottled",
          quality,
          reward,
          script: { ...order!.script, reaction: reactionLine(order!, quality) },
        }),
        ...RESET_WORK,
      };
    }

    case "DELIVER": {
      if (!day || day.status !== "open" || !order) return state;
      if (order.id !== action.orderId || order.status !== "bottled" || order.reward === null) return state;
      if (state.paidOrderIds.includes(order.id)) return state;
      const paid = withOrder(state, { ...order, status: "paid" });
      return {
        ...paid,
        day: { ...(paid.day as DayState), moneyEarned: day.moneyEarned + order.reward },
        money: state.money + order.reward,
        scene: "counter",
        paidOrderIds: [...state.paidOrderIds, order.id].slice(-50),
        orderLog: state.orderLog.some((x) => x.orderId === order.id) ? state.orderLog : [...state.orderLog, {
          orderId: order.id, dayNumber: day.dayNumber, customerNumber: day.currentIndex + 1, kind: order.kind, rules: order.rules,
          recipeId: order.recipeId, bottles: order.bottles, quality: order.quality, price: order.price, reward: order.reward,
          deliveredAt: action.now,
        }],
        stats: {
          ...state.stats,
          ordersCompleted: state.stats.ordersCompleted + 1,
          potionsSold: state.stats.potionsSold + (order.kind === "multiBottle" ? order.bottles : 0),
        },
      };
    }

    case "NEXT_CUSTOMER": {
      if (!day || day.status !== "open" || !order) return state;
      if (order.id !== action.fromOrderId || order.status !== "paid" || isLastCustomer(day)) return state;
      const nextIndex = day.currentIndex + 1;
      const orders = day.orders.map((o, i) => (i === nextIndex ? { ...o, status: "arrived" as const } : o));
      return { ...state, ...RESET_WORK, day: { ...day, orders, currentIndex: nextIndex }, scene: "counter" };
    }

    case "CLOSE_DAY": {
      if (!day || day.status !== "open" || day.dayNumber !== action.dayNumber) return state;
      if (!isLastCustomer(day) || !order || order.status !== "paid") return state;
      const summary = summarizeDay(day, state.money, action.now);
      const history = state.dayHistory.some((h) => h.dayNumber === day.dayNumber) ? state.dayHistory : [...state.dayHistory, summary];
      return { ...state, ...RESET_WORK, day: { ...day, status: "closed" }, dayHistory: history, scene: "closing" };
    }

    case "NEXT_DAY": {
      // 일차는 마감 상태에서만 1 증가. 소개 단계는 영업 완료마다 1단계씩 (일차와 별개)
      if (!day || day.status !== "closed" || day.dayNumber !== action.fromDay) return state;
      const stage = Math.min(MAX_INTRO_STAGE, day.introStage + 1);
      const newTypes = stage > day.introStage ? INTRO_STAGES[stage] : [];
      return openDay(state, day.dayNumber + 1, stage, newTypes, action.seed);
    }

    default:
      return state;
  }
}

export { CUSTOMERS_PER_DAY };
