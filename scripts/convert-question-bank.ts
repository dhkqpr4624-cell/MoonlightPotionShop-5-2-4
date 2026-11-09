/**
 * 문제은행 TXT → 게임 데이터(src/data/questionBank.ts) 변환·검증.
 * 원본: 주문 대사 개선판(…-Revised.txt). 처음 받은 TXT(…-Questions.txt)는 기록용으로 그대로 둔다.
 *   node scripts/convert-question-bank.ts            # 변환하고 파일을 쓴다
 *   node scripts/convert-question-bank.ts --check    # 쓰지 않고 검사만 (다른 점이 있으면 실패)
 *
 * - '[구조화 원본 JSON 시작]'과 '[구조화 원본 JSON 끝]' 사이의 배열만 읽는다.
 * - ID·개수(180, 난이도 3 × 곱셈 유형 3 × 20)·필수 필드·이름(포션·재료 → 기존 ID)을 검사한다.
 * - 정답은 문자열 십진 정수 연산(lib/decimal.ts)으로 다시 계산해 비교한다. 다르면 조용히 고치지 않고 실패한다.
 * - 바꾸는 것(모두 목록으로 남긴다):
 *   1) 숫자 뒤 '을/를' 조사 (예: "4을" → "4를", "10를" → "10을")
 *   2) 포션·재료 이름 뒤 조사 (예: "산호빛 해독제은" → "산호빛 해독제는", "기력초은" → "기력초는")
 *   3) 병 수를 '일행 N명에게 한 병씩'으로만 말한 주문에 '모두 N병'을 덧붙여 병 수를 분명히 (숫자는 그대로)
 * - 주문 대사 검사: 포션 이름·병 수·지정 재료·양·(배수 주문이면) 배수가 모두 들어 있고, 계산 질문(몇 g·총량)으로 끝나지 않으며,
 *   식(×, =)과 정답을 말하지 않는다. '네?' 재설명도 같은 조건(같은 수)이다.
 * - 이전 데이터(src/data/questionBank.ts)가 있으면 ID·난이도·포션·재료·인수·정답·병 수가 그대로인지 비교한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decimalPlaces, equals, isDecimalString, isNaturalNumber, multiplyStrings, parseDecimal } from "../src/lib/decimal.ts";
import { INGREDIENTS } from "../src/data/ingredients.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { hasFinalConsonant, josa } from "../src/lib/josa.ts";

const ROOT = new URL("..", import.meta.url);
const SRC = new URL("docs/question-bank/Moonlight-Potion-Shop-180-Questions-Revised.txt", ROOT);
const OUT = new URL("src/data/questionBank.ts", ROOT);
const START = "[구조화 원본 JSON 시작]";
const END = "[구조화 원본 JSON 끝]";

const FIELDS = ["id", "difficulty", "multiplication_type", "order_kind", "potion", "ingredient", "required_ingredients",
  "operand_a", "operand_b", "answer", "unit", "bottle_count", "question", "clarification", "hint", "explanation"] as const;
const DIFFS = ["하", "중", "상"];
const MTYPES = ["소수×자연수", "자연수×소수", "소수×소수"];
/** 같은 재료의 다른 이름 (새 재료를 만들지 않고 기존 ID로) */
const ALIASES: Record<string, string> = { "바람의 정령 조각": "windShard" };

type Raw = Record<(typeof FIELDS)[number], unknown>;

export interface ConvertReport {
  count: number;
  errors: string[];
  josaFixes: { id: string; field: "question" | "clarification" | "hint" | "explanation"; before: string; after: string }[];
}

const PAIRS: Record<string, string> = { 은: "은/는", 는: "은/는", 이: "이/가", 가: "이/가", 을: "을/를", 를: "을/를", 과: "과/와", 와: "과/와", 으로: "으로/로", 로: "으로/로" };
/** 포션·재료 이름 바로 뒤의 조사를 이름에 맞게 */
function fixNameJosa(text: string, names: string[]): string {
  let out = text;
  for (const n of [...names].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(으로|은|는|이|가|을|를|과|와|로)(?=[\\s.,]|$)`, "g");
    out = out.replace(re, (_m, p: string) => josa(n, PAIRS[p]));
  }
  return out;
}
/** '일행 N명에게 … 한 병씩 나누려 하오.' → 병 수를 '모두 N병'으로 분명히 */
function explicitBottles(text: string, bottles: number): string {
  return text.replace(/일행 (\d+)명에게 (.+?) 한 병씩 나누려 하오\./, (m, n: string, what: string) => (Number(n) === bottles ? `일행 ${n}명에게 ${what} 한 병씩, 모두 ${n}병 나누려 하오.` : m));
}

/** 숫자 끝에 붙은 '을/를'만 읽는 소리에 맞게 (다른 글자는 그대로) */
function fixNumberJosa(text: string): string {
  return text.replace(/(\d+(?:\.\d+)?)(을|를)(?=[\s.,)]|$)/g, (_m, num: string) => num + (hasFinalConsonant(num) ? "을" : "를"));
}

export function convert(txt: string) {
  const errors: string[] = [];
  const a = txt.indexOf(START);
  const b = txt.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error("구조화 원본 JSON 시작·끝 표시를 찾지 못했습니다.");
  const raw = JSON.parse(txt.slice(a + START.length, b)) as Raw[];
  if (!Array.isArray(raw)) throw new Error("JSON이 배열이 아닙니다.");
  const josaFixes: ConvertReport["josaFixes"] = [];
  const recipeByName = new Map(Object.values(RECIPES).filter((r) => !r.legacy).map((r) => [r.name, r]));
  const ingByName = new Map(Object.values(INGREDIENTS).filter((i) => !i.legacy).map((i) => [i.name, i.id]));
  const ingId = (name: string) => ingByName.get(name) ?? ALIASES[name];
  const ids = new Set<string>();
  const out = raw.map((x, i) => {
    const w = `${i + 1}번째(${String(x?.id)})`;
    for (const f of FIELDS) if (x[f] === undefined || x[f] === null || x[f] === "") errors.push(`${w}: ${f} 없음`);
    const id = String(x.id);
    if (!/^MP-\d{3}$/.test(id)) errors.push(`${w}: ID 형식`);
    if (ids.has(id)) errors.push(`${w}: ID 중복`);
    ids.add(id);
    if (!DIFFS.includes(String(x.difficulty))) errors.push(`${w}: 난이도`);
    if (!MTYPES.includes(String(x.multiplication_type))) errors.push(`${w}: 곱셈 유형`);
    if (x.order_kind !== "customerSpecified") errors.push(`${w}: order_kind`);
    if (x.unit !== "g") errors.push(`${w}: 단위`);
    const recipe = recipeByName.get(String(x.potion));
    if (!recipe) errors.push(`${w}: 알 수 없는 포션 ${String(x.potion)}`);
    const ingredientId = ingId(String(x.ingredient));
    if (!ingredientId) errors.push(`${w}: 알 수 없는 재료 ${String(x.ingredient)}`);
    if (recipe && ingredientId && !recipe.additives.some((ad) => ad.ingredientId === ingredientId)) errors.push(`${w}: ${recipe.name}에 없는 재료`);
    const req = Array.isArray(x.required_ingredients) ? (x.required_ingredients as string[]) : [];
    if (req.length !== 1 || ingId(req[0]) !== ingredientId) errors.push(`${w}: required_ingredients가 지정 재료와 다름`);
    const [oa, ob, ans] = [String(x.operand_a), String(x.operand_b), String(x.answer)];
    for (const o of [oa, ob, ans]) if (!isDecimalString(o)) errors.push(`${w}: 숫자 형식 ${o}`);
    if (isDecimalString(oa) && isDecimalString(ob) && isDecimalString(ans)) {
      if (decimalPlaces(oa) > 2 || decimalPlaces(ob) > 2) errors.push(`${w}: 인수가 소수 세 자리 이상`);
      if (decimalPlaces(ans) > 4) errors.push(`${w}: 정답이 소수 다섯 자리 이상`);
      const product = multiplyStrings(oa, ob);
      if (!equals(parseDecimal(product), parseDecimal(ans))) errors.push(`${w}: 정답 불일치 (원문 ${ans}, 계산 ${product})`);
      const mt = String(x.multiplication_type);
      const shapeOk =
        mt === "소수×자연수" ? !isNaturalNumber(oa) && isNaturalNumber(ob)
        : mt === "자연수×소수" ? isNaturalNumber(oa) && !isNaturalNumber(ob)
        : !isNaturalNumber(oa) && !isNaturalNumber(ob);
      if (!shapeOk) errors.push(`${w}: 곱셈 유형과 인수 모양이 다름`);
      const n = Number(x.bottle_count);
      if (mt === "소수×자연수" ? String(n) !== ob || n < 2 : n !== 1) errors.push(`${w}: 병 수`);
    }
    const names = [String(x.potion), String(x.ingredient)];
    const fix = (field: "question" | "clarification" | "hint" | "explanation") => {
      const before = String(x[field]);
      let after = fixNameJosa(fixNumberJosa(before), names);
      if (field === "question") after = explicitBottles(after, Number(x.bottle_count));
      if (after !== before) josaFixes.push({ id, field, before, after });
      return after;
    };
    const question = fix("question");
    const clarification = fix("clarification");
    const hint = fix("hint");
    // 대사 검사: 포션·병 수·재료·양·조건, 계산 질문 없음, 식·정답 없음
    {
      const mt = String(x.multiplication_type);
      const potion = String(x.potion), ingName = String(x.ingredient);
      const perBottle = mt === "소수×자연수";
      const bottleWord = perBottle ? `${x.bottle_count}병` : null;
      for (const [label, t] of [["대사", question], ["재설명", clarification]] as const) {
        if (!t.includes(potion)) errors.push(`${w}: ${label}에 포션 이름 없음`);
        if (!t.includes(ingName)) errors.push(`${w}: ${label}에 지정 재료 없음`);
        if (!t.includes(`${oa}g`)) errors.push(`${w}: ${label}에 지정 양 없음`);
        if (perBottle ? !t.includes(bottleWord!) : !/한 병|1병/.test(t)) errors.push(`${w}: ${label}에 병 수 없음`);
        if (perBottle ? !/씩/.test(t) : !t.includes(`${ob}배`)) errors.push(`${w}: ${label}에 1병당·배수 조건 없음`);
        if (/[?？]\s*$/.test(t) || /몇\s*g|총량|전체 양|모두 합해|얼마/.test(t)) errors.push(`${w}: ${label}이 계산 질문으로 끝남`);
        if (/[×=]/.test(t) || new RegExp(`(^|[^0-9.])${ans.replace(".", "\\.")}g`).test(t) && ans !== oa) errors.push(`${w}: ${label}에 식·정답`);
      }
      if (!perBottle && !/다른 재료|나머지 재료/.test(question)) errors.push(`${w}: 배수 주문에 다른 재료 조건 없음`);
      const nums = (t: string) => new Set(t.match(/\d+(?:\.\d+)?/g) ?? []);
      for (const n of nums(clarification)) if (!nums(question).has(n) && n !== "1") errors.push(`${w}: 재설명에 대사에 없는 수 ${n}`);
      for (const n of nums(question)) if (!nums(clarification).has(n)) errors.push(`${w}: 재설명에 대사의 수 ${n} 없음`);
    }
    const prefix = `${String(x.ingredient)}: `;
    return {
      id,
      difficulty: String(x.difficulty) as "하" | "중" | "상",
      mulType: String(x.multiplication_type) as "소수×자연수" | "자연수×소수" | "소수×소수",
      recipeId: recipe?.id ?? "",
      ingredientId: ingredientId ?? "",
      a: oa,
      b: ob,
      answer: ans,
      bottles: Number(x.bottle_count),
      question,
      clarification,
      hint: hint.startsWith(prefix) ? hint.slice(prefix.length) : hint,
      explanation: fix("explanation"),
    };
  });
  if (out.length !== 180) errors.push(`문항 수 ${out.length} (180이어야 함)`);
  for (const d of DIFFS) for (const m of MTYPES) {
    const c = out.filter((q) => q.difficulty === d && q.mulType === m).length;
    if (c !== 20) errors.push(`${d}·${m}: ${c}문항 (20이어야 함)`);
  }
  return { questions: out, report: { count: out.length, errors, josaFixes } as ConvertReport };
}

function render(questions: ReturnType<typeof convert>["questions"]): string {
  return `/**
 * 문제은행 180문항 (자동 생성 파일 — 직접 고치지 마세요).
 * 원본: docs/question-bank/Moonlight-Potion-Shop-180-Questions-Revised.txt (주문 대사 개선판)
 * 다시 만들기: node scripts/convert-question-bank.ts
 * 정답은 원문 그대로이며, 변환할 때 십진 정수 연산으로 다시 계산해 모두 일치함을 확인했다.
 * 숫자·이름 뒤 조사와 '모두 N병' 표기만 바로잡았다(숫자·식·정답은 원문 그대로). 목록: docs/question-bank/CONVERSION_REPORT.md
 */
import type { BankQuestion } from "./questionBankTypes.ts";

export const QUESTION_BANK: readonly BankQuestion[] = ${JSON.stringify(questions, null, 1)};
`;
}

/** 이전 데이터와 비교: 문항 ID·난이도·유형·포션·재료·인수·정답·병 수가 그대로여야 한다 */
export function compareWithPrevious(prev: readonly Record<string, unknown>[], next: readonly Record<string, unknown>[]): string[] {
  const errs: string[] = [];
  const keys = ["difficulty", "mulType", "recipeId", "ingredientId", "a", "b", "answer", "bottles"];
  const byId = new Map(prev.map((q) => [q.id as string, q]));
  if (prev.length !== next.length) errs.push(`문항 수가 바뀜 ${prev.length} → ${next.length}`);
  for (const q of next) {
    const o = byId.get(q.id as string);
    if (!o) { errs.push(`${String(q.id)}: 새 ID`); continue; }
    for (const k of keys) if (o[k] !== q[k]) errs.push(`${String(q.id)}: ${k} 바뀜 ${String(o[k])} → ${String(q[k])}`);
  }
  return errs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { questions, report } = convert(readFileSync(SRC, "utf8"));
  try {
    const prevText = readFileSync(OUT, "utf8");
    const prev = JSON.parse(prevText.slice(prevText.indexOf("= [") + 2, prevText.lastIndexOf("]") + 1)) as Record<string, unknown>[];
    report.errors.push(...compareWithPrevious(prev, questions as unknown as Record<string, unknown>[]));
  } catch {
    /* 이전 데이터가 없으면 비교하지 않는다 */
  }
  if (report.errors.length) {
    console.error("문제은행 오류:\n" + report.errors.join("\n"));
    process.exit(1);
  }
  const text = render(questions);
  if (process.argv.includes("--check")) {
    const cur = readFileSync(OUT, "utf8");
    if (cur !== text) {
      console.error("src/data/questionBank.ts 가 원본 TXT 변환 결과와 다릅니다.");
      process.exit(1);
    }
    console.log(`검사 통과: ${report.count}문항, 조사 수정 ${report.josaFixes.length}곳`);
  } else {
    writeFileSync(OUT, text);
    console.log(`변환 완료: ${report.count}문항, 오류 0, 조사 수정 ${report.josaFixes.length}곳`);
  }
}
