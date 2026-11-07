/**
 * 작은 화면을 세로로 들었을 때: 가로 장면이 작아지므로 가로로 돌려 쓰기를 권하는 안내 (닫을 수 있음).
 * 가로 전환을 강제하거나 세로 플레이를 막지 않는다. 닫으면 이 탭에서는 다시 띄우지 않는다.
 */
import { useEffect, useState } from "react";
import { Icon } from "./Icon.tsx";

const KEY = "moonlight-potion-shop/portrait-tip-closed";

function isSmallPortrait(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerHeight > window.innerWidth && window.innerWidth < 700;
}

export function PortraitNotice() {
  const [closed, setClosed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const [portrait, setPortrait] = useState(isSmallPortrait);
  useEffect(() => {
    const on = () => setPortrait(isSmallPortrait());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  if (closed || !portrait) return null;
  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* 저장할 수 없어도 이번 화면에서는 닫힌다 */
    }
  };
  return (
    <div className="portrait-tip" role="status" data-testid="portrait-tip">
      <p>화면을 <strong>가로로</strong> 돌리면 가게가 더 크게 보여요. 세로로도 그대로 할 수 있어요.</p>
      <button type="button" className="btn btn-light portrait-tip-close" onClick={close} data-testid="portrait-tip-close" aria-label="안내 닫기">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
