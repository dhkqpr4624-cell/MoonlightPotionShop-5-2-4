/**
 * 한국어 조사 자동 선택. 숫자와 단위(mL, g)로 끝나는 말도 읽는 소리 기준으로 고른다.
 *   josa("0.6", "은/는") → "0.6은"  (영 점 육)
 *   josa("1.8mL", "을/를") → "1.8mL를" (밀리리터)
 */
type Pair = "은/는" | "이/가" | "과/와" | "을/를";

/** 숫자 끝자리의 받침 유무: 영·일·삼·육·칠·팔 (0은 영/십/백/천 등 모두 받침) */
const DIGIT_HAS_FINAL: Record<string, boolean> = {
  "0": true, "1": true, "2": false, "3": true, "4": false,
  "5": false, "6": true, "7": true, "8": true, "9": false,
};

const UNIT_HAS_FINAL: Record<string, boolean> = {
  mL: false, // 밀리리터
  g: true, // 그램
};

export function hasFinalConsonant(word: string): boolean {
  for (const [unit, v] of Object.entries(UNIT_HAS_FINAL)) {
    if (word.endsWith(unit)) return v;
  }
  const last = word.trim().slice(-1);
  if (last in DIGIT_HAS_FINAL) return DIGIT_HAS_FINAL[last];
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  return false;
}

export function josa(word: string, pair: Pair): string {
  const [withFinal, withoutFinal] = pair.split("/");
  return word + (hasFinalConsonant(word) ? withFinal : withoutFinal);
}
