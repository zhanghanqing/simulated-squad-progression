import type { PlayerProgress, ProgressView } from "./types";

export const MAX_LEVEL = 100;

/**
 * XP needed to go from `level` to `level + 1`.
 * Level 1 → 2 takes 1000; each level after takes 150 more.
 *
 * Why a slowly rising cost: early levels come fast so new players feel
 * progress in their first matches; later levels mark real time served.
 */
export function xpToNext(level: number): number {
  return 1000 + 150 * (level - 1);
}

/**
 * LEVEL_FLOOR[L] = total XP needed to reach level L.
 * LEVEL_FLOOR[1] = 0, LEVEL_FLOOR[2] = 1000, LEVEL_FLOOR[3] = 2150, ...
 * Index 0 is unused so that the index equals the level.
 *
 * Why a precomputed table: the game reads it on every settlement and every
 * progress-bar request; designers can also replace it with hand-tuned
 * numbers without touching any other code.
 */
export const LEVEL_FLOOR: readonly number[] = (() => {
  const floor = [0, 0];
  for (let level = 1; level < MAX_LEVEL; level++) {
    floor.push(floor[level] + xpToNext(level));
  }
  return floor;
})();

/**
 * The level a player with `totalXp` has reached.
 * Binary search for the highest level whose floor is <= totalXp.
 */
export function levelFor(totalXp: number): number {
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (LEVEL_FLOOR[mid] <= totalXp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Turn stored progress into what the client's progress bar shows.
 *
 * `xpIntoLevel` is never negative: a player kept at a level after the
 * curve was made steeper (see applyGain) simply shows an empty bar.
 */
export function viewOf(p: PlayerProgress): ProgressView {
  if (p.level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL, maxLevel: MAX_LEVEL, totalXp: p.totalXp,
      xpIntoLevel: p.totalXp - LEVEL_FLOOR[MAX_LEVEL], xpForThisLevel: null,
    };
  }
  return {
    level: p.level,
    maxLevel: MAX_LEVEL,
    totalXp: p.totalXp,
    xpIntoLevel: Math.max(0, p.totalXp - LEVEL_FLOOR[p.level]),
    xpForThisLevel: xpToNext(p.level),
  };
}
