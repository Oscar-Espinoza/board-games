/** Rule numbers the rules and the table both read. No imports: the browser keeps it small. */
export const isExtended = (players: number) => players > 4;
/** Resource cards per kind in the bank; also the most one offer can name. */
export const bankSize = (extended: boolean) => (extended ? 24 : 19);
export const OFFER_LIMIT = bankSize(true);

const total = (a: number[]) => a.reduce((x, y) => x + y, 0);

export const quantities = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === 5 &&
  value.every((n) => Number.isInteger(n) && n >= 0 && n <= OFFER_LIMIT);

/** An offer a seat holding `hand` may make: distinct, non-empty on both sides. */
export function validOffer(hand: number[], give: unknown, take: unknown) {
  return (
    quantities(give) &&
    quantities(take) &&
    total(give) > 0 &&
    total(take) > 0 &&
    give.every((n, r) => !n || !take[r]) &&
    give.every((n, r) => n <= hand[r])
  );
}
