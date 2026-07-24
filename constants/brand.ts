// constants/brand.ts

export const YSI_LOGO = '/ysi-logo.png';

export function resolveLogoUrl(url: string | null | undefined): string {
  if (!url) return YSI_LOGO;

  // Force the new logo and ignore old AI Studio / external URLs
  if (
    url.includes('aistudio') ||
    url.includes('file-service') ||
    url.includes('google') ||
    !url.startsWith('/')
  ) {
    return YSI_LOGO;
  }

  return url;
}
