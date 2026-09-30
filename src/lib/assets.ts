/**
 * public/ 폴더의 정적 파일 주소. GitHub Pages 하위 경로(/저장소이름/)에서도 맞게
 * Vite의 BASE_URL을 앞에 붙인다. 이미지·효과음은 반드시 이 함수로 경로를 만든다.
 *   assetUrl("assets/ui/logo.svg") → "/Moonlight-Potion-Shop/assets/ui/logo.svg"
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : base + "/"}${path.replace(/^\/+/, "")}`;
}
