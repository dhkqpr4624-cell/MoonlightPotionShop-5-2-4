/**
 * 게임 상태 전이 (Phase 3). 모든 규칙은 여기서 강제하고, 화면 연출로 진행 여부를 판단하지 않는다.
 *
 * 제조 단계(주문 상태 brewing 안에서)
 *   재료를 솥에 놓기(PLACE_INGREDIENT) → 계량 문제 → 답 확정(SUBMIT_*) → 결과 확인 → 투입(ADD_TO_CAULDRON)
 *   → 레시피의 모든 재료 투입(재료 수는 레시피가 정함, 기력 포션은 1개) → 젓기(STIR, 누적) → 병에 담기(COMPLETE_POTION: 품질·보상 확정) → 전달(DELIVER: 1회 지급)
 *
 * 한 번만 일어나야 하는 행동은 대상 주문 ID나 일차를 함께 보내고, 현재 상태와 맞지 않으면 무시한다.
 */
import type { DecorSlot, GadgetId, ThemeId } from "../data/shop.ts";
import { defaultShop, tryBuy, tryEquip, trySetGadget } from "./shop.ts";
import { availableRecipes, newlyAvailableRecipes, normalizeUnlocked, tryUnlock } from "./unlocks.ts";
import { getIngredient } from "../data/ingredients.ts";
import { MAX_INTRO_STAGE, INTRO_STAGES } from "../data/learningTypes.ts";
import { applyKey, validateAnswerInput, type InputKey } from "../lib/answerInput.ts";
import { equals, parseDecimal, toDecimalString } from "../lib/decimal.ts";
import { createRng } from "../lib/rng.ts";
import { correctFeedback, wrongFeedback } from "./feedback.ts";
import { planDay } from "./orderFactory.ts";
import { qualityOf, reactionLine, settleOrder } from "./outcome.ts";
import { isLearningTask, summarizeDay } from "./daySummary.ts";
import {
  CUSTOMERS_PER_DAY,
  GAME_OVER_MONEY,
  STIR_TARGET,
  type AttemptRecord,
  type CheckpointState,
  type DayCheckpoint,
  type DayState,
  type GameState,
  type IngredientTask,
  type Order,
  type ProblemRecord,
  type ReviewCandidate,
  type ShiftChoice,
} from "./types.ts";

/** 힌트 기록의 최댓값. 이전 버전(계량 패널 단계별 힌트)의 1~3 기록을 저장 검증에서 받아 주기 위해 남긴다 */
export const MAX_HINT_LEVEL = 3;
/** 젓기 한 번 전송(STIR 액션)의 최대 양. Phase 4부터 젓기 버튼은 없고 막대 드래그·키보드로만 젓는다 */
export const STIR_MAX_STEP = 25;

export type Action =
  /** tutorial: 새 게임 첫 주문 튜토리얼로 시작 (첫 영업에만 의미가 있다) */
  | { type: "START"; seed: number; tutorial?: boolean }
  /** 튜토리얼: 주문서·레시피북을 열었다가 닫음 */
  | { type: "TUTORIAL_MARK"; what: "order" | "recipe" }
  /** 튜토리얼 건너뛰기 (주문은 그대로, 안내만 끝) */
  | { type: "TUTORIAL_SKIP" }
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
  /** 주문서 팝업의 '힌트': 이 주문의 학습 과제 식을 공개. 아직 답을 내지 않은 과제만 힌트 사용으로 기록(중복 없음) */
  | { type: "REVEAL_HINT"; orderId: string }
  | { type: "VIEW_EXPLANATION" }
  | { type: "ADD_TO_CAULDRON"; orderId: string; taskIndex: number }
  | { type: "STIR"; orderId: string; amount: number }
  | { type: "COMPLETE_POTION"; orderId: string }
  | { type: "DELIVER"; orderId: string; now: string }
  | { type: "NEXT_CUSTOMER"; fromOrderId: string }
  | { type: "CLOSE_DAY"; dayNumber: number; now: string }
  | { type: "NEXT_DAY"; fromDay: number; seed: number }
  /** 재료 해금(제작대 서랍). 가격은 내부 데이터에서 읽는다. 계량 패널이 열려 있으면 무시 */
  | { type: "UNLOCK_INGREDIENT"; ingredientId: string }
  /** '새 레시피 해금' 안내 확인 */
  | { type: "ACK_RECIPE_NOTICE"; recipeId: string }
  /** 상점: 편의품·장식 구매 (가격은 내부 데이터). 계량 패널이 열려 있으면 무시 */
  | { type: "BUY_ITEM"; itemId: string }
  /** 장식 장착 (가진 것만, 돈 들지 않음) */
  | { type: "EQUIP_DECOR"; slot: DecorSlot; theme: ThemeId }
  /** 편의품 켜기·끄기 */
  | { type: "SET_GADGET"; id: GadgetId; on: boolean }
  /** 오프닝 대사 넘기기: 보고 있던 대사 번호를 함께 보내 한 번 누름에 한 대사만 넘어간다 */
  | { type: "OPENING_NEXT"; fromLine: number }
  /** 영업 중단 뒤 복구 지점(전날 또는 그날 영업 시작)으로 되돌리기 */
  | { type: "RESTORE_CHECKPOINT"; dayNumber: number };

/** 오프닝 대사 (문구 그대로) */
export const OPENING_LINES = [
  "드디어 열었어! 나만의 포션 상점이야!",
  "포션의 달인이셨던 우리 할머니를 본받아서, 세계 최고의 포션을 만들겠어!",
  "내 포션들로 손님들을 기쁘게 해 줘야지!",
] as const;

export function createInitialState(): GameState {
  return {
    saveVersion: 9,
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
    unlockedIngredients: normalizeUnlocked([]),
    recipeNotices: [],
    shop: defaultShop(),
    featuredRecipes: [],
    tutorial: null,
    opening: null,
    checkpoints: [],
    gameOver: null,
  };
}

/** 튜토리얼 첫 주문: 여우의 기력 포션 2병 (기력초 0.6g × 2) */
export const TUTORIAL_ORDER = { key: "multiBottle:energy:2", customerId: "fox" } as const;

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

/** 마녀의 자동 솥: 보유만 하면 적용 (켜기·끄기 없음) */
export function hasAutoCauldron(state: Pick<GameState, "shop">): boolean {
  return state.shop.owned.includes("autoCauldron");
}

/**
 * 주문을 병에 담은 완성 상태로: 품질·판매금·피해 보상금을 이때 확정해 저장한다.
 * 돈은 여기서 움직이지 않고, 창구에서 전달할 때(DELIVER) 한 번만 지급·차감한다.
 */
function bottle(order: Order): Order {
  const quality = qualityOf(order);
  const { reward, penalty } = settleOrder(order, quality);
  return { ...order, status: "bottled", stirProgress: STIR_TARGET, quality, reward, penalty, script: { ...order.script, reaction: reactionLine(order, quality) } };
}

/** 복구 지점으로 저장할 상태 (복구 지점·영업 중단·오프닝은 빼서 중첩·반복이 없게) */
export function snapshotOf(state: GameState): CheckpointState {
  const { checkpoints: _c, gameOver: _g, opening: _o, ...rest } = state;
  return rest;
}

/** 오늘 영업 시작 상태를 복구 지점으로 넣고, 전날 것까지만 남긴다 */
function withDayCheckpoint(state: GameState): GameState {
  const d = (state.day as DayState).dayNumber;
  const keep = state.checkpoints.filter((c) => c.dayNumber === d - 1);
  return { ...state, checkpoints: [...keep, { dayNumber: d, state: snapshotOf(state) }] };
}

/**
 * 영업 중단 때 돌아갈 복구 지점: 전날 영업 시작 → 없으면(1일차·업데이트 전 저장) 그날 영업 시작 → 둘 다 없으면 null
 */
export function restorePoint(state: Pick<GameState, "gameOver" | "checkpoints">): DayCheckpoint | null {
  if (!state.gameOver) return null;
  const n = state.gameOver.dayNumber;
  return state.checkpoints.find((c) => c.dayNumber === n - 1) ?? state.checkpoints.find((c) => c.dayNumber === n) ?? null;
}

/**
 * 자동 솥 즉시 완성: 자동 솥을 가졌고, 현재 주문이 제조 중이며, 모든 필수 재료를 실제로 넣었으면
 * 젓기·병에 담기를 건너뛰고 병에 담긴 완성 상태로 바꾼다. 조건이 아니면 상태를 그대로 돌려준다(여러 번 불러도 한 번만 바뀜).
 * 오답으로 넣은 양은 그대로 두므로 품질·감액은 기존 규칙대로다. 아직 넣지 않은 재료가 있으면 아무것도 하지 않는다.
 */
export function autoCompleteIfReady(state: GameState): GameState {
  if (!hasAutoCauldron(state) || !state.day || state.day.status !== "open" || state.activeTask !== null) return state;
  const order = state.day.orders[state.day.currentIndex];
  if (!order || order.status !== "brewing" || !allTasksDone(order)) return state;
  return withOrder(state, bottle(order));
}

/** 새 영업일 준비 (주문 5건 생성 → 저장되므로 새로고침해도 같은 주문) */
function openDay(state: GameState, dayNumber: number, introStage: number, newTypes: DayState["newTypes"], seed: number, tutorial = false): GameState {
  const rng = createRng(seed);
  const made = planDay({
    dayNumber, introStage, newTypes, decks: state.decks, nextOrderNumber: state.nextOrderNumber, review: state.review, rng,
    unlocked: state.unlockedIngredients, featureRecipes: state.featuredRecipes, useBank: true,
    firstOrder: tutorial ? TUTORIAL_ORDER : undefined,
  });
  // 주문에 넣은 레시피와 더 이상 쓸 수 없는 레시피는 '첫 주문' 목록에서 뺀다
  const usable = new Set(availableRecipes(state.unlockedIngredients).map((r) => r.id));
  const featuredRecipes = state.featuredRecipes.filter((id) => usable.has(id) && !made.featured.includes(id));
  return {
    ...state,
    ...RESET_WORK,
    featuredRecipes,
    decks: made.decks,
    nextOrderNumber: made.nextOrderNumber,
    day: {
      dayNumber, status: "open", rules: 3, introStage, newTypes, introSeen: newTypes.length === 0,
      orders: made.orders, currentIndex: 0, moneyEarned: 0,
    },
    scene: "counter",
  };
}

/** 새 영업일을 열고 그 시작 상태를 복구 지점으로 저장 */
function openDayWithCheckpoint(...args: Parameters<typeof openDay>): GameState {
  return withDayCheckpoint(openDay(...args));
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

/** 영업 중단 중에도 받는 행동 */
const ALLOWED_WHEN_OVER: Action["type"][] = ["GO_TITLE", "START", "RESTORE_CHECKPOINT"];

export function reducer(state: GameState, action: Action): GameState {
  // 영업 중단: 복구하기 전까지 손님·영업·구매 등 게임 진행을 받지 않는다
  if (state.gameOver && !ALLOWED_WHEN_OVER.includes(action.type)) return state;
  const day = state.day;
  const order = currentOrder(state);
  const brewing = !!day && day.status === "open" && !!order && order.status === "brewing";

  switch (action.type) {
    case "START": {
      if (!day) {
        if (!action.tutorial) return openDayWithCheckpoint(state, 1, 0, INTRO_STAGES[0], action.seed, false);
        const opened = openDay(state, 1, 0, INTRO_STAGES[0], action.seed, true);
        const first = opened.day!.orders[0];
        // 새 게임: 첫 주문 튜토리얼 + 오프닝(대사 0번부터). 복구 지점에는 튜토리얼 상태까지 넣는다
        return withDayCheckpoint({
          ...opened,
          tutorial: { orderId: first.id, orderViewed: false, recipeViewed: false, status: "active" },
          opening: { line: 0, done: false },
        });
      }
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

    case "REVEAL_HINT": {
      // 식만 공개한다(정답·풀이 없음, 감액 없음). 이미 답을 낸 과제의 기록은 바꾸지 않는다
      if (!brewing || order!.id !== action.orderId) return state;
      let changed = false;
      const tasks = order!.tasks.map((t) => {
        if (!isLearningTask(t) || t.status !== "pending" || t.hintLevel > 0) return t;
        changed = true;
        return { ...t, hintLevel: 1 };
      });
      return changed ? withOrder(state, { ...order!, tasks }) : state;
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
      // 마지막 재료를 넣으면(자동 솥 보유 시) 같은 동작 안에서 바로 완성 — 화면 애니메이션에 기대지 않는다
      return autoCompleteIfReady({
        ...withOrder(state, updateTask(order!, action.taskIndex, updated)),
        activeTask: null,
        draftAnswer: "",
        feedback: null,
        pour: { seq: (state.pour?.seq ?? 0) + 1, ingredientId: task.ingredientId, amount, unit: task.problem.unit },
      });
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
      return { ...withOrder(state, bottle(order!)), ...RESET_WORK };
    }

    case "DELIVER": {
      if (!day || day.status !== "open" || !order) return state;
      if (order.id !== action.orderId || order.status !== "bottled" || order.reward === null) return state;
      if (state.paidOrderIds.includes(order.id)) return state;
      // 잘못 만든 포션은 판매금 0, 피해 보상금을 이 순간 한 번만 뺀다 (버전 8 이전에 정산된 주문은 penalty 없음 = 0)
      const penalty = order.penalty ?? 0;
      const money = state.money + order.reward - penalty;
      const paid = withOrder(state, { ...order, status: "paid" });
      const tu = state.tutorial;
      return {
        ...paid,
        tutorial: tu && tu.status === "active" && tu.orderId === order.id ? { ...tu, status: "done" } : tu,
        // 오늘 수입에는 판매금만 더한다 (보상금은 소지금에만 반영)
        day: { ...(paid.day as DayState), moneyEarned: day.moneyEarned + order.reward },
        money,
        gameOver: money <= GAME_OVER_MONEY ? { dayNumber: day.dayNumber, money, orderId: order.id } : null,
        scene: "counter",
        paidOrderIds: [...state.paidOrderIds, order.id].slice(-50),
        orderLog: state.orderLog.some((x) => x.orderId === order.id) ? state.orderLog : [...state.orderLog, {
          orderId: order.id, dayNumber: day.dayNumber, customerNumber: day.currentIndex + 1, kind: order.kind, rules: order.rules,
          recipeId: order.recipeId, bottles: order.bottles, quality: order.quality, price: order.price, reward: order.reward,
          ...(order.penalty !== undefined ? { penalty: order.penalty } : {}),
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
      return openDayWithCheckpoint(state, day.dayNumber + 1, stage, newTypes, action.seed);
    }

    case "UNLOCK_INGREDIENT": {
      // 제작대 서랍에서 산다. 계량 패널이 열려 있으면 받지 않는다(끌기·젓기 중 차단은 화면에서)
      if (state.activeTask !== null) return state;
      const r = tryUnlock(state.money, state.unlockedIngredients, action.ingredientId);
      if (!r.ok) return state; // 없는 재료·이미 해금·잔액 부족: 아무것도 바꾸지 않음 (중복 차감 없음)
      // 새로 쓸 수 있게 된 레시피: 안내(한 번)와 다음 영업 첫 주문 목록에 넣는다. 오늘 주문은 그대로
      const fresh = newlyAvailableRecipes(state.unlockedIngredients, r.unlocked);
      return {
        ...state,
        money: r.money,
        unlockedIngredients: r.unlocked,
        recipeNotices: [...state.recipeNotices, ...fresh.filter((id) => !state.recipeNotices.includes(id))],
        featuredRecipes: [...state.featuredRecipes, ...fresh.filter((id) => !state.featuredRecipes.includes(id))],
      };
    }

    case "BUY_ITEM": {
      if (state.activeTask !== null) return state;
      const r = tryBuy(state.money, state.shop, action.itemId);
      // 자동 솥을 샀을 때 이미 모든 재료를 넣고 젓는 중이었다면 그 주문도 바로 완성
      return r.ok ? autoCompleteIfReady({ ...state, money: r.money, shop: r.shop }) : state;
    }

    case "EQUIP_DECOR": {
      const shop = tryEquip(state.shop, action.slot, action.theme);
      return shop ? { ...state, shop } : state;
    }

    case "SET_GADGET": {
      const shop = trySetGadget(state.shop, action.id, action.on);
      return shop ? { ...state, shop } : state;
    }

    case "TUTORIAL_MARK": {
      const tu = state.tutorial;
      if (!tu || tu.status !== "active") return state;
      if (action.what === "order" ? tu.orderViewed : tu.recipeViewed) return state;
      return { ...state, tutorial: action.what === "order" ? { ...tu, orderViewed: true } : { ...tu, recipeViewed: true } };
    }

    case "TUTORIAL_SKIP": {
      const tu = state.tutorial;
      if (!tu || tu.status !== "active") return state;
      return { ...state, tutorial: { ...tu, status: "skipped" } };
    }

    case "OPENING_NEXT": {
      const op = state.opening;
      if (!op || op.done || op.line !== action.fromLine) return state;
      return { ...state, opening: op.line >= OPENING_LINES.length - 1 ? { line: op.line, done: true } : { line: op.line + 1, done: false } };
    }

    case "RESTORE_CHECKPOINT": {
      const cp = restorePoint(state);
      if (!cp || cp.dayNumber !== action.dayNumber) return state;
      // 복구 지점 이후의 판매·구매·보상금·기록·주문은 모두 그때 상태로 (중복 지급·집계 없음).
      // 오프닝은 다시 보여 주지 않고, 이미 끝낸 튜토리얼은 다시 시작하지 않는다.
      const cur = state.tutorial;
      const cpTu = cp.state.tutorial;
      const tutorial = cpTu && cpTu.status === "active" && cur && cur.status !== "active" ? { ...cpTu, status: cur.status } : cpTu;
      return {
        ...cp.state,
        ...RESET_WORK,
        scene: "counter",
        tutorial,
        opening: state.opening,
        checkpoints: state.checkpoints.filter((c) => c.dayNumber <= cp.dayNumber),
        gameOver: null,
      };
    }

    case "ACK_RECIPE_NOTICE": {
      if (!state.recipeNotices.includes(action.recipeId)) return state;
      return { ...state, recipeNotices: state.recipeNotices.filter((id) => id !== action.recipeId) };
    }

    default:
      return state;
  }
}

export { CUSTOMERS_PER_DAY };
