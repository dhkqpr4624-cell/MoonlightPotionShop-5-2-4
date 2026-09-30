/**
 * 게임 상태 전이. 모든 규칙(정답 없이는 투입 불가, 재료가 다 준비되기 전 완성 불가,
 * 판매금 1회 지급)은 여기서 강제한다. 화면의 버튼 비활성화는 보조 수단일 뿐이다.
 */
import { getIngredient } from "../data/ingredients.ts";
import { equals, parseDecimal } from "../lib/decimal.ts";
import { applyKey, validateAnswerInput, type InputKey } from "../lib/answerInput.ts";
import { drawFromDeck, EMPTY_DECK } from "../lib/deck.ts";
import { createRng, randomInt } from "../lib/rng.ts";
import { correctFeedback, wrongFeedback } from "./feedback.ts";
import { createOrderFromKey, multiBottleKeys, PHASE1_SETTINGS } from "./orderFactory.ts";
import type { AttemptRecord, GameState, IngredientTask, Order } from "./types.ts";

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
  | { type: "DELIVER" }
  | { type: "NEXT_CUSTOMER"; seed: number }
  | { type: "GO_TITLE" };

export function createInitialState(): GameState {
  return {
    saveVersion: 1,
    scene: "title",
    money: 0,
    nextOrderNumber: 1,
    order: null,
    deck: EMPTY_DECK,
    selectedTask: 0,
    draftAnswer: "",
    feedback: null,
    pour: null,
    records: [],
    stats: { ordersCompleted: 0, potionsSold: 0, problemsSolved: 0 },
    paidOrderIds: [],
  };
}

export function allTasksDone(order: Order): boolean {
  return order.tasks.length > 0 && order.tasks.every((t) => t.status === "done");
}

function firstPendingIndex(order: Order, from = 0): number {
  const n = order.tasks.length;
  for (let i = 0; i < n; i++) {
    const idx = (from + i) % n;
    if (order.tasks[idx].status === "pending") return idx;
  }
  return -1;
}

function newOrder(state: GameState, seed: number): GameState {
  const rng = createRng(seed);
  const keys = multiBottleKeys(PHASE1_SETTINGS);
  const { key, deck } = drawFromDeck(state.deck, keys, rng);
  const customers = PHASE1_SETTINGS.customerIds;
  const customerId = customers[randomInt(rng, customers.length)];
  const order = createOrderFromKey(key, state.nextOrderNumber, customerId, rng);
  return {
    ...state,
    deck,
    order,
    nextOrderNumber: state.nextOrderNumber + 1,
    scene: "counter",
    selectedTask: 0,
    draftAnswer: "",
    feedback: null,
    pour: null,
  };
}

function updateTask(order: Order, index: number, task: IngredientTask): Order {
  return { ...order, tasks: order.tasks.map((t, i) => (i === index ? task : t)) };
}

export function reducer(state: GameState, action: Action): GameState {
  const order = state.order;

  switch (action.type) {
    case "START": {
      // 진행 중인 주문이 있으면 이어서, 없거나 판매가 끝났으면 새 손님
      if (order && order.status !== "paid") {
        return { ...state, scene: order.status === "brewing" ? "workbench" : "counter" };
      }
      return newOrder(state, action.seed);
    }

    case "GO_TITLE":
      return { ...state, scene: "title" };

    case "ACCEPT_ORDER": {
      if (!order || order.status !== "arrived") return state;
      const selectedTask = Math.max(0, firstPendingIndex(order));
      return {
        ...state,
        order: { ...order, status: "brewing" },
        scene: "workbench",
        selectedTask,
        feedback: null,
      };
    }

    case "GO_COUNTER":
      if (!order || order.status === "arrived") return state;
      return { ...state, scene: "counter" };

    case "GO_WORKBENCH":
      if (!order || (order.status !== "brewing" && order.status !== "bottled")) return state;
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
      if (!order || order.status !== "brewing") return state;
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
          ...state,
          order: updateTask(order, index, updated),
          feedback: wrongFeedback(task.problem, checked.text, ingredient.name),
        };
      }

      const nextOrder = updateTask(order, index, updated);
      const record: AttemptRecord = {
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
        ...state,
        order: nextOrder,
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
      // 열린 힌트는 task.hintLevel로 남아 화면이 1~level 단계를 모두 보여 준다 (기록에도 남음)
      return { ...state, order: updateTask(order, index, { ...task, hintLevel: level }) };
    }

    case "COMPLETE_POTION": {
      if (!order || order.status !== "brewing") return state;
      if (!allTasksDone(order)) {
        return {
          ...state,
          feedback: { kind: "notice", title: "아직 계량하지 않은 재료가 있어요.", lines: [] },
        };
      }
      return { ...state, order: { ...order, status: "bottled" }, feedback: null, draftAnswer: "" };
    }

    case "DELIVER": {
      // 판매금은 bottled → paid 전이에서 딱 한 번만 지급
      if (!order || order.status !== "bottled") return state;
      if (state.paidOrderIds.includes(order.id)) return state;
      return {
        ...state,
        order: { ...order, status: "paid" },
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
      if (order && order.status !== "paid") return state;
      return newOrder(state, action.seed);
    }

    default:
      return state;
  }
}
