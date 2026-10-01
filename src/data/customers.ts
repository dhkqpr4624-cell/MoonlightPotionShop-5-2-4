/**
 * 손님 데이터. 짧은 인사·기다림·반응과 표정으로 개성을 보여 준다.
 * 외형은 문제 난이도와 관계없다. 손님은 학생을 탓하지 않고 '포션 결과'에만 반응한다.
 * {glow}는 포션의 빛깔 이름(예: 별빛)으로 바뀐다.
 */
import { josa } from "../lib/josa.ts";

export type Species = "fox" | "rabbit" | "cat" | "wolf";
export type Quality = "great" | "okay" | "poor";

export interface Customer {
  id: string;
  name: string;
  species: string;
  /** 임시 그래픽 종류 (components/art/AnimalArt.tsx) */
  artKey: Species;
  /** 최종 그림 경로(public/ 기준). 없으면 임시 그래픽 */
  image?: string;
  lines: {
    greet: string[];
    waiting: string[];
    reaction: Record<Quality, string[]>;
  };
}

const COMMON_REACTION: Record<Quality, string[]> = {
  great: ["오늘은 {glow}이 정말 선명하네요!", "딱 제가 바라던 빛깔이에요. 고마워요!"],
  okay: ["{glow}이 조금 흐리지만, 잘 가져갈게요.", "음, 살짝 아쉽지만 괜찮아요. 고마워요!"],
  poor: ["기대했던 빛깔과는 다르네요. 다음에는 더 반짝이면 좋겠어요.", "이번엔 빛이 많이 약하네요. 다음에 또 부탁할게요."],
};

export const CUSTOMERS: Record<string, Customer> = {
  fox: {
    id: "fox", name: "코코", species: "여우 수인", artKey: "fox",
    lines: {
      greet: ["안녕하세요, 사장님!", "달빛이 참 밝은 밤이에요!", "또 왔어요, 사장님!"],
      waiting: ["천천히 만들어 주세요. 기다릴게요!", "꼬리를 흔들며 기다리는 중이에요~"],
      reaction: COMMON_REACTION,
    },
  },
  rabbit: {
    id: "rabbit", name: "보리", species: "토끼 수인", artKey: "rabbit",
    lines: {
      greet: ["깡총! 아직 문 열었죠?", "당근밭에서 바로 왔어요!", "사장님, 귀가 쫑긋할 주문이 있어요!"],
      waiting: ["귀를 쫑긋 세우고 기다릴게요.", "당근 하나 먹으면서 기다릴게요~"],
      reaction: {
        ...COMMON_REACTION,
        great: ["우와, {glow}이 귀 끝까지 반짝여요!", "오늘은 {glow}이 정말 선명하네요!"],
      },
    },
  },
  cat: {
    id: "cat", name: "나비", species: "고양이 수인", artKey: "cat",
    lines: {
      greet: ["야옹, 오늘도 왔다냥.", "생선가게보다 여기가 더 좋다냥!", "밤 산책 중에 들렀다냥."],
      waiting: ["창틀에서 식빵 굽고 있을게냥.", "느긋하게 기다릴게냥~"],
      reaction: {
        great: ["{glow}이 아주 선명하다냥! 마음에 든다냥.", "오늘은 {glow}이 정말 선명하네요!"],
        okay: ["{glow}이 조금 흐리지만 괜찮다냥.", "{glow}이 조금 흐리지만, 잘 가져갈게요."],
        poor: ["음… 기대한 빛깔이랑 다르다냥. 다음엔 더 반짝이면 좋겠다냥.", "기대했던 빛깔과는 다르네요. 다음에는 더 반짝이면 좋겠어요."],
      },
    },
  },
  wolf: {
    id: "wolf", name: "달이", species: "늑대 수인", artKey: "wolf",
    lines: {
      greet: ["아우~ 보름달이 예쁜 밤이네요.", "숲 지킴이 달이예요. 부탁이 있어요.", "멀리서 포션 냄새 맡고 왔어요!"],
      waiting: ["달을 보면서 기다릴게요.", "꼬리 털 손질하면서 기다릴게요."],
      reaction: COMMON_REACTION,
    },
  },
};

export const CUSTOMER_IDS = Object.keys(CUSTOMERS);

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
