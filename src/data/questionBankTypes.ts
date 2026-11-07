/** 문제은행 문항 하나 = 재료 하나의 계산 과제 (손님 지정량 특별 주문) */
export type BankDifficulty = "하" | "중" | "상";
export type BankMulType = "소수×자연수" | "자연수×소수" | "소수×소수";

export interface BankQuestion {
  /** 원본 문제 ID (예: MP-001) */
  id: string;
  difficulty: BankDifficulty;
  mulType: BankMulType;
  /** 연결한 포션(레시피) ID */
  recipeId: string;
  /** 계산할 재료 ID */
  ingredientId: string;
  /** 인수 (원문 십진 문자열 그대로) */
  a: string;
  b: string;
  /** 정답 (원문 그대로. 판정은 동치 소수 비교) */
  answer: string;
  /** 주문 병 수 (소수×자연수는 b와 같은 병 수, 나머지는 1) */
  bottles: number;
  /** 손님 주문(기본 화면) */
  question: string;
  /** '네?' 다시 설명 */
  clarification: string;
  /** 주문서 힌트의 식 문장 (재료 이름 접두어 제외) */
  hint: string;
  /** 오답 확정 뒤 계량 패널 해설 */
  explanation: string;
}
