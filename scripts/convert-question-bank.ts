/**
 * 문제은행 TXT → 게임 데이터(src/data/questionBank.ts) 변환·검증.
 *   node scripts/convert-question-bank.ts            # 변환하고 파일을 쓴다
 *   node scripts/convert-question-bank.ts --check    # 쓰지 않고 검사만 (다른 점이 있으면 실패)
 *
 * - '[구조화 원본 JSON 시작]'과 '[구조화 원본 JSON 끝]' 사이의 배열만 읽는다.
 * - ID·개수(180, 난이도 3 × 곱셈 유형 3 × 20)·필수 필드·이름(포션·재료 → 기존 ID)을 검사한다.
 * - 정답은 문자열 십진 정수 연산(lib/decimal.ts)으로 다시 계산해 비교한다. 다르면 조용히 고치지 않고 실패한다.
 * - 바꾸는 것은 힌트·해설의 '숫자 뒤 을/를' 조사뿐이다(예: "4을" → "4를"). 바꾼 곳은 목록으로 남긴다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decimalPlaces, equals, isDecimalString, isNaturalNumber, multiplyStrings, parseDecimal } from "../src/lib/decimal.ts";
import { INGREDIENTS } from "../src/data/ingredients.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { hasFinalConsonant } from "../src/lib/josa.ts";

const ROOT = new URL("..", import.meta.url);
const SRC = new URL("docs/question-bank/Moonlight-Potion-Shop-180-Questions.txt", ROOT);
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
  josaFixes: { id: string; field: "hint" | "explanation"; before: string; after: string }[];
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
    const fix = (field: "hint" | "explanation") => {
      const before = String(x[field]);
      const after = fixNumberJosa(before);
      if (after !== before) josaFixes.push({ id, field, before, after });
      return after;
    };
    const hint = fix("hint");
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
      question: String(x.question),
      clarification: String(x.clarification),
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
 * 원본: docs/question-bank/Moonlight-Potion-Shop-180-Questions.txt
 * 다시 만들기: node scripts/convert-question-bank.ts
 * 정답은 원문 그대로이며, 변환할 때 십진 정수 연산으로 다시 계산해 모두 일치함을 확인했다.
 * 힌트·해설은 숫자 뒤 '을/를' 조사만 바로잡았다(숫자·식·정답은 원문 그대로).
 */
import type { BankQuestion } from "./questionBankTypes.ts";

export const QUESTION_BANK: readonly BankQuestion[] = ${JSON.stringify(questions, null, 1)};
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { questions, report } = convert(readFileSync(SRC, "utf8"));
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
