/**
 * 기준 무대 (1280×720 CSS px): 타이틀·창구·제작대·마감 화면과 그 위의 팝업·계량 패널·상점 창·튜토리얼을
 * 모두 이 크기로 그린 뒤, 화면에 통째로 들어가도록(contain) 가로·세로 같은 배율로 줄이거나 키운다.
 *  - 사용할 수 있는 크기: 안전 영역(노치)을 뺀 실제 창 크기 (모바일 동적 주소창·회전·창 크기 변경을 따라감)
 *  - 비율이 다르면 바깥은 단색 여백. 그림 가장자리를 자르지 않는다.
 *  - 기기마다 요소를 다시 배치하지 않는다 (무대 안 좌표는 어디서나 같다).
 *  - 포인터 좌표는 clientToStage()로 배율·여백을 거꾸로 바꿔 쓴다 (getBoundingClientRect는 변환 뒤 화면 좌표).
 *  - 무대 안의 position: fixed 요소(팝업 배경 등)는 무대 상자를 기준으로 놓인다(transform이 있는 조상).
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const STAGE_W = 1280;
export const STAGE_H = 720;

export interface StageFit {
  /** 화면 px / 무대 px */
  scale: number;
  /** 무대 왼쪽 위의 화면 위치 (여백) */
  x: number;
  y: number;
}

export function fitStage(availW: number, availH: number): StageFit {
  const scale = Math.max(0.05, Math.min(availW / STAGE_W, availH / STAGE_H));
  return { scale, x: (availW - STAGE_W * scale) / 2, y: (availH - STAGE_H * scale) / 2 };
}

const StageContext = createContext<StageFit>({ scale: 1, x: 0, y: 0 });
export const useStageFit = () => useContext(StageContext);

/** 어떤 요소의 화면 좌표(client) → 그 요소 안의 CSS px 좌표 (조상의 transform 배율을 거꾸로) */
export function clientToLocal(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const kx = el.offsetWidth ? r.width / el.offsetWidth : 1;
  const ky = el.offsetHeight ? r.height / el.offsetHeight : 1;
  return { x: (clientX - r.left) / (kx || 1), y: (clientY - r.top) / (ky || 1) };
}

export function Stage({ children, testId = "stage" }: { children: ReactNode; testId?: string }) {
  const outer = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<StageFit>(() =>
    typeof window !== "undefined" ? fitStage(window.innerWidth, window.innerHeight) : { scale: 1, x: 0, y: 0 },
  );
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      const next = fitStage(el.clientWidth, el.clientHeight);
      setFit((p) => (Math.abs(p.scale - next.scale) < 0.0001 && Math.abs(p.x - next.x) < 0.5 && Math.abs(p.y - next.y) < 0.5 ? p : next));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    // 주소창이 나타나고 사라질 때 (일부 모바일 브라우저는 resize를 늦게 보낸다)
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div className="stage-viewport" ref={outer}>
      <StageContext.Provider value={fit}>
        <div
          className="stage-canvas"
          style={{ width: STAGE_W, height: STAGE_H, transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}
          data-testid={testId}
          data-scale={fit.scale.toFixed(4)}
        >
          {children}
        </div>
      </StageContext.Provider>
    </div>
  );
}
