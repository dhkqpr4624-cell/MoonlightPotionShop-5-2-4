/**
 * 손님 응대 창구 장면 (PNG 3장 + 손님 PNG + 기존 덧문).
 *
 * 겹침 순서(뒤 → 앞): 마을길 → 손님 → 덧문 → 아치 → 테이블.  대사창·주문서·버튼은 이 장면 위의 HTML.
 *
 * 배치: 창구 캔버스(1672×941)를 늘리지 않고 같은 비율로 키워 화면을 덮는다(남는 바깥쪽만 잘림).
 * 이때 캔버스의 카운터 윗면(tableTop)이 화면의 주문서·버튼 영역 윗면과 정확히 같은 높이가 되게 맞춘다.
 */
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { COUNTER_SCENE as SC } from "../../data/shopArt.ts";
import type { Appearance } from "../../data/appearances.ts";
import { assetUrl } from "../../lib/assets.ts";
import { Shutters, type ShutterMode } from "./Shutters.tsx";
import { AnimalArt, type Mood } from "./AnimalArt.tsx";
import type { Species } from "../../data/customers.ts";

export interface SceneLayout {
  /** 화면 px / 캔버스 px */
  s: number;
  width: number;
  height: number;
  /** 카운터 윗면의 화면 y (장면 상자 기준) */
  tableY: number;
  sceneLeft: number;
  sceneTop: number;
  /** 아래 HTML 카운터 영역 높이 */
  counterH: number;
  /** 좁은 화면: 손님 가운데, 대사창은 위 */
  narrow: boolean;
}

const NARROW_PX = 900;

export function computeLayout(width: number, height: number, contentH: number): SceneLayout {
  const below = SC.height - SC.tableTop;
  let s = Math.max(width / SC.width, height / SC.height);
  let counterH = below * s;
  if (contentH > counterH) {
    // 주문서·버튼이 테이블 그림보다 높으면, 테이블 윗면을 그 위에 맞춘다
    s = Math.max(width / SC.width, (height - contentH) / SC.tableTop);
    counterH = Math.max(contentH, below * s);
  }
  const tableY = height - counterH;
  return {
    s, width, height, tableY, counterH,
    sceneLeft: (width - SC.width * s) / 2,
    sceneTop: tableY - SC.tableTop * s,
    narrow: width < NARROW_PX,
  };
}

/** 장면 상자와 (있다면) 카운터 내용 상자의 크기를 재서 배치를 계산한다 */
export function useSceneLayout(box: RefObject<HTMLElement | null>, content?: RefObject<HTMLElement | null>): SceneLayout {
  const [layout, setLayout] = useState<SceneLayout>(() =>
    computeLayout(typeof window !== "undefined" ? window.innerWidth : 1180, typeof window !== "undefined" ? window.innerHeight - 64 : 756, 0),
  );
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const c = content?.current;
      const next = computeLayout(el.clientWidth, el.clientHeight, c ? c.scrollHeight : 0);
      setLayout((prev) =>
        Math.abs(prev.s - next.s) < 0.0005 && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5 && Math.abs(prev.counterH - next.counterH) < 0.5
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (content?.current) ro.observe(content.current);
    return () => ro.disconnect();
  }, [box, content]);
  return layout;
}

/** 손님이 서는 가로 위치(캔버스 x) */
export function standX(layout: SceneLayout): number {
  return SC.width / 2 + (layout.narrow ? 0 : SC.standX);
}
/** 아치 위쪽 곡선과 겹치지 않도록 귀 끝이 내려와 있어야 하는 캔버스 y */
const ARCH_SAFE_TOP = 60;

/**
 * 손님 크기(원본 1px당 캔버스 px). 기본은 외형별 설정값이고,
 * 귀 끝이 화면 위쪽(잘린 부분)·아치 곡선·위에 놓인 대사창(reserveTop px)에 걸리면 그만큼만 줄인다.
 * 기준선(cutY = 카운터 윗면)은 그대로라 서 있는 자리는 변하지 않는다.
 */
export function npcScale(app: Appearance, layout: SceneLayout, reserveTop = 0): number {
  const base = app.display.scale * (layout.narrow ? 0.84 : 1);
  const visibleTop = Math.max(ARCH_SAFE_TOP, (-layout.sceneTop + reserveTop + 10) / layout.s);
  const fit = (COUNTER_SCENE_TABLE - visibleTop) / (app.display.cutY - app.display.top);
  return Math.max(0.2, Math.min(base, fit));
}
const COUNTER_SCENE_TABLE = SC.tableTop;

/** 손님 그림의 캔버스 위 상자 (그림 전체, 투명 여백 포함) */
export function npcBox(app: Appearance, layout: SceneLayout, reserveTop = 0) {
  const k = npcScale(app, layout, reserveTop);
  return {
    left: standX(layout) - app.display.centerX * k,
    top: SC.tableTop - app.display.cutY * k,
    width: app.display.width * k,
    height: app.display.height * k,
    k,
  };
}

export function ShopScene({ layout, shutterMode, children }: { layout: SceneLayout; shutterMode: ShutterMode; children?: ReactNode }) {
  const { s } = layout;
  const o = SC.opening;
  return (
    <div
      className="shop-scene"
      aria-hidden="true"
      data-testid="shop-scene"
      style={{ left: layout.sceneLeft, top: layout.sceneTop, width: SC.width * s, height: SC.height * s }}
    >
      <div className="shop-scene-canvas" style={{ width: SC.width, height: SC.height, transform: `scale(${s})` }}>
        <img className="scene-layer scene-village" src={assetUrl(SC.village)} alt="" draggable={false} />
        <div className="scene-npcs">{children}</div>
        <div className="scene-opening" style={{ left: o.x, top: o.y, width: o.width, height: o.height }}>
          <Shutters mode={shutterMode} />
        </div>
        <img className="scene-layer scene-arch" src={assetUrl(SC.arch)} alt="" draggable={false} data-testid="scene-arch" />
        <img className="scene-layer scene-table" src={assetUrl(SC.table)} alt="" draggable={false} />
      </div>
    </div>
  );
}

/**
 * 장면 안의 손님 한 명. PNG 한 장 전체를 쓴다(자르거나 덧그리지 않음).
 * 그림을 못 읽으면 기존 코드 그림으로 바꾼다.
 */
export function SceneNpc({
  app, species, layout, mood, className = "", react = "", label, testId, onError, reserveTop = 0,
}: {
  app: Appearance; species: Species; layout: SceneLayout; mood: Mood; className?: string; react?: string; label: string; testId?: string; onError?: () => void; reserveTop?: number;
}) {
  const [broken, setBroken] = useState(false);
  const b = npcBox(app, layout, reserveTop);
  return (
    <div
      className={`npc ${className}`}
      style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
      data-testid={testId}
      data-mood={mood}
      data-appearance={app.id}
    >
      {/* 반응 연출(깡충·끄덕)은 안쪽에만: 바깥(등장·퇴장)과 따로 */}
      <div className={`npc-body ${react}`}>
        {broken ? (
          <div className="npc-fallback" style={{ top: (app.display.cutY - 700) * b.k }}>
            <AnimalArt species={species} mood={mood} label={label} />
          </div>
        ) : (
          <img
            className="npc-img"
            src={assetUrl(app.image)}
            alt={label}
            draggable={false}
            data-testid={testId ? `${testId}-img` : undefined}
            onError={() => {
              setBroken(true);
              onError?.();
            }}
          />
        )}
      </div>
    </div>
  );
}
