/**
 * 답 입력 처리: 키패드/키보드 한 글자 입력과 제출 전 형식 검사.
 * 형식 문제(빈 입력, 소수점 중복 등)는 '오답'이 아니므로 시도 횟수에 넣지 않는다.
 */
import { parseDecimal, type Decimal } from "./decimal.ts";

export const MAX_INPUT_LENGTH = 8;

export type InputKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "." | "backspace" | "clear";

export interface KeyResult {
  text: string;
  /** 입력을 막았을 때 보여 줄 짧은 안내 */
  notice?: string;
}

export function applyKey(current: string, key: InputKey): KeyResult {
  if (key === "clear") return { text: "" };
  if (key === "backspace") return { text: current.slice(0, -1) };
  if (current.length >= MAX_INPUT_LENGTH) {
    return { text: current, notice: `숫자는 ${MAX_INPUT_LENGTH}칸까지 쓸 수 있어요.` };
  }
  if (key === ".") {
    if (current.includes(".")) {
      return { text: current, notice: "소수점은 한 번만 찍을 수 있어요." };
    }
    // 빈 칸에서 소수점을 누르면 '0.'으로 시작 (0.5 처럼 쓰기)
    return { text: current === "" ? "0." : current + "." };
  }
  return { text: current + key };
}

/** 키보드 이벤트의 key 값을 입력 키로 바꾼다. 관련 없는 키는 null */
export function keyFromKeyboard(key: string): InputKey | null {
  if (/^[0-9]$/.test(key)) return key as InputKey;
  if (key === "." || key === "Decimal") return ".";
  if (key === "Backspace") return "backspace";
  if (key === "Delete" || key === "Escape") return "clear";
  return null;
}

export type FormatProblem =
  | "empty"
  | "invalidChar"
  | "multipleDots"
  | "leadingDot"
  | "trailingDot"
  | "leadingZero"
  | "tooLong";

export type ValidationResult =
  | { ok: true; value: Decimal; text: string }
  | { ok: false; problem: FormatProblem; message: string };

const MESSAGES: Record<FormatProblem, string> = {
  empty: "계량할 양을 먼저 입력해 주세요.",
  invalidChar: "숫자와 소수점(.)만 쓸 수 있어요.",
  multipleDots: "소수점이 두 개 있어요. 소수점은 한 번만 찍어요.",
  leadingDot: "소수점 앞에 0을 써 볼까요? (예: 0.5)",
  trailingDot: "소수점 뒤에 숫자를 써 주세요.",
  leadingZero: "맨 앞의 0은 빼고 써 볼까요? (예: 05 → 5, 00.5 → 0.5)",
  tooLong: `숫자는 ${MAX_INPUT_LENGTH}칸까지 쓸 수 있어요.`,
};

export function validateAnswerInput(raw: string): ValidationResult {
  const text = raw.trim();
  const fail = (problem: FormatProblem): ValidationResult => ({
    ok: false,
    problem,
    message: MESSAGES[problem],
  });

  if (text === "") return fail("empty");
  if (!/^[0-9.]+$/.test(text)) return fail("invalidChar");
  if ((text.match(/\./g) ?? []).length > 1) return fail("multipleDots");
  if (text.length > MAX_INPUT_LENGTH) return fail("tooLong");
  if (text.startsWith(".")) return fail("leadingDot");
  if (text.endsWith(".")) return fail("trailingDot");
  if (/^0[0-9]/.test(text)) return fail("leadingZero");

  return { ok: true, value: parseDecimal(text), text };
}
