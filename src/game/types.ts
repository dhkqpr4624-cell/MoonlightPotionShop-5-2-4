import type { Unit } from "../data/ingredients.ts";
import type { LearningTypeId } from "../data/learningTypes.ts";
import type { Quality } from "../data/customers.ts";
import type { ThemeId } from "../data/shop.ts";
import type { DeckState } from "../lib/deck.ts";

export type { Quality } from "../data/customers.ts";

/**
 * 주문 유형
 *  multiBottle:      레시피 1병당 양 × 병 수
 *  customMultiplier: 레시피 기본량 × 배수 (1병)
 *  customAmount:     손님 지정량 주문. 레시피 대신 손님이 정한 양을 쓴다
 *                    (1병당 양 × 병 수, 또는 손님이 알려 준 기준 양 × 배수)
 *  lifeItem:         생활 소재 특별 주문
 *  pointShift:       ⑦ 곱의 변화 비교
 *  bank:             문제은행 손님 지정량 특별 주문 (data/questionBank.ts의 한 문항 = 재료 하나의 계산 과제,
 *                    나머지 재료는 레시피 정상 조건으로 계량) — 저장 버전 7부터
 */
export type OrderKind = "multiBottle" | "customMultiplier" | "customAmount" | "lifeItem" | "pointShift" | "bank";

/** 문제은행 주문 정보 (문제 ID로 원문·힌트·해설과 연결) */
export interface BankOrderInfo {
  /** 문제은행 ID (예: MP-001) */
  questionId: string;
  difficulty: "하" | "중" | "상";
  /** perBottle: 지정 재료 1병당 양 × 병 수, 다른 재료도 레시피 1병당 양 × 병 수
   *  base:      지정 재료 기준량 × 배수(1병), 다른 재료는 레시피 1병 기본량 */
  form: "perBottle" | "base";
  /** 계산할 재료 (과제 목록에서 bankId가 붙은 과제) */
  ingredientId: string;
}

/**
 * 규칙 버전
 *  2: Phase 2 규칙 (오답이면 정답을 다시 입력해야 투입, 판매금 정액) — 마이그레이션된 진행 중 하루에만
 *  3: Phase 3 규칙 (유효한 답 1회로 양 확정, 그 양으로 제조, 품질별 판매금)
 */
export type RuleVersion = 2 | 3;

/**
 * 재료 과제 종류
 *  calc:      계산이 필요한 학습 문제 (정답률 집계 대상)
 *  specified: 손님이 직접 지정한 양을 그대로 계량 (계산 문제 아님, 정답률 집계 제외, 품질에는 반영)
 *  concept:   ⑦ 곱의 변화 비교 개념 문제 (선택형, 정답률 집계 대상) → 재료량은 자동 계량
 */
export type TaskMode = "calc" | "specified" | "concept";

/**
 * b의 의미
 *  bottles: 병 수 / multiplier: 기본 레시피의 ○배 / itemCount: 생활 소재 개수 / itemRatio: 생활 소재의 ○배
 *  given: 지정된 양(계산 없음) / shift: 비교 문제의 바뀐 식
 */
export type BMeaning = "bottles" | "multiplier" | "itemCount" | "itemRatio" | "given" | "shift";

/** 곱셈 문제. 모든 수는 정확한 십진 문자열 */
export interface Problem {
  a: string;
  b: string;
  /** 목표 재료량 (표준형) */
  answer: string;
  /** specified 과제는 null */
  learningType: LearningTypeId | null;
  unit: Unit;
  bMeaning: BMeaning;
  /** 문제은행 과제면 문제 ID (힌트·해설을 그 문항에서 읽는다) */
  bankId?: string;
}

export type ShiftChoice = "x10" | "same" | "d10";

/** ⑦ 비교 문제 데이터 */
export interface ConceptData {
  refA: string;
  refB: string;
  refProduct: string;
  newA: string;
  newB: string;
  correct: ShiftChoice;
}

/**
 * 손님 지정량 주문 데이터
 *  form "perBottle": 1병에 amount씩 × times병
 *  form "base":      손님이 알려 준 기준 양 amount의 times배 (1병)
 */
export interface GivenAmount {
  form: "perBottle" | "base";
  amount: string;
  times: string;
}

/** 생활 소재 특별 주문 데이터 */
export interface LifeData {
  itemId: string;
  a: string;
  b: string;
}

/**
 * 재료 과제 진행 상태
 *  pending:  아직 계량하지 않음 (선반에 있음)
 *  measured: 답을 확정함 (아직 솥에 넣지 않음) — Phase 3 규칙만
 *  done:     솥에 투입함
 */
export type TaskStatus = "pending" | "measured" | "done";

export interface IngredientTask {
  /** 문제 고유 ID: "<주문ID>:<재료ID>" */
  problemId: string;
  ingredientId: string;
  mode: TaskMode;
  problem: Problem;
  concept: ConceptData | null;
  status: TaskStatus;
  /** 확정한 답(숫자 문자열 또는 비교 선택). Phase 3 규칙에서 유효한 제출은 1번 */
  submitted: string | null;
  correct: boolean | null;
  /** 실제로 솥에 넣은 양 (오답이면 학생이 입력한 양 그대로) */
  addedAmount: string | null;
  /**
   * 힌트 사용. 0: 안 봄 / 1 이상: 봄.
   * 지금은 제작대 주문서의 '힌트'로 식을 공개하면 아직 답을 내지 않은 학습 과제가 1이 된다(중복 없음).
   * 이전 버전 계량 패널의 단계별 힌트 기록(1~3)은 그대로 보존한다.
   */
  hintLevel: number;
  /** 결과 화면에서 풀이(해설)를 확인했는지 */
  explanationViewed: boolean;
  /** 복습 문제면 복습 후보 ID */
  reviewOf: string | null;
  // ---- Phase 2 규칙(rules 2) 호환 필드 ----
  attempts: number;
  firstAnswer: string | null;
  firstCorrect: boolean | null;
  lastWrongAnswer: string | null;
}

/** 학생이 계량하지 않고 자동으로 들어가는 것 (기본 용액 등) */
export interface AutoAddition {
  name: string;
  amount: string;
  unit: Unit;
  note: string;
}

/** queued: 오늘 올 예정 / arrived: 창구 / brewing: 제조 중(투입·젓기) / bottled: 병에 담음(품질·보상 확정) / paid: 전달·지급 완료 */
export type OrderStatus = "queued" | "arrived" | "brewing" | "bottled" | "paid";

/** 손님 대사와 주문 메모 (재현할 수 있게 주문에 저장) */
export interface OrderScript {
  greet: string;
  /** 원래 주문 대사 */
  original: string;
  /** '네?'를 눌렀을 때의 쉬운 설명 (정답은 말하지 않음) */
  easy: string;
  waiting: string;
  /** 주문 메모 (조건 정리. 계산식·정답은 넣지 않음) */
  memo: string[];
  /** 병에 담을 때 정해지는 손님 반응 */
  reaction: string | null;
}

export const STIR_TARGET = 100;

export interface Order {
  id: string;
  kind: OrderKind;
  rules: RuleVersion;
  customerId: string;
  /** 손님 외형(그림) ID. 주문을 만들 때 정해 저장한다. 없으면 손님 ID별 기본 외형 (data/appearances.ts) */
  appearanceId?: string;
  recipeId: string;
  /** 여러 병 주문의 병 수. 그 밖의 주문은 1 (제조 1건) */
  bottles: number;
  /** 맞춤 배수 주문의 배수 */
  multiplier: string | null;
  /** 손님 지정량 주문(customAmount)의 조건. 그 밖의 주문에는 없다 */
  given?: GivenAmount | null;
  life: LifeData | null;
  /** 문제은행 주문(bank)의 정보. 그 밖의 주문에는 없다 */
  bank?: BankOrderInfo | null;
  tasks: IngredientTask[];
  autoAdditions: AutoAddition[];
  status: OrderStatus;
  /** 정상 판매금 */
  price: number;
  /** 병에 담을 때 확정되는 품질과 실제 지급액 */
  quality: Quality | null;
  reward: number | null;
  /**
   * 잘못 만든 포션의 피해 보상금(양수, 전달할 때 소지금에서 뺀다). 저장 버전 9부터 병에 담을 때 판매금과 함께 확정한다.
   * 없음(undefined)은 버전 8 이전 규칙으로 이미 정산된 주문(품질별 감액)이라 다시 계산하지 않는다.
   */
  penalty?: number;
  /** 젓기 진행 (0 ~ STIR_TARGET) */
  stirProgress: number;
  /** '네?'를 누른 횟수 (보상과 무관, 기록용) */
  askCount: number;
  deckKey: string;
  /** 복습 주문이면 복습 후보 ID */
  reviewCandidateId: string | null;
  script: OrderScript;
}

export type FeedbackKind = "notice" | "format" | "wrong" | "correct" | "hint" | "info";

export interface Feedback {
  kind: FeedbackKind;
  title: string;
  lines: string[];
  visual?: HintVisual;
}

export interface HintVisual {
  kind: "unitBlocks";
  perGroup: number;
  groups: number;
  unitLabel: string;
}

/** Phase 1·2 규칙의 학습 기록 (재시도 방식). 이전 기록 보존용 */
export interface AttemptRecord {
  problemId: string;
  dayNumber: number;
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

/** Phase 3 문제 기록. 유효한 답 제출 1회 = 기록 1개 (문제 ID로 중복 방지) */
export interface ProblemRecord {
  problemId: string;
  dayNumber: number;
  customerNumber: number;
  orderId: string;
  orderKind: OrderKind;
  mode: TaskMode;
  ingredientId: string;
  learningType: LearningTypeId | null;
  /** 주문 조건 (메모 요약) */
  condition: string;
  a: string;
  b: string;
  /** 목표값 (비교 문제는 정답 선택) */
  target: string;
  submitted: string;
  correct: boolean;
  hintLevel: number;
  explanationViewed: boolean;
  isReview: boolean;
  reviewOf: string | null;
  submittedAt: string;
}

/** 복습 후보: 틀린 문제와 같은 유형을 다른 숫자로 다시 확인 */
export interface ReviewCandidate {
  id: string;
  sourceProblemId: string;
  learningType: LearningTypeId;
  /** 원래 문제의 인수 (표준형) — 복습 때 다른 인수를 고르기 위해 */
  a: string;
  b: string;
  createdDay: number;
  status: "open" | "resolved";
  /** 마지막으로 복습 문제를 낸 일차 (복습 오답이면 바로 다음 날은 쉬기) */
  lastReviewDay: number | null;
  reviewProblemIds: string[];
  resolvedProblemId: string | null;
}

/** 주문 결과 기록 (손님 만족도와 실제 지급액) */
export interface OrderOutcome {
  orderId: string;
  dayNumber: number;
  customerNumber: number;
  kind: OrderKind;
  rules: RuleVersion;
  recipeId: string;
  bottles: number;
  quality: Quality | null;
  price: number;
  reward: number;
  /** 피해 보상금 (저장 버전 9부터. 없으면 0) */
  penalty?: number;
  deliveredAt: string;
}

export interface PourEvent {
  seq: number;
  ingredientId: string;
  amount: string;
  unit: Unit;
}

export type Scene = "title" | "counter" | "workbench" | "closing";

export type DayStatus = "open" | "closed";

export interface DayState {
  dayNumber: number;
  status: DayStatus;
  /** 이 날의 규칙 버전 (마이그레이션된 진행 중 하루만 2) */
  rules: RuleVersion;
  /** 이 날 출제에 쓰는 유형 소개 단계 (0~3). 일차와 별개 */
  introStage: number;
  /** 이 날 처음 소개하는 유형 */
  newTypes: LearningTypeId[];
  introSeen: boolean;
  orders: Order[];
  currentIndex: number;
  moneyEarned: number;
}

/** 영업 결과(마감 때 기록). 새 필드는 Phase 3 날에만 있다 */
export interface DaySummary {
  dayNumber: number;
  customersServed: number;
  /** 여러 병 주문으로 판매한 병 수 */
  bottlesSold: number;
  moneyEarned: number;
  moneyAfter: number;
  /** 학습 문제 수 (계산 + 비교. 지정량 계량 제외) */
  totalProblems: number;
  /** Phase 2: 첫 시도 정답 / Phase 3: 정답 */
  firstTryCorrect: number;
  /** Phase 2 전용: 오답 후 수정 성공 (Phase 3 날은 0) */
  correctedAfterWrong: number;
  hintUsed: number;
  closedAt: string;
  ruleVersion?: RuleVersion;
  /** 맞춤·생활 소재·비교 주문 제조 건수 */
  specialOrders?: number;
  wrong?: number;
  explanationViewed?: number;
  reviewProblems?: number;
  reviewCorrect?: number;
  specifiedTasks?: number;
  specifiedCorrect?: number;
  quality?: { great: number; good?: number; okay: number; poor: number };
  /** 판매한 포션 병 수 (모든 주문의 병 수 합. 맞춤·특별 주문은 1병) — 저장 버전 5부터 */
  potionsMade?: number;
  /** 잘못 만든 포션 병 수: 틀린 재료 과제가 하나라도 있는 주문의 병 수 합 — 저장 버전 5부터 */
  wrongPotions?: number;
}

export const CUSTOMERS_PER_DAY = 5;

/** 상점 (저장 버전 6부터). 상품 데이터는 data/shop.ts */
export interface ShopState {
  /** 산 상품 ID (편의품 "glasses"·"autoCauldron", 장식 "counter:royal" 등). 기본 장식은 넣지 않아도 늘 가진 것으로 본다 */
  owned: string[];
  /** 칸별로 장착한 테마 ("basic"은 기본 그림) */
  equipped: { counter: ThemeId; wall: ThemeId; bench: ThemeId };
  /** 편의품 켜기·끄기 (산 것만 켤 수 있다) */
  toggles: { glasses: boolean; autoCauldron: boolean };
}

/**
 * 첫 주문 튜토리얼 (저장 버전 7부터). 새로 시작한 게임에만 생기고, 이전 저장에는 null(강제로 시작하지 않음).
 * 현재 단계는 주문·화면 상태에서 계산하고(game/tutorial.ts), 여기에는 상태만으로 알 수 없는 것만 저장한다.
 */
export interface TutorialState {
  /** 튜토리얼 주문 ID (새 게임 첫 손님) */
  orderId: string;
  /** 주문서 팝업을 열었다가 닫음 */
  orderViewed: boolean;
  /** 레시피북 팝업을 열었다가 닫음 */
  recipeViewed: boolean;
  /** active: 진행 중 / done: 전달까지 마침 / skipped: 건너뜀 */
  status: "active" | "done" | "skipped";
}

/** 새 게임 오프닝 (저장 버전 9부터). 새로 시작한 게임에만 생기고, 이전 저장에는 null */
export interface OpeningState {
  /** 지금 보고 있는 대사 번호 (0부터) */
  line: number;
  done: boolean;
}

/** 소지금이 이 값 이하가 되면 영업 중단(게임 오버) */
export const GAME_OVER_MONEY = -50;

/** 영업 중단 (저장 버전 9부터) */
export interface GameOverState {
  dayNumber: number;
  /** 중단된 순간의 소지금 */
  money: number;
  /** 소지금을 −50 이하로 만든 주문 */
  orderId: string;
}

/** 복구 지점: 영업일을 시작한 순간의 게임 상태 (복구 지점·영업 중단·오프닝 정보는 빼고 저장) */
export type CheckpointState = Omit<GameState, "checkpoints" | "gameOver" | "opening">;
export interface DayCheckpoint {
  dayNumber: number;
  state: CheckpointState;
}

export interface GameState {
  saveVersion: 9;
  scene: Scene;
  money: number;
  nextOrderNumber: number;
  day: DayState | null;
  /** 주문 유형별 문제 덱 (최근 동일 문제 회피, 소진되면 섞어서 재사용) */
  decks: Record<string, DeckState>;
  /** 계량 패널이 열린 재료 과제 번호 (솥에 놓은 재료) */
  activeTask: number | null;
  draftAnswer: string;
  feedback: Feedback | null;
  pour: PourEvent | null;
  /** Phase 3 문제 기록 */
  problemLog: ProblemRecord[];
  /** Phase 1·2 규칙 학습 기록 (보존) */
  legacyRecords: AttemptRecord[];
  review: ReviewCandidate[];
  orderLog: OrderOutcome[];
  dayHistory: DaySummary[];
  stats: { ordersCompleted: number; potionsSold: number; problemsSolved: number };
  paidOrderIds: string[];
  /** 해금한 재료 ID (저장 버전 4부터). 레시피 사용 가능 여부는 여기서 계산한다 (game/unlocks.ts) */
  unlockedIngredients: string[];
  /** 아직 확인하지 않은 '새 레시피 해금' 안내 (레시피 ID). 확인하면 빠진다 (저장 버전 5부터) */
  recipeNotices: string[];
  /** 새로 해금되어 다음 영업에 처음 주문으로 넣을 레시피 ID. 주문에 넣으면 빠진다 (저장 버전 5부터) */
  featuredRecipes: string[];
  shop: ShopState;
  /** 첫 주문 튜토리얼. 이전 저장·튜토리얼 없이 시작한 게임은 null */
  tutorial: TutorialState | null;
  /** 새 게임 오프닝. 이전 저장·완료 전 상태 */
  opening: OpeningState | null;
  /** 영업일 시작 복구 지점 (오늘·전날 최대 2개, 일차 오름차순) */
  checkpoints: DayCheckpoint[];
  /** 영업 중단 상태. 복구하기 전까지 다음 손님·다음 영업으로 넘어가지 않는다 */
  gameOver: GameOverState | null;
}
