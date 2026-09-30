/**
 * 오답 안내와 단계별 힌트.
 * 오답을 모두 같은 원인으로 단정하지 않는다. 원인이 분명할 때만 구체적으로 안내한다.
 */
import {
  compare,
  equals,
  multiply,
  normalize,
  parseDecimal,
  toDecimalString,
  type Decimal,
} from "../lib/decimal.ts";
import { josa } from "../lib/josa.ts";
import type { Feedback, HintVisual, Problem } from "./types.ts";

export type WrongCause = "decimalPoint" | "added" | "tooSmall" | "tooBig" | "unknown";

const ONE: Decimal = { digits: 1n, scale: 0 };

/** 끝의 0까지 모두 뗀 유효 숫자열: 1.8 → "18", 180 → "18", 0.018 → "18" */
function coreDigits(d: Decimal): string {
  const s = normalize(d).digits.toString();
  return s === "0" ? "0" : s.replace(/0+$/, "");
}

function floorDec(d: Decimal): Decimal {
  const n = normalize(d);
  return { digits: n.digits / 10n ** BigInt(n.scale), scale: 0 };
}

function ceilDec(d: Decimal): Decimal {
  const f = floorDec(d);
  return equals(f, d) ? f : { digits: f.digits + 1n, scale: 0 };
}

export interface SizeRange {
  /** 정답은 lower보다 크다 (strict) */
  lower: Decimal;
  /** 정답은 upper보다 작다 (strict). 없으면 null */
  upper: Decimal | null;
  sentence: string;
}

/** 계산 결과의 크기 어림 (힌트 1단계, 크기 오답 판정에 사용) */
export function sizeRange(p: Problem): SizeRange {
  const a = parseDecimal(p.a);
  const b = parseDecimal(p.b);
  const u = p.unit;
  if (p.bMeaning === "bottles") {
    // a × n (n ≥ 2): a보다 크고, (a를 올림한 자연수) × n 보다 작다
    const up = multiply(ceilDec(a), b);
    const floorA = floorDec(a);
    const lowFromFloor = multiply(floorA, b);
    const lower = compare(lowFromFloor, a) > 0 ? lowFromFloor : a;
    const lowerText = toDecimalString(lower);
    const upText = toDecimalString(up);
    const upperIsExact = equals(ceilDec(a), a);
    return {
      lower,
      upper: upperIsExact ? null : up,
      sentence: upperIsExact
        ? `${p.a}${u}씩 ${p.b}병이니까 ${p.a}${u}보다 많아야 해요.`
        : `${p.a}${u}씩 ${p.b}병이니까 ${lowerText}${u}보다 많고, ${toDecimalString(ceilDec(a))} × ${p.b} = ${upText}${u}보다는 적어요.`,
    };
  }
  // 기본량 a의 b배
  const cmp = compare(b, ONE);
  if (cmp < 0) {
    return {
      lower: { digits: 0n, scale: 0 },
      upper: a,
      sentence: `기본량의 ${p.b}배이므로 ${p.a}${u}보다 적어야 해요.`,
    };
  }
  return {
    lower: a,
    upper: null,
    sentence: `기본량의 ${p.b}배이므로 ${p.a}${u}보다 많아야 해요.`,
  };
}

export function diagnoseWrong(p: Problem, answerText: string): WrongCause {
  const given = parseDecimal(answerText);
  const correct = parseDecimal(p.answer);
  if (equals(given, correct)) throw new Error("정답은 오답 진단 대상이 아닙니다.");

  // 1) 숫자는 같고 소수점 위치만 다름 (예: 1.8 → 18, 0.18)
  if (given.digits !== 0n && coreDigits(given) === coreDigits(correct)) return "decimalPoint";

  // 2) 곱하지 않고 더함 (예: 0.6 + 3 = 3.6)
  const a = parseDecimal(p.a);
  const b = parseDecimal(p.b);
  const [x, y] = [a, b].map((d) => d.digits * 10n ** BigInt(Math.max(a.scale, b.scale) - d.scale));
  const sum = normalize({ digits: x + y, scale: Math.max(a.scale, b.scale) });
  if (equals(given, sum) && !equals(sum, correct)) return "added";

  // 3) 크기 어림을 벗어남
  const range = sizeRange(p);
  if (compare(given, range.lower) <= 0) return "tooSmall";
  if (range.upper && compare(given, range.upper) >= 0) return "tooBig";

  return "unknown";
}

export function wrongFeedback(p: Problem, answerText: string, ingredientName: string): Feedback {
  const cause = diagnoseWrong(p, answerText);
  const u = p.unit;
  const title = `${josa(answerText + u, "은/는")} 레시피와 맞지 않아요. 계량을 다시 해 볼까요?`;
  const range = sizeRange(p);
  switch (cause) {
    case "decimalPoint": {
      const tooBig = compare(parseDecimal(answerText), parseDecimal(p.answer)) > 0;
      return {
        kind: "wrong",
        title,
        lines: [
          "곱한 숫자는 잘 구했어요! 소수점의 위치를 다시 확인해 보세요.",
          tooBig ? `${josa(ingredientName, "이/가")} 너무 많아요. ${range.sentence}` : `${josa(ingredientName, "이/가")} 너무 적어요. ${range.sentence}`,
        ],
      };
    }
    case "added":
      return {
        kind: "wrong",
        title,
        lines: [
          p.bMeaning === "bottles"
            ? `혹시 ${josa(p.a, "과/와")} ${josa(p.b, "을/를")} 더했나요? ${p.b}병을 만들려면 1병당 양을 ${p.b}번 더한 만큼, 즉 곱해야 해요.`
            : `혹시 ${josa(p.a, "과/와")} ${josa(p.b, "을/를")} 더했나요? 기본량의 ${p.b}배는 곱셈으로 구해요.`,
        ],
      };
    case "tooSmall":
    case "tooBig":
      return { kind: "wrong", title, lines: [range.sentence] };
    default:
      return {
        kind: "wrong",
        title,
        lines: ["식을 한 번 더 천천히 계산해 보세요. 막히면 ‘힌트’를 눌러도 괜찮아요."],
      };
  }
}

function unitText(scale: number): string {
  return scale === 0 ? "1" : `0.${"0".repeat(scale - 1)}1`;
}

/** 단계별 힌트. level 1: 크기 어림, 2: 자연수 곱셈과 자릿값, 3: 단계별 풀이·그림 */
export function hintFeedback(p: Problem, level: number): Feedback {
  const a = normalize(parseDecimal(p.a));
  const b = normalize(parseDecimal(p.b));
  const u = p.unit;

  if (level <= 1) {
    return {
      kind: "hint",
      title: "힌트 1 · 답의 크기 어림하기",
      lines: [sizeRange(p).sentence],
    };
  }

  const na = a.digits.toString();
  const nb = b.digits.toString();
  const naturalProduct = (a.digits * b.digits).toString();
  const totalScale = a.scale + b.scale;

  if (level === 2) {
    const lines: string[] = [];
    if (a.scale > 0) lines.push(`${josa(p.a, "은/는")} ${na}의 ${unitText(a.scale)}배예요.`);
    if (b.scale > 0) lines.push(`${josa(p.b, "은/는")} ${nb}의 ${unitText(b.scale)}배예요.`);
    lines.push(`먼저 자연수로 계산하면 ${na} × ${nb} = ${naturalProduct}`);
    lines.push(
      `곱하는 두 수의 소수점 아래 자릿수를 더하면 ${a.scale} + ${b.scale} = ${totalScale}자리예요. 곱도 소수점 아래 ${totalScale}자리가 되게 소수점을 찍어요.`,
    );
    return { kind: "hint", title: "힌트 2 · 자연수의 곱과 소수점", lines };
  }

  const unit = unitText(totalScale);
  const lines: string[] = [];
  let visual: HintVisual | undefined;
  if (p.bMeaning === "bottles") {
    const repeated = Array.from({ length: Number(b.digits) }, () => p.a).join(" + ");
    lines.push(`${p.a} × ${p.b} = ${repeated}`);
    lines.push(`${josa(p.a, "은/는")} ${josa(unit, "이/가")} ${na}개예요.`);
    lines.push(`${p.b}병이면 ${josa(unit, "이/가")} ${na} × ${p.b} = ${naturalProduct}개예요.`);
    lines.push(`${josa(unit, "이/가")} ${naturalProduct}개인 수를 ${u} 단위로 써 보세요.`);
    if (Number(na) <= 30) {
      visual = { kind: "unitBlocks", perGroup: Number(na), groups: Number(b.digits), unitLabel: unit };
    }
  } else {
    lines.push(`${na} × ${nb} = ${naturalProduct}`);
    lines.push(`${unitText(a.scale)} × ${unitText(b.scale)} = ${unit}`);
    lines.push(`그래서 ${p.a} × ${josa(p.b, "은/는")} ${josa(unit, "이/가")} ${naturalProduct}개인 수예요.`);
  }
  return { kind: "hint", title: "힌트 3 · 단계별로 풀기", lines, visual };
}

export function correctFeedback(p: Problem, ingredientName: string, typed: string): Feedback {
  const lines = [`${p.a} × ${p.b} = ${p.answer}`, `${ingredientName} ${josa(p.answer + p.unit, "을/를")} 계량해서 솥에 넣었어요.`];
  if (typed !== p.answer) lines.push(`${josa(typed, "과/와")} ${josa(p.answer, "은/는")} 같은 수예요.`);
  return { kind: "correct", title: "딱 맞아요!", lines };
}
