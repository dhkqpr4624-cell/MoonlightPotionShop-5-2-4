/**
 * 소리 설정. 게임 저장(moonlight-potion-shop/save)과 따로 저장하므로 게임 저장 버전과 무관하다.
 * 값이 없거나 망가졌으면 안전한 기본값(켜짐, 음량 60%)을 쓴다.
 */
export const SETTINGS_KEY = "moonlight-potion-shop/settings";

export interface SoundSettings {
  enabled: boolean;
  /** 0 ~ 1 */
  volume: number;
}

export const DEFAULT_SOUND: SoundSettings = { enabled: true, volume: 0.6 };

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function normalizeSoundSettings(data: unknown): SoundSettings {
  if (typeof data !== "object" || data === null) return { ...DEFAULT_SOUND };
  const d = data as Record<string, unknown>;
  const enabled = typeof d.enabled === "boolean" ? d.enabled : DEFAULT_SOUND.enabled;
  const v = typeof d.volume === "number" && Number.isFinite(d.volume) ? Math.max(0, Math.min(1, d.volume)) : DEFAULT_SOUND.volume;
  return { enabled, volume: Math.round(v * 100) / 100 };
}

export function loadSoundSettings(s: StorageLike | null = storage()): SoundSettings {
  try {
    const raw = s?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SOUND };
    const parsed = JSON.parse(raw) as { sound?: unknown };
    return normalizeSoundSettings(parsed?.sound);
  } catch {
    return { ...DEFAULT_SOUND };
  }
}

export function saveSoundSettings(next: SoundSettings, s: StorageLike | null = storage()): boolean {
  try {
    s?.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, sound: normalizeSoundSettings(next) }));
    return true;
  } catch {
    return false;
  }
}
