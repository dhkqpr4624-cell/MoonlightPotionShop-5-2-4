/* 이 파일은 Phase 2(저장 버전 2) 코드를 그대로 보존한 것이다. 이전 저장을 검증·마이그레이션할 때만 쓴다. 수정하지 말 것. */
import type { Unit } from "../../data/ingredients.ts";
import type { LearningTypeId } from "../../data/learningTypes.ts";
type OrderKind = "multiBottle" | "customMultiplier" | "pointShift";
import type { DeckState } from "../../lib/deck.ts";

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

/** queued: 오늘 올 예정인 손님(아직 창구에 오지 않음) */
export type OrderStatus = "queued" | "arrived" | "brewing" | "bottled" | "paid";

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
  /** 문제 고유 ID: "<주문ID>:<재료ID>" (Phase 1 기록은 마이그레이션 때 부여) */
  problemId: string;
  /** 영업 일차. Phase 1(하루 개념 없음)에서 옮겨 온 기록은 0 */
  dayNumber: number;
  /** 그날 몇 번째 손님인지 (1~5). Phase 1 기록은 0 */
  customerNumber: number;
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

export type Scene = "title" | "counter" | "workbench" | "closing";

/** 하루 영업. 손님 5명 = 하루. status가 덧문의 열림(open)·닫힘(closed)을 결정한다 */
export type DayStatus = "open" | "closed";

export interface DayState {
  dayNumber: number;
  status: DayStatus;
  /** 오늘의 주문 5건 (영업 시작 때 모두 만들어 저장 → 새로고침해도 바뀌지 않음) */
  orders: Order[];
  /** 지금 응대 중인 손님 순서 (0부터) */
  currentIndex: number;
  /** 오늘 얻은 판매금 */
  moneyEarned: number;
}

/** 영업 결과(마감 때 기록). 재료 하나의 계량 = 문제 하나 */
export interface DaySummary {
  dayNumber: number;
  customersServed: number;
  bottlesSold: number;
  moneyEarned: number;
  moneyAfter: number;
  totalProblems: number;
  firstTryCorrect: number;
  correctedAfterWrong: number;
  hintUsed: number;
  closedAt: string;
}

export const CUSTOMERS_PER_DAY = 5;

export interface GameState {
  saveVersion: 2;
  scene: Scene;
  money: number;
  nextOrderNumber: number;
  /** 영업을 한 번도 시작하지 않았으면 null */
  day: DayState | null;
  deck: DeckState;
  selectedTask: number;
  draftAnswer: string;
  feedback: Feedback | null;
  pour: PourEvent | null;
  records: AttemptRecord[];
  /** 지난 영업 결과 (마감한 날마다 1개) */
  dayHistory: DaySummary[];
  stats: { ordersCompleted: number; potionsSold: number; problemsSolved: number };
  /** 이미 판매금을 받은 주문 id (중복 지급 이중 방지) */
  paidOrderIds: string[];
}
