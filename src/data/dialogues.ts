/**
 * 주문 대사(원래 말), 쉬운 설명('네?'), 주문 메모 틀.
 * 말투: 중세 유럽풍 판타지를 한국어로 옮긴 듯한, 읽기 쉬운 격식체. 손님마다 말투가 다르다(data/customers.ts의 style).
 *  hao 하오체(여우) · hamnida 합쇼체(토끼) · hage 하게체(표범) · knight 짧은 하오체(늑대)
 * 레시피명·수량·단위·조건은 분명하게. 배경지식·말장난을 알아야 풀 수 있는 내용은 넣지 않는다.
 * 쉬운 설명('네?')은 무엇을 계산할지 분명히 하되 정답은 말하지 않는다. 원래 말과 숫자·조건이 같다.
 * {이름} 바로 뒤에 붙은 조사(이/가, 은/는, 을/를, 과/와)는 앞말에 맞게 자동으로 바뀐다.
 *
 * 공통 변수: {potion} 포션 이름, {effect} 포션 효과, {n} 병 수, {m} 배수, {ing} 재료, {amt} 양(단위 포함)
 */
import type { SpeechStyle } from "./customers.ts";
import { hasFinalConsonant } from "../lib/josa.ts";

export interface DialogueSet {
  multiOriginal: string[];
  multiEasy: string;
  customLess: string[];
  customMore: string[];
  customEasy: string;
  lessNote: string;
  moreNote: string;
  lifeEachOriginal: string;
  lifeRatioOriginal: string;
  lifeEachEasy: string;
  lifeRatioEasy: string;
  otherNote: string;
  shiftOriginal: string;
  shiftEasy: string;
  amountPerOriginal: string[];
  amountPerEasy: string;
  amountBaseOriginal: string[];
  amountBaseEasy: string;
}

const HAO: DialogueSet = {
  multiOriginal: [
    "{potion} {n}병을 부탁하오. 해 뜨기 전에 길을 떠나야 하오.",
    "{potion} {n}병이 필요하오. 일행이 {n}명이라 한 병씩 나누어 줄 참이오.",
    "{potion} {n}병을 주시오. {effect}에 쓸 것이오.",
  ],
  multiEasy: "{potion} {n}병이오. 레시피북에 적힌 한 병에 드는 양을 기준으로 삼아, 재료마다 {n}병만큼 모아 넣어 주시오.",
  customLess: [
    "{potion} 한 병을 부탁하오. 모든 재료를 기본 레시피의 {m}배로 줄여 주시오. 내 잔이 아주 작소.",
    "{potion} 한 병을 연하게 부탁하오. 모든 재료를 기본 레시피의 {m}배로 넣어 주시오. 진하면 기침이 나오.",
  ],
  customMore: [
    "{potion} 한 병을 진하게 부탁하오. 모든 재료를 기본 레시피의 {m}배로 넣어 주시오. 오늘은 중요한 날이오.",
    "{potion} 한 병이오. 모든 재료를 기본 레시피의 {m}배로 넉넉히 넣어 주시오. 먼 원정을 떠나오.",
  ],
  customEasy: "{potion} 한 병이오. 레시피북에 적힌 모든 재료의 양을 하나씩 {m}배로 바꾸어 넣어 주시오. {m}배는 {m}을 곱한다는 뜻이오. {compare} 기본 용액은 저절로 맞추어지오.",
  lessNote: "{m}은 1보다 작으니 기본량보다 적게 들어가오.",
  moreNote: "{m}은 1보다 크니 기본량보다 많이 들어가오.",
  lifeEachOriginal: "{quirk} {item} 하나가 {amount}. {item} {b}{counter}의 {measureWord}와 같은 숫자만큼 {ing}을 넣어 주시오. 포션은 {potion} 한 병이면 되오.",
  lifeRatioOriginal: "{quirk} {item}이 {amount}. 그 {b}배와 같은 숫자만큼 {ing}을 넣어 주시오. 포션은 {potion} 한 병이면 되오.",
  lifeEachEasy: "{item} 하나가 {amount}. {item} {b}{counter}의 {measureWord}를 계산해 주시오. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰면 되오. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 재료량으로 쓰는 특별 주문이오.",
  lifeRatioEasy: "{item} {a}{lu}의 {b}배를 계산해 주시오. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰면 되오. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 재료량으로 쓰는 특별 주문이오.",
  otherNote: " {other}는 레시피북의 1병 기본량대로 넣어 주시오.",
  shiftOriginal: "{potion} 한 병을 부탁하오. 지난번에는 {ing}을 {refA}의 {refB}배인 {p}{u} 넣었소. 이번에는 {ing}을 {newA}의 {newB}배만큼 넣어 주시오. 지난번 양과 견주어 몇 배가 되는지 골라 주면 되오.",
  shiftEasy: "{potion} 한 병이오. 지난번은 {refA}의 {refB}배({p}{u})였고, 이번은 {newA}의 {newB}배요. 어느 수가 몇 배로 바뀌었는지 보고, 이번 양이 지난번의 10배인지, 같은지, 1/10배인지 골라 주시오. 고르면 {ing}은 저절로 계량되오.",
  amountPerOriginal: [
    "{potion} {n}병을 주시오. 나는 {ing}를 한 병에 {amt}씩만 넣어야 몸에 맞소.",
    "{potion} {n}병이오. 스승의 쪽지에 '한 병에 {ing} {amt}씩'이라 적혀 있소. 그대로 부탁하오.",
  ],
  amountPerEasy: "{potion} {n}병이오. 이번에는 레시피북의 양 대신 내가 정한 양을 쓰오. 한 병에 {ing} {amt}씩, {n}병이오. {amt}을 {n}번 모은 만큼 넣으면 되오. 기본 용액은 저절로 맞추어지오.",
  amountBaseOriginal: [
    "{potion} 한 병이오. 우리 집안 비법에는 {ing}를 {amt} 넣는데, 오늘은 그 {m}배로 부탁하오.",
    "{potion} 한 병을 주시오. 내가 늘 쓰는 {ing} 양은 {amtIs} 이번에는 그 {m}배만큼 넣어 주시오.",
  ],
  amountBaseEasy: "{potion} 한 병이오. 이번에는 레시피북의 양 대신 내가 알려 준 {ing} {amt}을 기준으로 하오. 그 {m}배를 넣어 주시오. {m}배는 {m}을 곱한다는 뜻이오. {compare} 기본 용액은 저절로 맞추어지오.",
};

const HAMNIDA: DialogueSet = {
  multiOriginal: [
    "{potion} {n}병을 부탁드립니다. 정원 일꾼 {n}명에게 하나씩 나누어 주려 합니다.",
    "{potion} {n}병이 필요합니다. 내일 장터에 가져가야 합니다.",
    "{potion} {n}병을 주시겠습니까? {effect}에 쓰려 합니다.",
  ],
  multiEasy: "{potion} {n}병입니다. 레시피북에 적힌 1병에 드는 양을 기준으로, 재료마다 {n}병만큼 모아서 넣어 주십시오.",
  customLess: [
    "{potion} 한 병을 부탁드립니다. 모든 재료를 기본 레시피의 {m}배로 줄여 주십시오. 아주 작은 병에 담아야 합니다.",
    "{potion} 한 병을 연하게 부탁드립니다. 모든 재료를 기본 레시피의 {m}배로 넣어 주십시오. 진하면 향이 너무 강합니다.",
  ],
  customMore: [
    "{potion} 한 병을 진하게 부탁드립니다. 모든 재료를 기본 레시피의 {m}배로 넣어 주십시오. 오늘은 큰일을 앞두고 있습니다.",
    "{potion} 한 병입니다. 모든 재료를 기본 레시피의 {m}배로 넉넉히 넣어 주십시오.",
  ],
  customEasy: "{potion} 한 병입니다. 레시피북에 적힌 모든 재료의 양을 하나씩 {m}배로 바꾸어 넣어 주십시오. {m}배는 {m}을 곱한다는 뜻입니다. {compare} 기본 용액은 저절로 맞추어집니다.",
  lessNote: "{m}은 1보다 작으니 기본량보다 적게 들어갑니다.",
  moreNote: "{m}은 1보다 크니 기본량보다 많이 들어갑니다.",
  lifeEachOriginal: "{quirk} {item} 하나가 {amount}. {item} {b}{counter}의 {measureWord}와 같은 숫자만큼 {ing}을 넣어 주십시오. 포션은 {potion} 한 병이면 됩니다.",
  lifeRatioOriginal: "{quirk} {item}이 {amount}. 그 {b}배와 같은 숫자만큼 {ing}을 넣어 주십시오. 포션은 {potion} 한 병이면 됩니다.",
  lifeEachEasy: "{item} 하나가 {amount}. {item} {b}{counter}의 {measureWord}를 계산해 주십시오. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰시면 됩니다. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 재료량으로 쓰는 특별 주문입니다.",
  lifeRatioEasy: "{item} {a}{lu}의 {b}배를 계산해 주십시오. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰시면 됩니다. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 재료량으로 쓰는 특별 주문입니다.",
  otherNote: " {other}는 레시피북의 1병 기본량대로 넣어 주십시오.",
  shiftOriginal: "{potion} 한 병을 부탁드립니다. 지난번에는 {ing}을 {refA}의 {refB}배인 {p}{u} 넣었다고 들었습니다. 이번에는 {ing}을 {newA}의 {newB}배만큼 넣어 주십시오. 지난번 양과 견주어 몇 배가 되는지 골라 주시면 됩니다.",
  shiftEasy: "{potion} 한 병입니다. 지난번은 {refA}의 {refB}배({p}{u})였고, 이번은 {newA}의 {newB}배입니다. 어느 수가 몇 배로 바뀌었는지 보고, 이번 양이 지난번의 10배인지, 같은지, 1/10배인지 골라 주십시오. 고르시면 {ing}은 저절로 계량됩니다.",
  amountPerOriginal: [
    "{potion} {n}병을 부탁드립니다. 저는 {ing}를 한 병에 {amt}씩만 넣어야 합니다.",
    "{potion} {n}병입니다. 할머님의 쪽지에 '한 병에 {ing} {amt}씩'이라고 적혀 있습니다. 그대로 부탁드립니다.",
  ],
  amountPerEasy: "{potion} {n}병입니다. 이번에는 레시피북의 양 대신 제가 정한 양을 씁니다. 한 병에 {ing} {amt}씩, {n}병입니다. {amt}을 {n}번 모은 만큼 넣으시면 됩니다. 기본 용액은 저절로 맞추어집니다.",
  amountBaseOriginal: [
    "{potion} 한 병입니다. 저희 집 비법에는 {ing}를 {amt} 넣는데, 오늘은 그 {m}배로 부탁드립니다.",
    "{potion} 한 병을 주시겠습니까? 제가 늘 쓰는 {ing} 양은 {amtIs} 이번에는 그 {m}배만큼 넣어 주십시오.",
  ],
  amountBaseEasy: "{potion} 한 병입니다. 이번에는 레시피북의 양 대신 제가 알려 드린 {ing} {amt}을 기준으로 합니다. 그 {m}배를 넣어 주십시오. {m}배는 {m}을 곱한다는 뜻입니다. {compare} 기본 용액은 저절로 맞추어집니다.",
};

const HAGE: DialogueSet = {
  multiOriginal: [
    "{potion} {n}병을 부탁하네. 상단 사람들에게 하나씩 돌릴 참일세.",
    "{potion} {n}병이 필요하네. 내일 아침 배에 실어야 하거든.",
    "{potion} {n}병을 주게. {effect}에 쓸 것일세.",
  ],
  multiEasy: "{potion} {n}병일세. 레시피북에 적힌 한 병에 드는 양을 기준으로, 재료마다 {n}병만큼 모아 넣어 주게.",
  customLess: [
    "{potion} 한 병을 부탁하네. 모든 재료를 기본 레시피의 {m}배로 줄여 주게. 작은 향수병에 담을 걸세.",
    "{potion} 한 병을 연하게 부탁하네. 모든 재료를 기본 레시피의 {m}배로 넣어 주게. 진하면 향이 지나치거든.",
  ],
  customMore: [
    "{potion} 한 병을 진하게 부탁하네. 모든 재료를 기본 레시피의 {m}배로 넣어 주게. 큰 거래가 있는 날일세.",
    "{potion} 한 병일세. 모든 재료를 기본 레시피의 {m}배로 넉넉히 넣어 주게.",
  ],
  customEasy: "{potion} 한 병일세. 레시피북에 적힌 모든 재료의 양을 하나씩 {m}배로 바꾸어 넣어 주게. {m}배는 {m}을 곱한다는 뜻이네. {compare} 기본 용액은 저절로 맞추어지네.",
  lessNote: "{m}은 1보다 작으니 기본량보다 적게 들어가네.",
  moreNote: "{m}은 1보다 크니 기본량보다 많이 들어가네.",
  lifeEachOriginal: "{quirk} {item} 하나가 {amount}. {item} {b}{counter}의 {measureWord}와 같은 숫자만큼 {ing}을 넣어 주게. 포션은 {potion} 한 병이면 되네.",
  lifeRatioOriginal: "{quirk} {item}이 {amount}. 그 {b}배와 같은 숫자만큼 {ing}을 넣어 주게. 포션은 {potion} 한 병이면 되네.",
  lifeEachEasy: "{item} 하나가 {amount}. {item} {b}{counter}의 {measureWord}를 계산해 주게. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰면 되네. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 재료량으로 쓰는 특별 주문일세.",
  lifeRatioEasy: "{item} {a}{lu}의 {b}배를 계산해 주게. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰면 되네. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 재료량으로 쓰는 특별 주문일세.",
  otherNote: " {other}는 레시피북의 1병 기본량대로 넣어 주게.",
  shiftOriginal: "{potion} 한 병을 부탁하네. 지난번에는 {ing}을 {refA}의 {refB}배인 {p}{u} 넣었다더군. 이번에는 {ing}을 {newA}의 {newB}배만큼 넣어 주게. 지난번 양과 견주어 몇 배가 되는지 골라 주면 되네.",
  shiftEasy: "{potion} 한 병일세. 지난번은 {refA}의 {refB}배({p}{u})였고, 이번은 {newA}의 {newB}배일세. 어느 수가 몇 배로 바뀌었는지 보고, 이번 양이 지난번의 10배인지, 같은지, 1/10배인지 골라 주게. 고르면 {ing}은 저절로 계량되네.",
  amountPerOriginal: [
    "{potion} {n}병을 주게. 나는 {ing}를 한 병에 {amt}씩만 넣어야 하네.",
    "{potion} {n}병일세. 거래처 쪽지에 '한 병에 {ing} {amt}씩'이라 적혀 있네. 그대로 부탁하네.",
  ],
  amountPerEasy: "{potion} {n}병일세. 이번에는 레시피북의 양 대신 내가 정한 양을 쓰네. 한 병에 {ing} {amt}씩, {n}병일세. {amt}을 {n}번 모은 만큼 넣으면 되네. 기본 용액은 저절로 맞추어지네.",
  amountBaseOriginal: [
    "{potion} 한 병일세. 우리 가문 비법에는 {ing}를 {amt} 넣는데, 오늘은 그 {m}배로 부탁하네.",
    "{potion} 한 병을 주게. 내가 늘 쓰는 {ing} 양은 {amtIs} 이번에는 그 {m}배만큼 넣어 주게.",
  ],
  amountBaseEasy: "{potion} 한 병일세. 이번에는 레시피북의 양 대신 내가 알려 준 {ing} {amt}을 기준으로 하네. 그 {m}배를 넣어 주게. {m}배는 {m}을 곱한다는 뜻이네. {compare} 기본 용액은 저절로 맞추어지네.",
};

const KNIGHT: DialogueSet = {
  ...HAO,
  multiOriginal: [
    "{potion} {n}병. 순찰대원 {n}명이 쓸 것이오.",
    "{potion} {n}병을 부탁하오. 새벽 순찰 전에 받아야 하오.",
    "{potion} {n}병이 필요하오. {effect}에 쓰겠소.",
  ],
  multiEasy: "{potion} {n}병이오. 레시피북의 1병당 양을 기준으로, 재료마다 {n}병만큼 넣어 주시오.",
  customLess: [
    "{potion} 한 병. 모든 재료를 기본 레시피의 {m}배로 줄여 주시오. 작은 수통에 담을 것이오.",
    "{potion} 한 병을 연하게 하시오. 모든 재료를 기본 레시피의 {m}배로 넣으면 되오. 진하면 감각이 흐려지오.",
  ],
  customMore: [
    "{potion} 한 병을 진하게 부탁하오. 모든 재료를 기본 레시피의 {m}배로 넣어 주시오. 오늘 밤 경계가 길 것이오.",
    "{potion} 한 병이오. 모든 재료를 기본 레시피의 {m}배로 넣어 주시오.",
  ],
  amountPerOriginal: [
    "{potion} {n}병. 내 몸에는 {ing}를 한 병에 {amt}씩만 넣어야 하오.",
    "{potion} {n}병이오. 대장의 명령서에 '한 병에 {ing} {amt}씩'이라 적혀 있소.",
  ],
  amountBaseOriginal: [
    "{potion} 한 병. 순찰대 비법은 {ing} {amt}이오. 오늘은 그 {m}배로 부탁하오.",
    "{potion} 한 병이오. 늘 쓰는 {ing} 양은 {amtIs} 이번에는 그 {m}배만큼 넣어 주시오.",
  ],
};

export const DIALOGUES: Record<SpeechStyle, DialogueSet> = { hao: HAO, hamnida: HAMNIDA, hage: HAGE, knight: KNIGHT };

/** 제조를 기다리는 동안 창구에서: 주문한 포션과 병 수를 다시 말한다 (예: "기력 포션 2병, 잘 부탁하오.") */
export function reminderLine(style: SpeechStyle, potion: string, bottles: number): string {
  const end = style === "hamnida" ? "잘 부탁드립니다." : style === "hage" ? "잘 부탁하네." : "잘 부탁하오.";
  return `${potion} ${bottles === 1 ? "한 " : bottles}병, ${end}`;
}

/** 말투에 맞는 서술 '이다': 하오체 1.2g이오 / 3m요, 합쇼체 1.2g입니다, 하게체 1.2g일세 */
export function styledCopula(word: string, style: SpeechStyle): string {
  if (style === "hamnida") return `${word}입니다`;
  if (style === "hage") return `${word}일세`;
  return word + (hasFinalConsonant(word) ? "이오" : "요");
}

/** 특별 주문 규칙 (주문 메모에 항상 표시) */
export const LIFE_RULE_NOTE = "특별 주문 규칙: 계산한 숫자만 재료량으로 써요. 단위를 바꾸는 계산이 아니에요.";
