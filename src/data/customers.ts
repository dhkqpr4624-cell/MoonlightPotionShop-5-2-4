/**
 * 손님 데이터. 손님은 짧은 주문·반응·표정으로 개성을 보여 준다.
 * 외형은 문제 난이도와 관계없다.
 * 대사 속 {potion}, {bottles} 는 주문 내용으로 바뀐다.
 */

export interface Customer {
  id: string;
  name: string;
  species: string;
  /** 임시 그래픽 키 (components/art 참고) */
  artKey: "fox";
  /** 최종 그림 경로(public/ 기준). 없으면 임시 그래픽 */
  image?: string;
  lines: {
    greet: string[];
    order: string[];
    waiting: string[];
    thanks: string[];
  };
}

export const CUSTOMERS: Record<string, Customer> = {
  fox: {
    id: "fox",
    name: "코코",
    species: "여우 수인",
    artKey: "fox",
    lines: {
      greet: ["안녕하세요, 사장님!", "달빛이 참 밝은 밤이에요!", "또 왔어요, 사장님!"],
      order: [
        "{potion} {bottles}병 주세요!",
        "오늘은 {potion} {bottles}병이 필요해요.",
        "{potion}, {bottles}병 부탁해요!",
      ],
      waiting: ["천천히 만들어 주세요. 기다릴게요!", "꼬리를 흔들며 기다리는 중이에요~"],
      thanks: ["와, 반짝반짝해요! 고마워요!", "정말 예쁜 포션이에요. 또 올게요!", "딱 제가 원하던 포션이에요!"],
    },
  },
};

export function getCustomer(id: string): Customer {
  const found = CUSTOMERS[id];
  if (!found) throw new Error(`알 수 없는 손님: ${id}`);
  return found;
}

export function fillLine(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
