/** localStorage that never throws: private windows and blocked storage fall back silently. */
export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function readJson(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(read(key) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
/** False when the browser refused to store the value. */
export function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
    return true;
  } catch {
    return false;
  }
}
