/**
 * 첫 주문 튜토리얼 단계. 저장된 게임 상태(주문 진행·화면)와 튜토리얼 표시(주문서·레시피북 확인)만으로 정하므로
 * 새로고침·처음 화면 → 이어하기 뒤에도 그 진행에 맞는 안내가 다시 나온다. 시간이 지나도 저절로 넘어가지 않는다.
 */
import { allTasksDone, currentOrder, isStirred } from "./reducer.ts";
import type { GameState } from "./types.ts";

export type TutorialStep =
  | "intro" // 새 계산 소개 카드 확인
  | "accept" // 주문 수락 (오케이)
  | "toBench" // (창구로 나와 있으면) 제작대로 가기
  | "order" // 주문서 열어 확인 → 닫기
  | "recipe" // 레시피북 열어 1병당 양 확인 → 닫기
  | "place" // 기력초를 항아리에 놓기 (누르고 항아리 누르기 또는 끌어다 놓기)
  | "measure" // 필요한 총량을 계산해 입력·제출
  | "add" // 입력한 양으로 투입
  | "stir" // 막대를 잡고 젓기
  | "bottle" // 병에 담기
  | "toCounter" // 창구로 가져가기
  | "deliver" // 포션 전달하기
  | "done";

export const TUTORIAL_STEPS: TutorialStep[] = ["intro", "accept", "toBench", "order", "recipe", "place", "measure", "add", "stir", "bottle", "toCounter", "deliver", "done"];

export function tutorialStep(state: GameState): TutorialStep | null {
  const tu = state.tutorial;
  if (!tu || tu.status !== "active") return null;
  const day = state.day;
  const order = currentOrder(state);
  if (!day || !order || order.id !== tu.orderId) return null;
  if (order.status === "paid") return "done";
  if (!day.introSeen) return "intro";
  if (order.status === "arrived") return "accept";
  if (order.status === "bottled") return state.scene === "workbench" ? "toCounter" : "deliver";
  // 제조 중
  if (state.scene !== "workbench") return "toBench";
  if (!tu.orderViewed) return "order";
  if (!tu.recipeViewed) return "recipe";
  if (state.activeTask !== null) {
    const t = order.tasks[state.activeTask];
    return t && t.status === "measured" ? "add" : "measure";
  }
  if (!allTasksDone(order)) return "place";
  if (!isStirred(order)) return "stir";
  return "bottle";
}
