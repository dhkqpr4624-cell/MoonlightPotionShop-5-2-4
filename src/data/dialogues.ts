/**
 * 주문 대사(원래 말), 쉬운 설명('네?'), 주문 메모 틀.
 * 대사는 조금 엉뚱해도 계산 조건은 분명하게. 배경지식·말장난을 알아야 풀 수 있는 내용은 넣지 않는다.
 * 쉬운 설명은 무엇을 계산할지 분명히 하되 정답은 말하지 않는다.
 * {이름} 바로 뒤에 붙은 조사(이/가, 은/는, 을/를, 과/와)는 앞말에 맞게 자동으로 바뀐다.
 */
export const MULTI_ORIGINAL = [
  "{potion} {n}병 주세요! 오늘 밤 친구 {n}명이 놀러 오거든요.",
  "{potion} {n}병이요. 가방에 딱 {n}칸이 비어 있어요!",
  "{potion} {n}병 부탁해요. 병마다 별자리 이름을 붙일 거예요.",
];
export const MULTI_EASY =
  "{potion}을 {n}병 만들어 주세요. 레시피북에는 1병에 넣는 양이 적혀 있어요. {n}병이니까 재료마다 '1병당 양'을 {n}번 모은 만큼 넣으면 돼요.";

export const CUSTOM_ORIGINAL_LESS = [
  "{potion} 1병이요. 제 컵이 아주 작아서 기본 레시피의 {m}배로만 만들어 주세요.",
  "{potion} 1병, 기본 레시피의 {m}배로 연하게 부탁해요. 진하면 재채기가 나거든요.",
];
export const CUSTOM_ORIGINAL_MORE = [
  "{potion} 1병, 기본 레시피의 {m}배로 진하게요! 오늘은 아주 중요한 날이에요.",
  "{potion} 1병이요. 기본 레시피의 {m}배로 듬뿍 넣어 주세요. 모험을 떠나거든요!",
];
export const CUSTOM_EASY =
  "{potion} 1병이에요. 레시피북에 적힌 재료량을 하나씩 '{m}배'로 바꿔서 넣어 주세요. {m}배는 {m}을 곱한다는 뜻이에요. {compare} 기본 용액은 자동으로 맞춰져요.";
export const CUSTOM_LESS_NOTE = "{m}은 1보다 작으니까 기본량보다 적게 들어가요.";
export const CUSTOM_MORE_NOTE = "{m}은 1보다 크니까 기본량보다 많이 들어가요.";

export const LIFE_EACH_ORIGINAL =
  "{quirk} {item} 1{counter}가 {amount}. {item} {b}{counter}의 {measureWord}와 같은 숫자만큼 {ing}을 넣어 주세요. 포션은 {potion} 한 병이면 돼요.";
export const LIFE_RATIO_ORIGINAL =
  "{quirk} {item}이 {amount}. 그 {b}배와 같은 숫자만큼 {ing}을 넣어 주세요. 포션은 {potion} 한 병이면 돼요.";
export const LIFE_EACH_EASY =
  "{item} {b}{counter}의 {measureWord}를 계산해 주세요. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰면 돼요. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 마법 재료량으로 쓰는 특별 주문이에요. {other}는 레시피북의 1병 기본량으로 넣어 주세요.";
export const LIFE_RATIO_EASY =
  "{item} {a}{lu}의 {b}배를 계산해 주세요. 그 결과의 숫자를 {ing}의 {u} 값으로 쓰면 돼요. 단위를 바꾸는 계산이 아니라, 계산한 숫자를 그대로 마법 재료량으로 쓰는 특별 주문이에요. {other}는 레시피북의 1병 기본량으로 넣어 주세요.";

export const SHIFT_ORIGINAL =
  "지난번 특별 포션에는 달빛 이슬을 {refA} × {refB} = {p}mL 넣었대요. 이번에는 {newA} × {newB}mL로 해 주세요! 그런데 이번 양은 지난번의 몇 배예요?";
export const SHIFT_EASY =
  "두 곱셈식을 비교해 볼까요? 지난번은 {refA} × {refB}, 이번은 {newA} × {newB}예요. 어떤 수가 몇 배로 바뀌었는지 보고, 이번 곱이 지난번의 10배인지, 같은지, 1/10배인지 골라 주세요. 고르고 나면 달빛 이슬은 자동으로 계량돼요. 별가루는 레시피북의 1병 기본량으로 넣어 주세요.";

/** 특별 주문 규칙 (주문 메모에 항상 표시) */
export const LIFE_RULE_NOTE = "특별 주문 규칙: 계산한 숫자만 재료량으로 써요. 단위를 바꾸는 계산이 아니에요.";
