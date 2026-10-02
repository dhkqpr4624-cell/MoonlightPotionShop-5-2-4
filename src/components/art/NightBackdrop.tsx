/**
 * 창구 배경. 그림은 public/assets/shop/counter-room.svg (교체 가능, 1000×560 비율).
 * 그 위에 반짝이는 별과 등불 빛만 가볍게 움직인다. 덧문(Shutters)과 같은 좌표계를 쓴다.
 */
import { SHOP_ART } from "../../data/shopArt.ts";
import { assetUrl } from "../../lib/assets.ts";

const STARS: [number, number, number][] = [
  [260, 130, 2.4], [480, 100, 2], [620, 160, 2.2], [330, 250, 1.8], [770, 300, 2], [540, 210, 1.6], [200, 190, 1.8],
];

export function NightBackdrop({ dim = false }: { dim?: boolean }) {
  return (
    <svg className="night-backdrop" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <image href={assetUrl(SHOP_ART.counterRoom)} x="0" y="0" width="1000" height="560" preserveAspectRatio="none" />
      <g className="sky-twinkles">
        {STARS.map(([x, y, r], i) => (
          <circle key={i} className="twinkle" style={{ animationDelay: `${(i % 4) * 0.7}s` }} cx={x} cy={y} r={r} fill="#fff7d6" />
        ))}
      </g>
      {[70, 930].map((x) => (
        <circle key={x} cx={x} cy={228} r={dim ? 80 : 100} fill="url(#lampGlow)" className="lamp-glow" />
      ))}
    </svg>
  );
}
