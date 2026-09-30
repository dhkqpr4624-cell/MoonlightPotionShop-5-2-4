import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * GitHub Pages는 https://<사용자>.github.io/<저장소이름>/ 처럼 하위 경로에서 열린다.
 * 배포 workflow가 저장소 이름으로 VITE_BASE_PATH="/<저장소이름>/" 를 넣어 준다.
 * 로컬 개발(npm run dev)에서는 값이 없으므로 "/" 를 사용한다.
 */
function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (value === "" || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE_PATH),
  plugins: [react()],
});
