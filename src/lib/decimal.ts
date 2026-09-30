/**
 * 정확한 십진 연산.
 *
 * 소수는 항상 문자열("0.25")로 보관하고, 계산할 때만
 *   값 = digits × 10^(-scale)
 * 형태(digits: bigint, scale: 0 이상의 정수)로 바꾼다.
 * JavaScript 부동소수점(0.1 + 0.2 문제)에 전혀 의존하지 않는다.
 * 이 게임에서는 음수가 필요 없으므로 0 이상의 수만 다룬다.
 */

export interface Decimal {
  readonly digits: bigint;
  readonly scale: number;
}

/** 엄격한 십진 문자열 형식: "12", "0.5", "1.25" (앞의 점·뒤의 점·부호·지수 표기 불가) */
const STRICT_DECIMAL = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

export function isDecimalString(text: string): boolean {
  return STRICT_DECIMAL.test(text);
}

/** 데이터·프로그램 내부용 파서. 형식이 틀리면 예외를 던진다(데이터 오류를 일찍 발견). */
export function parseDecimal(text: string): Decimal {
  if (!isDecimalString(text)) {
    throw new Error(`올바른 소수 문자열이 아닙니다: "${text}"`);
  }
  const [intPart, fracPart = ""] = text.split(".");
  return { digits: BigInt(intPart + fracPart), scale: fracPart.length };
}

/** 소수 끝의 불필요한 0을 없앤 표준형. 0.50 → 0.5, 2.0 → 2 */
export function normalize(d: Decimal): Decimal {
  let { digits, scale } = d;
  while (scale > 0 && digits % 10n === 0n) {
    digits /= 10n;
    scale -= 1;
  }
  if (digits === 0n) scale = 0;
  return { digits, scale };
}

export function toDecimalString(d: Decimal): string {
  const n = normalize(d);
  if (n.scale === 0) return n.digits.toString();
  const raw = n.digits.toString().padStart(n.scale + 1, "0");
  const cut = raw.length - n.scale;
  return `${raw.slice(0, cut)}.${raw.slice(cut)}`;
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return normalize({ digits: a.digits * b.digits, scale: a.scale + b.scale });
}

/** 문자열끼리 곱해서 표준형 문자열로 돌려준다. multiplyStrings("0.6", "3") === "1.8" */
export function multiplyStrings(a: string, b: string): string {
  return toDecimalString(multiply(parseDecimal(a), parseDecimal(b)));
}

/** 두 수를 같은 scale로 맞춘다. */
function align(a: Decimal, b: Decimal): [bigint, bigint] {
  const scale = Math.max(a.scale, b.scale);
  return [
    a.digits * 10n ** BigInt(scale - a.scale),
    b.digits * 10n ** BigInt(scale - b.scale),
  ];
}

/** a < b 이면 음수, 같으면 0, 크면 양수 */
export function compare(a: Decimal, b: Decimal): number {
  const [x, y] = align(a, b);
  return x === y ? 0 : x < y ? -1 : 1;
}

/** 수학적으로 같은 값인지 (0.5 와 0.50 은 같다) */
export function equals(a: Decimal, b: Decimal): boolean {
  return compare(a, b) === 0;
}

/** 10의 거듭제곱 곱하기. k가 음수면 10^|k|로 나누기 (소수점 이동) */
export function shiftPoint(d: Decimal, k: number): Decimal {
  if (k >= 0) return normalize({ digits: d.digits * 10n ** BigInt(k), scale: d.scale });
  return normalize({ digits: d.digits, scale: d.scale - k });
}

/** 소수 부분의 자릿수 (표준형 기준). 0.60 → 1, 3 → 0 */
export function decimalPlaces(text: string): number {
  return normalize(parseDecimal(text)).scale;
}

/** 자연수(0 제외)인지 */
export function isNaturalNumber(text: string): boolean {
  const n = normalize(parseDecimal(text));
  return n.scale === 0 && n.digits > 0n;
}

/** 소수점을 뗀 숫자열 (앞뒤 0 제거). 1.8 → "18", 0.075 → "75" */
export function significantDigits(d: Decimal): string {
  const n = normalize(d);
  return n.digits.toString();
}
