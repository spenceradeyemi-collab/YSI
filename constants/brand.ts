/** Official YSI brand assets & defaults */
export const YSI_LOGO = '/ysi-logo.png';

const LEGACY_LOGO_MARKERS = [
  'aistudio.google.com',
  'file-service.aistudio',
  '978h4g5j2k3l',
];

/** Prefer the new logo; ignore stale AI Studio URLs in localStorage. */
export function resolveLogoUrl(stored?: string | null): string {
  if (!stored || !stored.trim()) return YSI_LOGO;
  if (LEGACY_LOGO_MARKERS.some((m) => stored.includes(m))) return YSI_LOGO;
  return stored;
}
