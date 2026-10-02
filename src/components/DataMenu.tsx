/**
 * 저장·기록 관리: 저장 데이터 내보내기/가져오기, 학습 결과 내보내기.
 * 가져오기는 검사 → (문제 있으면 오류 안내, 현재 저장 유지) → 교체 확인 → 적용 순서.
 */
import { useRef, useState } from "react";
import { buildLearningExport, buildSaveExport, exportFileName, parseImportText } from "../game/transfer.ts";
import type { GameState } from "../game/types.ts";
import { downloadJson, readFileText } from "../lib/download.ts";
import { newSeed } from "../lib/rng.ts";
import { Icon } from "./Icon.tsx";

function describe(state: GameState | null): string {
  if (!state || !state.day) return state ? `영업 시작 전 · 달빛 동전 ${state.money}개` : "없음";
  const d = state.day;
  const where = d.status === "closed" ? "영업 마감" : `손님 ${d.currentIndex + 1} / ${d.orders.length}`;
  return `밤 ${d.dayNumber}일차 · ${where} · 달빛 동전 ${state.money}개 · 학습 기록 ${state.problemLog.length + state.legacyRecords.length}개`;
}

export function DataMenu({
  state,
  canExport,
  onImport,
  defaultOpen = false,
}: {
  state: GameState;
  /** 저장을 읽지 못한 상태 등에서는 현재 상태 내보내기를 막는다 */
  canExport: boolean;
  onImport: (next: GameState) => void;
  defaultOpen?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [pending, setPending] = useState<{ state: GameState; migratedFrom: number | null; fileName: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportSave = () => {
    const now = new Date();
    downloadJson(exportFileName("save", state, now), buildSaveExport(state, now.toISOString()));
    setMessage("저장 데이터를 내려받았어요.");
  };
  const exportLearning = () => {
    const now = new Date();
    downloadJson(exportFileName("learning", state, now), buildLearningExport(state, now.toISOString()));
    setMessage("학습 결과를 내려받았어요.");
  };

  const onFile = async (file: File | undefined) => {
    setErrors(null);
    setMessage(null);
    setPending(null);
    if (!file) return;
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setErrors(["파일을 읽을 수 없어요."]);
      return;
    }
    const r = parseImportText(text, newSeed());
    if (!r.ok) setErrors(r.errors);
    else setPending({ state: r.state, migratedFrom: r.migratedFrom, fileName: file.name });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <details className="data-menu" open={defaultOpen || undefined} data-testid="data-menu">
      <summary><Icon name="save" size={18} /> 저장·기록 관리</summary>
      <div className="data-menu-body">
        <div className="data-menu-buttons">
          <button type="button" className="btn btn-light" onClick={exportSave} disabled={!canExport} data-testid="export-save">
            저장 데이터 내보내기
          </button>
          <button type="button" className="btn btn-light" onClick={() => fileRef.current?.click()} data-testid="import-save">
            저장 데이터 가져오기
          </button>
          <button type="button" className="btn btn-light" onClick={exportLearning} disabled={!canExport} data-testid="export-learning">
            학습 결과 내보내기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-file"
            onChange={(e: { currentTarget: HTMLInputElement }) => void onFile(e.currentTarget.files?.[0])}
          />
        </div>
        <p className="data-menu-note">
          저장 데이터는 다른 기기·브라우저에서 이어 하기 위한 파일이에요. 학습 결과는 이름 없이 문제별 기록과 영업별 집계만 담아요.
        </p>
        {message && <p className="data-menu-ok" role="status">{message}</p>}
        {errors && (
          <div className="data-menu-error" role="alert" data-testid="import-error">
            <strong>이 파일은 가져올 수 없어요. 지금 저장은 그대로 남아 있어요.</strong>
            <ul>
              {errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {errors.length > 5 && <li>그 밖에 {errors.length - 5}개 문제</li>}
            </ul>
          </div>
        )}
      </div>

      {pending && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-confirm-title" data-testid="import-confirm">
          <div className="modal">
            <h3 id="import-confirm-title">저장 데이터를 바꿀까요?</h3>
            <p className="muted small">{pending.fileName}</p>
            <table className="compare-table">
              <tbody>
                <tr>
                  <th>지금 저장</th>
                  <td>{canExport ? describe(state) : "읽을 수 없는 저장"}</td>
                </tr>
                <tr>
                  <th>가져올 파일</th>
                  <td>{describe(pending.state)}</td>
                </tr>
              </tbody>
            </table>
            {pending.migratedFrom !== null && <p className="small">Phase {pending.migratedFrom} 저장 파일이라 새 형식으로 옮겨서 가져와요.</p>}
            <p>
              <strong>지금 저장은 가져온 파일로 바뀌어요.</strong> 필요하면 먼저 ‘저장 데이터 내보내기’로 보관해 두세요.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-light" onClick={() => setPending(null)} data-testid="import-cancel">
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="import-apply"
                onClick={() => {
                  const next = pending.state;
                  setPending(null);
                  setMessage("저장 데이터를 가져왔어요.");
                  onImport(next);
                }}
              >
                바꾸기
              </button>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}
