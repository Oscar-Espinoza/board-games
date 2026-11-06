import { m } from '../paraglide/messages.js';
import type { Locale } from '../paraglide/runtime.js';

type Message = (
  inputs?: Record<string, unknown>,
  options?: { locale?: Locale },
) => string;
const byKey = m as unknown as Record<string, Message | undefined>;

/** A message chosen at runtime; undefined when no message has that key. */
export function message(
  key: string,
  inputs: Record<string, unknown> = {},
  locale?: Locale,
): string | undefined {
  const fn = byKey[key];
  return typeof fn === 'function'
    ? fn(inputs, locale ? { locale } : undefined)
    : undefined;
}

/** Rules reject with a message key; other text (transport, legacy rules) shows as is. */
export const errorText = (error: string, locale?: Locale) =>
  message(error, {}, locale) ?? error;
