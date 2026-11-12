/**
 * 타이틀 화면: '달빛 포션 상점의 밤' 그림(제목·부제가 그려져 있음)을 무대 전체에 그대로 보여 주고,
 * 그림의 제목·부제·가운데 상점을 가리지 않는 오른쪽 아래에 HTML 버튼 두 개를 둔다.
 *  - 새로 시작하기: 진행이 있으면 교체 확인(취소하면 아무것도 바뀌지 않음) → 처음 상태 + 첫 주문 튜토리얼
 *  - 이어하기: 저장된 화면·주문·입력·젓기·전달·마감 상태로 돌아간다. 저장이 없으면 누를 수 없다.
 *  - 보조(왼쪽 아래, 작게): 학습 기록, 저장·기록 관리(내보내기·가져오기), 소리
 * 이 화면을 여는 것만으로는 저장을 바꾸지 않는다.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { assetUrl } from "../lib/assets.ts";
import { Icon } from "./Icon.tsx";
import { downloadText } from "../lib/download.ts";
import { currentOrder } from "../game/reducer.ts";
import type { GameState } from "../game/types.ts";
import { DataMenu } from "./DataMenu.tsx";
import { fmtMoney } from "../lib/money.ts";

export const TITLE_IMAGE = "assets/ui/title-night.png";

export interface LoadIssue {
  reason: "corrupt" | "invalid" | "unsupportedVersion";
  errors: string[];
  raw: string;
}

function statusText(state: GameState): string | null {
  const day = state.day;
  if (!day) return null;
  if (state.gameOver) return `밤 ${day.dayNumber}일차 · 영업 중단 · 달빛 동전 ${fmtMoney(state.money)}개`;
  if (state.opening && !state.opening.done) return `새 가게 오프닝 (${state.opening.line + 1}/3)`;
  if (day.status === "closed") return `밤 ${day.dayNumber}일차 영업 마감 · 달빛 동전 ${fmtMoney(state.money)}개`;
  const o = currentOrder(state);
  const step =
    o?.status === "brewing" ? "포션 만드는 중" : o?.status === "bottled" ? "포션 전달 전" : o?.status === "paid" ? "판매 완료" : "주문 대기";
  return `밤 ${day.dayNumber}일차 · 손님 ${day.currentIndex + 1}/${day.orders.length} · ${step} · 달빛 동전 ${fmtMoney(state.money)}개`;
}

/** 지울 진행이 있는지 (새로 시작하기 확인 여부) */
export function hasProgress(state: GameState): boolean {
  return state.day !== null || state.money !== 0 || state.problemLog.length + state.legacyRecords.length > 0 || state.shop.owned.length > 0;
}

export function TitleScreen({
  state, loadIssue, migratedFrom, onContinue, onNewGame, onImport, onRecords, sound,
}: {
  state: GameState;
  loadIssue: LoadIssue | null;
  migratedFrom: number | null;
  onContinue: () => void;
  /** 확인을 마친 뒤 호출 (진행 초기화 + 튜토리얼 시작) */
  onNewGame: () => void;
  onImport: (next: GameState) => void;
  onRecords: () => void;
  sound?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [dataOpen, setDataOpen] = useState(!!loadIssue);
  const busy = useRef(false);
  const canContinue = !loadIssue && state.day !== null;
  const progress = !!loadIssue || hasProgress(state);
  const status = statusText(state);

  // 같은 화면에서 버튼을 연달아 눌러도 시작 처리는 한 번만
  const startNew = () => {
    if (busy.current) return;
    if (progress) {
      setConfirming(true);
      return;
    }
    busy.current = true;
    onNewGame();
  };
  const confirmNew = () => {
    if (busy.current) return;
    busy.current = true;
    setConfirming(false);
    onNewGame();
  };
  const cont = () => {
    if (busy.current || !canContinue) return;
    busy.current = true;
    onContinue();
  };
  useEffect(() => {
    // 화면이 다시 열리면(처음 화면으로 돌아옴) 다시 누를 수 있게
    busy.current = false;
  }, [state.day?.dayNumber, loadIssue]);

  return (
    <div className="title-wrap" data-testid="title">
      <img className="title-art" src={assetUrl(TITLE_IMAGE)} alt="달빛 포션 상점 — 5학년 2학기 소수의 곱셈" draggable={false} data-testid="title-art" />

      <div className="title-main" data-testid="title-main">
        <button type="button" className="btn title-btn title-btn-new" onClick={startNew} data-testid="new-game" data-sfx="none">
          <Icon name="moon" size={24} /> 새로 시작하기
        </button>
        <button type="button" className="btn title-btn title-btn-continue" onClick={cont} disabled={!canContinue} data-testid="continue" data-sfx="click">
          <Icon name="arrow" size={24} /> 이어하기
        </button>
        <p className="title-status" data-testid="title-status">{loadIssue ? "저장을 읽지 못했어요. 아래 안내를 확인해 주세요." : status ?? "저장된 진행이 없어요."}</p>
        {migratedFrom !== null && !loadIssue && (
          <p className="title-notice" role="status" data-testid="migrated-notice">
            저장을 새 형식으로 옮겼어요. 달빛 동전·일차·진행 중인 주문은 그대로예요.
          </p>
        )}
      </div>

      <div className="title-sub-actions">
        <button type="button" className="btn title-mini" onClick={onRecords} disabled={!!loadIssue || !hasProgress(state)} data-testid="open-records">
          <Icon name="records" size={16} /> 학습 기록
        </button>
        <button type="button" className="btn title-mini" onClick={() => setDataOpen(true)} data-testid="open-data">
          <Icon name="save" size={16} /> 저장·기록 관리
        </button>
        {sound && <div className="title-sound">{sound}</div>}
      </div>

      {loadIssue && (
        <div className="recovery title-recovery" role="alert" data-testid="recovery">
          <strong>
            {loadIssue.reason === "unsupportedVersion" ? "이 저장은 더 새로운 버전의 게임에서 만든 것이라 열 수 없어요." : "저장된 진행 상황을 읽을 수 없어요."}
          </strong>
          <ul>
            {loadIssue.errors.slice(0, 3).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p>저장은 아직 지우지 않았어요. 보관용으로 내려받거나, ‘저장·기록 관리’에서 다른 저장 파일을 가져오거나, ‘새로 시작하기’를 눌러 지우고 시작할 수 있어요.</p>
          <button type="button" className="btn btn-light" onClick={() => downloadText(`moonlight-damaged-save-${Date.now()}.json`, loadIssue.raw)} data-testid="download-damaged">
            읽지 못한 저장 내려받기(보관용)
          </button>
        </div>
      )}

      {confirming && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title" data-testid="confirm-new">
          <div className="modal confirm-modal">
            <h3 id="confirm-title">처음부터 새로 시작할까요?</h3>
            <p>
              {loadIssue
                ? "읽지 못한 저장을 지우고 처음부터 시작해요. (먼저 내려받아 보관할 수 있어요)"
                : "지금까지의 진행(일차·달빛 동전·산 재료와 상품·학습 기록)이 모두 지워지고 첫 주문부터 다시 시작해요."}
            </p>
            {status && <p className="small muted">지금 저장: {status}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-light" onClick={() => setConfirming(false)} data-testid="confirm-cancel" autoFocus>
                취소
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmNew} data-testid="confirm-ok">
                지우고 새로 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {dataOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="저장·기록 관리" data-testid="data-modal"
          onClick={(e: { target: EventTarget; currentTarget: EventTarget }) => { if (e.target === e.currentTarget) setDataOpen(false); }}>
          <div className="modal data-modal">
            <div className="data-modal-head">
              <h3>저장·기록 관리</h3>
              <button type="button" className="btn btn-light" onClick={() => setDataOpen(false)} data-testid="data-close">
                <Icon name="close" size={18} /> 닫기
              </button>
            </div>
            <DataMenu state={state} canExport={!loadIssue} onImport={(next) => { setDataOpen(false); onImport(next); }} defaultOpen />
          </div>
        </div>
      )}
    </div>
  );
}
