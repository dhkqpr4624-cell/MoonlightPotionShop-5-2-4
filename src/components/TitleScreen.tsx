import type { ReactNode } from "react";
import { assetUrl } from "../lib/assets.ts";
import { Icon } from "./Icon.tsx";
import { SHOP_ART } from "../data/shopArt.ts";
import { downloadText } from "../lib/download.ts";
import { currentOrder } from "../game/reducer.ts";
import type { GameState } from "../game/types.ts";
import { DataMenu } from "./DataMenu.tsx";

export interface LoadIssue {
  reason: "corrupt" | "invalid" | "unsupportedVersion";
  errors: string[];
  raw: string;
}

function statusText(state: GameState): string | null {
  const day = state.day;
  if (!day) return state.money > 0 ? `달빛 동전 ${state.money}개` : null;
  if (day.status === "closed") return `밤 ${day.dayNumber}일차 영업 마감 · 달빛 동전 ${state.money}개`;
  const o = currentOrder(state);
  const step =
    o?.status === "brewing" ? "포션 만드는 중" : o?.status === "bottled" ? "포션 전달 전" : o?.status === "paid" ? "판매 완료" : "주문 대기";
  return `밤 ${day.dayNumber}일차 · 손님 ${day.currentIndex + 1} / ${day.orders.length} (${step}) · 달빛 동전 ${state.money}개`;
}

export function TitleScreen({
  state,
  loadIssue,
  migratedFrom,
  onStart,
  onReset,
  onImport,
  onRecords,
  sound,
}: {
  state: GameState;
  loadIssue: LoadIssue | null;
  migratedFrom: number | null;
  onStart: () => void;
  onReset: () => void;
  onImport: (next: GameState) => void;
  onRecords: () => void;
  sound?: ReactNode;
}) {
  const hasProgress = state.day !== null || state.money > 0 || (state.problemLog.length + state.legacyRecords.length) > 0;
  const closed = state.day?.status === "closed";
  const status = statusText(state);

  return (
    <div className="title-wrap">
      <img className="title-backdrop" src={assetUrl(SHOP_ART.counterRoom)} alt="" aria-hidden="true" data-testid="title-backdrop" />
      {sound && <div className="title-sound">{sound}</div>}
    <div className="title-screen">
      <div className="title-sign">
        <img className="title-logo" src={assetUrl("assets/ui/moon-logo.svg")} alt="" width={96} height={96} data-testid="logo" />
        <h1 className="title-name">달빛 포션 상점</h1>
        <p className="title-sub">밤에만 문을 여는 작은 포션 가게. 레시피대로 재료를 계산해 포션을 만들어요.</p>
      </div>

      {loadIssue ? (
        <div className="recovery" role="alert" data-testid="recovery">
          <strong>
            {loadIssue.reason === "unsupportedVersion"
              ? "이 저장은 더 새로운 버전의 게임에서 만든 것이라 열 수 없어요."
              : "저장된 진행 상황을 읽을 수 없어요."}
          </strong>
          <ul>
            {loadIssue.errors.slice(0, 4).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p>저장은 아직 지우지 않았어요. 아래에서 골라 주세요.</p>
          <div className="recovery-actions">
            <button
              type="button"
              className="btn btn-light"
              onClick={() => downloadText(`moonlight-damaged-save-${Date.now()}.json`, loadIssue.raw)}
              data-testid="download-damaged"
            >
              읽지 못한 저장 내려받기(보관용)
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="reset-damaged"
              onClick={() => {
                if (window.confirm("읽지 못한 저장을 지우고 처음부터 시작할까요? (먼저 내려받아 보관할 수 있어요)")) onReset();
              }}
            >
              지우고 새로 시작하기
            </button>
          </div>
          <p className="small">다른 곳에 내보내 둔 저장 파일이 있다면 아래 ‘저장 데이터 가져오기’로 불러올 수 있어요.</p>
        </div>
      ) : (
        <>
          {migratedFrom !== null && (
            <p className="title-notice" role="status" data-testid="migrated-notice">
              이전 버전(Phase {migratedFrom})의 저장을 새 형식으로 옮겼어요. 달빛 동전과 학습 기록은 그대로예요. 진행 중이던 하루는 이전 규칙으로 마치고, 다음 영업부터 새 규칙이 적용돼요.
            </p>
          )}
          <button type="button" className="btn btn-primary btn-big btn-start" onClick={onStart} data-testid="start" data-sfx={state.day ? "click" : "none"}>
            {!state.day ? "가게 문 열기" : closed ? "이어하기 (영업 마감 결과 보기)" : "이어서 영업하기"}
          </button>
          {status && (
            <p className="title-status" data-testid="title-status">
              {status}
            </p>
          )}
        </>
      )}

      {!loadIssue && hasProgress && (
        <button type="button" className="btn btn-light" onClick={onRecords} data-testid="open-records">
          <Icon name="records" size={20} /> 학습 기록 보기
        </button>
      )}

      <DataMenu state={state} canExport={!loadIssue} onImport={onImport} defaultOpen={!!loadIssue} />

      {hasProgress && !loadIssue && (
        <button
          type="button"
          className="btn btn-ghost small"
          onClick={() => {
            if (window.confirm("저장된 진행 상황을 모두 지우고 처음부터 시작할까요?")) onReset();
          }}
        >
          처음부터 다시 하기
        </button>
      )}
      <p className="title-phase">4단계 시험판 · 손님과 가게를 새로 그렸어요</p>
    </div>
    </div>
  );
}
