/**
 * 새 게임 오프닝: 타이틀 그림(버튼 없이)이 상점 쪽으로 천천히 1.12배까지 확대되고, 주인공의 대사 세 줄을 한 줄씩 보여 준다.
 *  - '다음' 버튼이나 화면 빈 곳을 눌러야 넘어간다(자동으로 넘기지 않음).
 *  - 한 번 누름에 한 대사만: 버튼 클릭은 화면 클릭으로 번지지 않게 막고, 지금 보고 있는 대사 번호를 함께 보내 reducer가 한 번만 받는다.
 *  - 지금 대사 번호는 저장되므로 새로고침 후 '이어하기'를 하면 그 대사부터 (확대는 끝난 모습으로) 다시 보인다.
 *  - 마지막 대사를 넘기면 App이 창구로 바꾸고 기존 덧문 열기 → 첫 손님 → 첫 주문 튜토리얼 순서로 이어 간다.
 */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { assetUrl } from "../lib/assets.ts";
import { OPENING_LINES } from "../game/reducer.ts";
import { TITLE_IMAGE } from "./TitleScreen.tsx";
import { Icon } from "./Icon.tsx";

export function OpeningScene({ line, onNext }: { line: number; onNext: (fromLine: number) => void }) {
  // 처음(0번 대사)부터 볼 때만 확대 연출, 이어 보기는 확대된 모습에서 바로
  const [instant] = useState(line > 0);
  const [zoomed, setZoomed] = useState(line > 0);
  useEffect(() => {
    if (zoomed) return;
    // 첫 그림이 그려진 다음 프레임에 확대를 시작한다(전환이 보이도록)
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setZoomed(true)));
    return () => window.cancelAnimationFrame(id);
  }, [zoomed]);

  // 같은 대사에서 두 번 넘기지 않도록: 보낸 대사 번호를 기억하고, 새 대사가 보일 때까지 잠근다
  const sent = useRef<number | null>(null);
  useEffect(() => {
    sent.current = null;
  }, [line]);
  const next = () => {
    if (sent.current === line) return;
    sent.current = line;
    onNext(line);
  };
  const onButton = (e: MouseEvent) => {
    e.stopPropagation(); // 화면 클릭으로 한 번 더 처리되지 않게
    next();
  };

  return (
    <div
      className={`opening-wrap ${zoomed ? "is-zoomed" : ""} ${instant ? "is-instant" : ""}`}
      data-testid="opening"
      data-line={line}
      onClick={next}
    >
      <img className="opening-art" src={assetUrl(TITLE_IMAGE)} alt="밤의 달빛 포션 상점" draggable={false} data-testid="opening-art" />
      <div className="opening-shade" aria-hidden="true" />
      <div className="opening-dialog" role="dialog" aria-label="오프닝 대사" data-testid="opening-dialog">
        <div className="opening-name">
          <span className="name-tag">나</span> 달빛 포션 상점 주인
        </div>
        <p className="opening-line" aria-live="polite">
          <span key={line} className="opening-line-text" data-testid="opening-line">{OPENING_LINES[line]}</span>
        </p>
        <div className="opening-foot">
          <span className="opening-count" data-testid="opening-count">{line + 1} / {OPENING_LINES.length}</span>
          <button type="button" className="btn btn-primary opening-next" onClick={onButton} data-testid="opening-next" data-sfx="page" autoFocus>
            다음 <Icon name="arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}
