/** 소지금 표시: 음수는 수학 기호 마이너스(−)로 (예: −55) */
export function fmtMoney(n: number): string {
  return n < 0 ? `−${-n}` : `${n}`;
}
