/**
 * 손님 데이터. 짧은 인사·기다림·받기·반응 대사로 개성을 보여 준다(말투는 손님마다 다르다).
 * 외형은 문제 난이도와 관계없다. 손님은 학생을 탓하지 않고 '포션 결과'에만 반응한다.
 * {glow}는 포션의 빛깔 이름(예: 별빛)으로 바뀐다.
 */
import { josa } from "../lib/josa.ts";

export type Species = "fox" | "rabbit" | "cat" | "wolf";
export type Quality = "great" | "good" | "okay" | "poor";

/**
 * 말투(중세 유럽풍 판타지를 한국어로 옮긴 듯한 격식체). 주문 대사 틀은 data/dialogues.ts 에서 말투별로 고른다.
 *  hao      하오체 — "부탁하오", "기다리겠소"  (여우: 길을 떠도는 여행자)
 *  hamnida  합쇼체 — "부탁드립니다", "기다리겠습니다" (토끼: 예의 바른 상인·정원사)
 *  hage     하게체 — "부탁하네", "기다리겠네" (표범: 노련한 상인·귀족)
 *  knight   짧은 하오체 — "~이오. 부탁하오." 군더더기 없는 말 (늑대: 숲 순찰대)
 */
export type SpeechStyle = "hao" | "hamnida" | "hage" | "knight";

export interface Customer {
  id: string;
  name: string;
  species: string;
  /** 임시 그래픽 종류 (components/art/AnimalArt.tsx) */
  artKey: Species;
  /** 최종 그림 경로(public/ 기준). 없으면 임시 그래픽 */
  image?: string;
  style: SpeechStyle;
  lines: {
    greet: string[];
    waiting: string[];
    /** 병에 담은 포션을 받기 직전 */
    receive: string[];
    reaction: Record<Quality, string[]>;
  };
}

export const CUSTOMERS: Record<string, Customer> = {
  fox: {
    id: "fox", name: "코코", species: "여우 수인", artKey: "fox", style: "hao",
    lines: {
      greet: ["달빛이 밝은 밤이구려, 주인장.", "먼 길을 돌아 다시 들렀소.", "문이 열려 있어 다행이오."],
      waiting: ["서두를 것 없소. 창가에서 기다리겠소.", "천천히 만들어 주시오. 지도를 보며 기다리겠소."],
      receive: ["오, 내 포션이 다 되었소?"],
      reaction: {
        great: ["{glow}이 참으로 선명하오. 고맙소!", "바라던 그대로요. 길이 한결 가볍겠소."],
        good: ["{glow}이 거의 바라던 대로요. 잘 쓰겠소.", "조금 옅지만 충분히 훌륭하오."],
        okay: ["{glow}이 조금 흐리지만, 잘 가져가겠소.", "살짝 아쉽지만 괜찮소. 고맙소."],
        poor: ["기대한 빛깔과는 다르구려. 다음에는 더 빛나길 바라오.", "이번에는 빛이 많이 약하오. 다음에 또 부탁하겠소."],
      },
    },
  },
  rabbit: {
    id: "rabbit", name: "보리", species: "토끼 수인", artKey: "rabbit", style: "hamnida",
    lines: {
      greet: ["늦은 시각에 실례합니다, 주인장님.", "정원 일을 마치고 곧장 왔습니다.", "오늘도 문을 열어 주셔서 감사합니다."],
      waiting: ["천천히 만들어 주십시오. 여기서 기다리겠습니다.", "급하지 않습니다. 정원 장부를 보며 기다리겠습니다."],
      receive: ["제 포션이 준비되었습니까?"],
      reaction: {
        great: ["{glow}이 참 맑습니다! 정말 감사합니다.", "바라던 빛깔 그대로입니다. 잘 쓰겠습니다."],
        good: ["{glow}이 거의 바라던 대로입니다. 감사합니다.", "아주 조금 옅지만 훌륭합니다."],
        okay: ["{glow}이 조금 흐리지만 괜찮습니다. 감사합니다.", "살짝 아쉽지만 잘 쓰겠습니다."],
        poor: ["기대한 빛깔과는 조금 다릅니다. 다음에 다시 부탁드리겠습니다.", "이번에는 빛이 약합니다. 다음을 기약하겠습니다."],
      },
    },
  },
  cat: {
    id: "cat", name: "나비", species: "표범 수인", artKey: "cat", style: "hage",
    lines: {
      greet: ["좋은 밤일세, 주인장.", "상단 일을 마치고 들렀네.", "오늘도 자네 솜씨를 믿고 왔네."],
      waiting: ["느긋하게 하게. 여기서 기다리겠네.", "서두를 것 없네. 차라도 한 잔 하는 셈 치겠네."],
      receive: ["다 되었는가? 어디 보세."],
      reaction: {
        great: ["{glow}이 아주 선명하군. 마음에 드네.", "역시 자네 솜씨일세. 고맙네."],
        good: ["{glow}이 거의 흠잡을 데 없군. 잘 쓰겠네.", "조금 옅지만 훌륭하네."],
        okay: ["{glow}이 조금 흐리지만 괜찮네.", "살짝 아쉽지만 가져가겠네."],
        poor: ["음, 기대한 빛깔과는 다르군. 다음에는 더 빛나면 좋겠네.", "이번에는 빛이 약하네. 다음에 또 부탁하지."],
      },
    },
  },
  wolf: {
    id: "wolf", name: "달이", species: "늑대 수인", artKey: "wolf", style: "knight",
    lines: {
      greet: ["숲 순찰대요. 부탁할 것이 있소.", "보름달이 밝은 밤이오.", "멀리서 포션 냄새를 맡고 왔소."],
      waiting: ["기다리겠소. 서두르지 마시오.", "문가에서 망을 보며 기다리겠소."],
      receive: ["내 포션이오? 받겠소."],
      reaction: {
        great: ["{glow}이 선명하오. 고맙소.", "훌륭하오. 순찰에 큰 힘이 되겠소."],
        good: ["{glow}이 거의 바라던 대로요. 쓸 만하오.", "조금 옅으나 충분하오."],
        okay: ["{glow}이 조금 흐리오. 그래도 가져가겠소.", "아쉽지만 괜찮소."],
        poor: ["빛깔이 기대와 다르오. 다음에 다시 부탁하겠소.", "빛이 약하오. 다음에는 더 낫기를 바라오."],
      },
    },
  },
};

export const CUSTOMER_IDS = Object.keys(CUSTOMERS);

/**
 * 손님(종족)이 처음 찾아오기 시작하는 영업 일차. 새 주문을 만들 때만 쓴다(저장된 그날 손님은 바꾸지 않음).
 *  1~2일차 여우만 · 3~5일차 + 토끼 · 6~7일차 + 표범 계열 · 8일차부터 + 늑대
 * 손님 종족은 문제 난이도와 관계없다. 종족이 더 생기면 여기에 다음 일차를 적으면 된다.
 */
export const CUSTOMER_OPEN_DAY: Record<string, number> = { fox: 1, rabbit: 3, cat: 6, wolf: 8 };

/** 이 일차에 찾아올 수 있는 손님 ID (열린 순서대로) */
export function customersForDay(dayNumber: number): string[] {
  return CUSTOMER_IDS.filter((id) => (CUSTOMER_OPEN_DAY[id] ?? 1) <= dayNumber);
}

/** 이 일차에 처음 열리는 손님 ID */
export function newCustomersOnDay(dayNumber: number): string[] {
  return CUSTOMER_IDS.filter((id) => (CUSTOMER_OPEN_DAY[id] ?? 1) === dayNumber);
}

export function getCustomer(id: string): Customer {
  const found = CUSTOMERS[id];
  if (!found) throw new Error(`알 수 없는 손님: ${id}`);
  return found;
}

export function fillLine(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}([이가은는을를과와])?/g, (_m, key: string, particle?: string) => {
    const v = String(values[key] ?? `{${key}}`);
    if (!particle) return v;
    const pair = { 이: "이/가", 가: "이/가", 은: "은/는", 는: "은/는", 을: "을/를", 를: "을/를", 과: "과/와", 와: "과/와" }[particle] as
      | "이/가" | "은/는" | "을/를" | "과/와";
    return josa(v, pair);
  });
}
