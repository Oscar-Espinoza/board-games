import { message } from '@board-games/shared/ui';
import type { Locale } from '@board-games/shared/runtime';
/** The `carc_` message for a key built at runtime; an unknown key shows as itself. */
export const label = (key: string, locale: Locale = 'en') =>
  message(`carc_${key}`, {}, locale) ?? key;
