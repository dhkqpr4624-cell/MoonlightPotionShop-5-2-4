import type { Unit } from "../data/ingredients.ts";
import type { LearningTypeId, OrderKind } from "../data/learningTypes.ts";
import type { DeckState } from "../lib/deck.ts";

/** 곱셈 문제. 모든 수는 정확한 십진 문자열 */
export interface Problem {
  /** 곱해지는 수 (레시피 1병당 양 또는 기본량) */
  a: string;
  /** 곱하는 수 (병 수 또는 배수) */
  b: string;
  /** 정답 (표준형) */
  answer: string;
  learningType: LearningTypeId;
  unit: Unit;
  /** b의 의미: 병 수 / 기본량의 배수 */
  bMeaning: "bottles" | "multiplier";
}

export type TaskStatus = "pending" | "done";

/** 학습 재료 하나 = 문제 하나 */
export interface IngredientTask {
  ingredientId: string;
  problem: Problem;
  status: TaskStatus;
  /** 형식이 올바른 제출 횟수 (정답 제출 포함) */
  attempts: number;
  firstAnswer: string | null;
  firstCorrect: boolean | null;
  /** 지금까지 연 힌트 단계 (0~3) */
  hintLevel: number;
  lastWrongAnswer: string | null;
}

/** 학생이 계량하지 않고 자동으로 들어가는 것 (기본 용액 등) */
export interface AutoAddition {
  name: string;
  amount: string;
  unit: Unit;
  note: string;
}

export type OrderStatus = "arrived" | "brewing" | "bottled" | "paid";

export interface Order {
  id: string;
  kind: OrderKind;
  customerId: string;
  recipeId: string;
  bottles: number;
  tasks: IngredientTask[];
  autoAdditions: AutoAddition[];
  status: OrderStatus;
  price: number;
  deckKey: string;
  lines: { greet: string; order: string; waiting: string; thanks: string };
}

export type FeedbackKind = "notice" | "format" | "wrong" | "correct" | "hint" | "info";

export interface Feedback {
  kind: FeedbackKind;
  title: string;
  lines: string[];
  /** 힌트 3단계 시각 자료 */
  visual?: HintVisual;
}

export interface HintVisual {
  kind: "unitBlocks";
  /** 한 묶음(1병)의 단위 블록 수 */
  perGroup: number;
  groups: number;
  unitLabel: string;
}

/** 해결한 문제의 학습 기록 */
export interface AttemptRecord {
  orderId: string;
  ingredientId: string;
  learningType: LearningTypeId;
  a: string;
  b: string;
  answer: string;
  firstAnswer: string | null;
  firstCorrect: boolean | null;
  attempts: number;
  hintLevel: number;
  solved: boolean;
  solvedAt: string;
}

export interface PourEvent {
  seq: number;
  ingredientId: string;
  amount: string;
  unit: Unit;
}

export type Scene = "title" | "counter" | "workbench";

export interface GameState {
  saveVersion: 1;
  scene: Scene;
  money: number;
  nextOrderNumber: number;
  order: Order | null;
  deck: DeckState;
  selectedTask: number;
  draftAnswer: string;
  feedback: Feedback | null;
  pour: PourEvent | null;
  records: AttemptRecord[];
  stats: { ordersCompleted: number; potionsSold: number; problemsSolved: number };
  /** 이미 판매금을 받은 주문 id (중복 지급 이중 방지) */
  paidOrderIds: string[];
}
