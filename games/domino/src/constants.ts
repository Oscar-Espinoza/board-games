import { games } from '@board-games/shared/games';

/** Four seats; partners sit opposite (seat `s` is on team `s % 2`). */
export const SEATS = games.domino.maxPlayers;
export const SEAT_INDEXES = Array.from({ length: SEATS }, (_, seat) => seat);
export const HAND_SIZE = 7;
export const MAX_TEAM_NAME = 16;
/** A strike above this force slams: it shoves nearby tiles and shakes the table. */
export const HARD_SLAM = 0.55;
/** Holding an end ghost this long charges a strike to full force. */
export const CHARGE_MS = 1100;
/** Milliseconds a played tile flies, by force (0–1): the 3D patio and the 8-bit table. */
export const flightMs3d = (force: number) => 380 - force * 140;
export const flightMsPixel = (force: number) => 320 - force * 140;
/** The 3D table shakes this long after a slam is accepted, near the tile landing. */
export const SLAM_SHAKE_MS = 260;
/** Phones: portrait up to 720px wide, or landscape up to 520px tall. */
export const COMPACT = '(max-width: 720px), (max-height: 520px)';
