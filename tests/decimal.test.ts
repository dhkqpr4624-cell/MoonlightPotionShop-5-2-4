import { test } from "node:test";
import assert from "node:assert/strict";
import {
  equals,
  multiplyStrings,
  parseDecimal,
  shiftPoint,
  toDecimalString,
} from "../src/lib/decimal.ts";
import { applyKey, validateAnswerInput } from "../src/lib/answerInput.ts";
import { josa } from "../src/lib/josa.ts";

test("정확한 소수 곱셈 (부동소수점 오차 없음)", () => {
  assert.equal(multiplyStrings("0.6", "3"), "1.8"); // JS: 0.6*3 = 1.7999999999999998
  assert.equal(multiplyStrings("0.25", "3"), "0.75");
  assert.equal(multiplyStrings("0.1", "3"), "0.3"); // JS: 0.30000000000000004
  assert.equal(multiplyStrings("1.2", "0.4"), "0.48");
  assert.equal(multiplyStrings("0.15", "0.4"), "0.06");
  assert.equal(multiplyStrings("4", "0.25"), "1");
  assert.equal(multiplyStrings("0.25", "4"), "1");
  assert.equal(multiplyStrings("2.4", "3"), "7.2");
  assert.equal(multiplyStrings("0.24", "3"), "0.72");
  assert.equal(multiplyStrings("0.05", "0.2"), "0.01");
  assert.equal(multiplyStrings("123.45", "6.7"), "827.115");
});

test("모든 별빛 포션 여러 병 문제의 정답", () => {
  const dew = ["1.2", "1.8", "2.4", "3", "3.6", "4.2", "4.8", "5.4"];
  const dust = ["0.5", "0.75", "1", "1.25", "1.5", "1.75", "2", "2.25"];
  for (let n = 2; n <= 9; n++) {
    assert.equal(multiplyStrings("0.6", String(n)), dew[n - 2]);
    assert.equal(multiplyStrings("0.25", String(n)), dust[n - 2]);
  }
});

test("동치 소수 판정: 0.5 = 0.50 = 0.500, 1 = 1.0 = 1.00", () => {
  assert.ok(equals(parseDecimal("0.5"), parseDecimal("0.50")));
  assert.ok(equals(parseDecimal("0.5"), parseDecimal("0.500")));
  assert.ok(equals(parseDecimal("1"), parseDecimal("1.00")));
  assert.ok(equals(parseDecimal("1.8"), parseDecimal("1.80")));
  assert.ok(!equals(parseDecimal("1.8"), parseDecimal("18")));
  assert.ok(!equals(parseDecimal("0.75"), parseDecimal("7.5")));
  assert.ok(!equals(parseDecimal("0.75"), parseDecimal("0.075")));
  assert.equal(toDecimalString(parseDecimal("0.50")), "0.5");
  assert.equal(toDecimalString(parseDecimal("2.000")), "2");
  assert.equal(toDecimalString(parseDecimal("0.00")), "0");
});

test("소수점 위치 이동과 1보다 작은 곱", () => {
  assert.equal(toDecimalString(shiftPoint(parseDecimal("7.2"), -1)), "0.72");
  assert.equal(toDecimalString(shiftPoint(parseDecimal("0.72"), 1)), "7.2");
  assert.equal(toDecimalString(shiftPoint(parseDecimal("0.6"), -2)), "0.006");
  assert.equal(multiplyStrings("0.25", "2"), "0.5");
  assert.equal(multiplyStrings("0.2", "0.3"), "0.06");
  assert.equal(multiplyStrings("0.05", "0.05"), "0.0025");
});

test("잘못된 입력 처리", () => {
  const bad: [string, string][] = [
    ["", "empty"],
    ["   ", "empty"],
    ["1.2.3", "multipleDots"],
    ["1..8", "multipleDots"],
    ["1,8", "invalidChar"],
    ["-1.8", "invalidChar"],
    ["1.8a", "invalidChar"],
    ["1e3", "invalidChar"],
    [".5", "leadingDot"],
    ["1.", "trailingDot"],
    ["01.8", "leadingZero"],
    ["00.5", "leadingZero"],
    ["123456789", "tooLong"],
  ];
  for (const [input, problem] of bad) {
    const r = validateAnswerInput(input);
    assert.equal(r.ok, false, input);
    if (!r.ok) assert.equal(r.problem, problem, input);
  }
  for (const good of ["0", "1.8", "0.75", "0.750", "10", "0.5"]) {
    assert.equal(validateAnswerInput(good).ok, true, good);
  }
  assert.throws(() => parseDecimal("1.2.3"));
});

test("키패드 입력: 소수점 중복 차단, 빈칸 소수점은 0., 지우기", () => {
  assert.equal(applyKey("", ".").text, "0.");
  const dup = applyKey("1.8", ".");
  assert.equal(dup.text, "1.8");
  assert.ok(dup.notice);
  assert.equal(applyKey("1.8", "backspace").text, "1.");
  assert.equal(applyKey("1.8", "clear").text, "");
  assert.equal(applyKey("12345678", "9").text, "12345678");
});

test("조사 자동 선택", () => {
  assert.equal(josa("0.6", "은/는"), "0.6은");
  assert.equal(josa("0.25", "은/는"), "0.25는");
  assert.equal(josa("1.8mL", "을/를"), "1.8mL를");
  assert.equal(josa("0.75g", "을/를"), "0.75g을");
  assert.equal(josa("달빛 이슬", "이/가"), "달빛 이슬이");
  assert.equal(josa("별가루", "이/가"), "별가루가");
  assert.equal(josa("3", "과/와"), "3과");
  assert.equal(josa("0.1", "이/가"), "0.1이");
  assert.equal(josa("0.01", "이/가"), "0.01이");
});
