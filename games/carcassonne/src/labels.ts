import { m } from '@board-games/shared/messages';
import type { Locale } from '@board-games/shared/runtime';
export function label(key: string, locale: Locale = 'en'): string {
  const fn = (
    m as unknown as Record<
      string,
      (args: Record<string, never>, options: { locale: Locale }) => string
    >
  )['carc_' + key];
  return fn ? fn({}, { locale }) : key;
}
