/**
 * 게임 상태 전이. 모든 규칙은 여기서 강제한다. 화면의 버튼 비활성화는 보조 수단일 뿐이다.
 * - 정답이어야 재료 투입, 모든 재료가 들어가야 완성, 완성해야 전달
 * - 판매금은 주문마다 한 번 (주문 ID 확인 + paidOrderIds)
 * - 하루 = 손님 5명. 다섯 번째 판매 후에는 다음 손님 대신 영업 마감
 * - 한 번만 일어나야 하는 행동(전달·다음 손님·마감·다음 날)은 대상 주문 ID나 일차를 함께 보내고,
 *   현재 상태와 맞지 않으면 무시한다 → 더블클릭·늦게 도착한 클릭이 두 번 처리되지 않는다.
 */
import { getIngredient } from "../data/ingredients.ts";
import { equals, parseDecimal } from "../lib/decimal.ts";
import { applyKey, validateAnswerInput, type InputKey } from "../lib/answerInput.ts";
import { EMPTY_DECK } from "../lib/deck.ts";
import { createRng } from "../lib/rng.ts";
import { correctFeedback, wrongFeedback } from "./feedback.ts";
import { createDayOrders } from "./orderFactory.ts";
import { summarizeDay } from "./daySummary.ts";
import {
  CUSTOMERS_PER_DAY,
  type AttemptRecord,
  type DayState,
  type GameState,
  type IngredientTask,
  type Order,
} from "./types.ts";

export const MAX_HINT_LEVEL = 3;

export type Action =
  | { type: "START"; seed: number }
  | { type: "ACCEPT_ORDER" }
  | { type: "GO_COUNTER" }
  | { type: "GO_WORKBENCH" }
  | { type: "SELECT_TASK"; index: number }
  | { type: "INPUT_KEY"; key: InputKey }
  | { type: "SUBMIT_ANSWER"; now: string }
  | { type: "REQUEST_HINT" }
  | { type: "COMPLETE_POTION" }
  | { type: "DELIVER"; orderId: string }
  | { type: "NEXT_CUSTOMER"; fromOrderId: string }
  | { type: "CLOSE_DAY"; dayNumber: number; now: string }
  | { type: "NEXT_DAY"; fromDay: number; seed: number }
  | { type: "GO_TITLE" };

export function createInitialState(): GameState {
  return {
    saveVersion: 2,
    scene: "title",
    money: 0,
    nextOrderNumber: 1,
    day: null,
    deck: EMPTY_DECK,
    selectedTask: 0,
    draftAnswer: "",
    feedback: null,
    pour: null,
    records: [],
    dayHistory: [],
    stats: { ordersCompleted: 0, potionsSold: 0, problemsSolved: 0 },
    paidOrderIds: [],
  };
}

/** 지금 창구에 있는 손님의 주문 (마감 후에도 마지막 주문을 돌려준다) */
export function currentOrder(state: GameState): Order | null {
  if (!state.day) return null;
  return state.day.orders[state.day.currentIndex] ?? null;
}

export function allTasksDone(order: Order): boolean {
  return order.tasks.length > 0 && order.tasks.every((t) => t.status === "done");
}

export function isLastCustomer(day: DayState): boolean {
  return day.currentIndex >= day.orders.length - 1;
}

function firstPendingIndex(order: Order, from = 0): number {
  const n = order.tasks.length;
  for (let i = 0; i < n; i++) {
    const idx = (from + i) % n;
    if (order.tasks[idx].status === "pending") return idx;
  }
  return -1;
}

const RESET_WORK = { selectedTask: 0, draftAnswer: "", feedback: null, pour: null } as const;

/** 새 영업일을 준비한다 (주문 5건 생성 → 저장되므로 새로고침해도 같은 주문) */
function openDay(state: GameState, dayNumber: number, seed: number): GameState {
  const rng = createRng(seed);
  const made = createDayOrders(state.deck, state.nextOrderNumber, CUSTOMERS_PER_DAY, rng);
  return {
    ...state,
    ...RESET_WORK,
    deck: made.deck,
    nextOrderNumber: made.nextOrderNumber,
    day: { dayNumber, status: "open", orders: made.orders, currentIndex: 0, moneyEarned: 0 },
    scene: "counter",
  };
}

/** 현재 주문을 바꾼 새 상태 */
function withOrder(state: GameState, order: Order): GameState {
  const day = state.day as DayState;
  return {
    ...state,
    day: { ...day, orders: day.orders.map((o, i) => (i === day.currentIndex ? order : o)) },
  };
}

function updateTask(order: Order, index: number, task: IngredientTask): Order {
  return { ...order, tasks: order.tasks.map((t, i) => (i === index ? task : t)) };
}

export function reducer(state: GameState, action: Action): GameState {
  const day = state.day;
  const order = currentOrder(state);

  switch (action.type) {
    case "START": {
      // 처음이면 1일차 준비, 아니면 저장된 자리로 이어하기
      if (!day) return openDay(state, 1, action.seed);
      if (day.status === "closed") return { ...state, scene: "closing" };
      if (!order) return state;
      return { ...state, scene: order.status === "brewing" ? "workbench" : "counter" };
    }

    case "GO_TITLE":
      return { ...state, scene: "title" };

    case "ACCEPT_ORDER": {
      if (!day || day.status !== "open" || !order || order.status !== "arrived") return state;
      const selectedTask = Math.max(0, firstPendingIndex(order));
      return {
        ...withOrder(state, { ...order, status: "brewing" }),
        scene: "workbench",
        selectedTask,
        draftAnswer: "",
        feedback: null,
      };
    }

    case "GO_COUNTER":
      if (!day || day.status !== "open" || !order || order.status === "arrived") return state;
      return { ...state, scene: "counter" };

    case "GO_WORKBENCH":
      if (!day || day.status !== "open" || !order || (order.status !== "brewing" && order.status !== "bottled")) return state;
      return { ...state, scene: "workbench" };

    case "SELECT_TASK": {
      if (!order || order.status !== "brewing") return state;
      if (action.index < 0 || action.index >= order.tasks.length) return state;
      if (action.index === state.selectedTask) return state;
      return { ...state, selectedTask: action.index, draftAnswer: "", feedback: null };
    }

    case "INPUT_KEY": {
      if (!order || order.status !== "brewing") return state;
      const task = order.tasks[state.selectedTask];
      if (!task || task.status !== "pending") return state;
      const result = applyKey(state.draftAnswer, action.key);
      return {
        ...state,
        draftAnswer: result.text,
        feedback: result.notice
          ? { kind: "notice", title: result.notice, lines: [] }
          : state.feedback?.kind === "notice" || state.feedback?.kind === "format"
            ? null
            : state.feedback,
      };
    }

    case "SUBMIT_ANSWER": {
      if (!day || !order || order.status !== "brewing") return state;
      const index = state.selectedTask;
      const task = order.tasks[index];
      if (!task || task.status !== "pending") return state;
      const ingredient = getIngredient(task.ingredientId);

      const checked = validateAnswerInput(state.draftAnswer);
      if (!checked.ok) {
        // 형식 문제는 오답이 아니다: 시도 횟수에 넣지 않는다
        return { ...state, feedback: { kind: "format", title: checked.message, lines: [] } };
      }

      const correct = equals(checked.value, parseDecimal(task.problem.answer));
      const isFirst = task.attempts === 0;
      const updated: IngredientTask = {
        ...task,
        attempts: task.attempts + 1,
        firstAnswer: isFirst ? checked.text : task.firstAnswer,
        firstCorrect: isFirst ? correct : task.firstCorrect,
        status: correct ? "done" : "pending",
        lastWrongAnswer: correct ? task.lastWrongAnswer : checked.text,
      };

      if (!correct) {
        // 오답: 재료를 넣지 않고, 입력을 남겨 두어 고칠 수 있게 한다. 돈·손님에는 영향 없음.
        return {
          ...withOrder(state, updateTask(order, index, updated)),
          feedback: wrongFeedback(task.problem, checked.text, ingredient.name),
        };
      }

      const nextOrder = updateTask(order, index, updated);
      const record: AttemptRecord = {
        problemId: `${order.id}:${task.ingredientId}`,
        dayNumber: day.dayNumber,
        customerNumber: day.currentIndex + 1,
        orderId: order.id,
        ingredientId: task.ingredientId,
        learningType: task.problem.learningType,
        a: task.problem.a,
        b: task.problem.b,
        answer: task.problem.answer,
        firstAnswer: updated.firstAnswer,
        firstCorrect: updated.firstCorrect,
        attempts: updated.attempts,
        hintLevel: updated.hintLevel,
        solved: true,
        solvedAt: action.now,
      };
      const next = firstPendingIndex(nextOrder, index + 1);
      return {
        ...withOrder(state, nextOrder),
        selectedTask: next === -1 ? index : next,
        draftAnswer: "",
        feedback: correctFeedback(task.problem, ingredient.name, checked.text),
        pour: {
          seq: (state.pour?.seq ?? 0) + 1,
          ingredientId: task.ingredientId,
          amount: task.problem.answer,
          unit: task.problem.unit,
        },
        records: [...state.records, record],
        stats: { ...state.stats, problemsSolved: state.stats.problemsSolved + 1 },
      };
    }

    case "REQUEST_HINT": {
      if (!order || order.status !== "brewing") return state;
      const index = state.selectedTask;
      const task = order.tasks[index];
      if (!task || task.status !== "pending") return state;
      const level = Math.min(MAX_HINT_LEVEL, task.hintLevel + 1);
      // 열린 힌트는 task.hintLevel로 남아 화면이 1~level 단계를 모두 보여 준다 (기록·집계에도 남음)
      return withOrder(state, updateTask(order, index, { ...task, hintLevel: level }));
    }

    case "COMPLETE_POTION": {
      if (!order || order.status !== "brewing") return state;
      if (!allTasksDone(order)) {
        return { ...state, feedback: { kind: "notice", title: "아직 계량하지 않은 재료가 있어요.", lines: [] } };
      }
      return { ...withOrder(state, { ...order, status: "bottled" }), feedback: null, draftAnswer: "" };
    }

    case "DELIVER": {
      // 판매금은 이 주문이 bottled → paid 로 바뀔 때 딱 한 번
      if (!day || day.status !== "open" || !order) return state;
      if (order.id !== action.orderId || order.status !== "bottled") return state;
      if (state.paidOrderIds.includes(order.id)) return state;
      const paidState = withOrder(state, { ...order, status: "paid" });
      return {
        ...paidState,
        day: { ...(paidState.day as DayState), moneyEarned: day.moneyEarned + order.price },
        money: state.money + order.price,
        scene: "counter",
        paidOrderIds: [...state.paidOrderIds, order.id].slice(-50),
        stats: {
          ...state.stats,
          ordersCompleted: state.stats.ordersCompleted + 1,
          potionsSold: state.stats.potionsSold + order.bottles,
        },
      };
    }

    case "NEXT_CUSTOMER": {
      // 판매가 끝난 '그 주문'에서만 다음 손님으로. 마지막 손님 뒤에는 마감만 가능
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
      const history = state.dayHistory.some((h) => h.dayNumber === day.dayNumber)
        ? state.dayHistory
        : [...state.dayHistory, summary];
      return { ...state, ...RESET_WORK, day: { ...day, status: "closed" }, dayHistory: history, scene: "closing" };
    }

    case "NEXT_DAY": {
      // 일차는 마감 상태에서만, 보낸 일차와 현재 일차가 같을 때 한 번만 증가
      if (!day || day.status !== "closed" || day.dayNumber !== action.fromDay) return state;
      return openDay(state, day.dayNumber + 1, action.seed);
    }

    default:
      return state;
  }
}
