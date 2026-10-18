import type { PlayerMatchStats } from "./types";

/**
 * How much each fact in a match is worth.
 *
 * Why teamwork weighs more than kills: in a Squad-like game, matches are
 * won by squads working together, not by individual frag counts. A medic
 * who revives 10 players (500 XP) out-earns a rifleman with 10 kills
 * (200 XP). These numbers are invented for this simulation.
 *
 * Why caps: `maxMinutes` stops AFK-farming in endless matches, and
 * `maxPerMatch` limits the damage of any bug or exploit in one match.
 */
export const XP_RULES = {
  perMinute: 10,
  maxMinutes: 90,
  completionBonus: 200,        // stayed to the end: discourages leaving
  kill: 20,
  revive: 50,
  supplyDelivered: 30,
  fortificationBuilt: 25,
  teamKill: -100,
  maxPerMatch: 5000,
} as const;

/**
 * XP one player earns from one match. Never negative, never above the cap.
 *
 * Every input is sanitized first: the DS is trusted, but a bug there must
 * not turn into negative or absurd XP here.
 */
export function computeMatchXp(s: PlayerMatchStats): number {
  const r = XP_RULES;
  const raw =
    Math.min(count(s.minutesPlayed), r.maxMinutes) * r.perMinute +
    (s.completed ? r.completionBonus : 0) +
    count(s.kills) * r.kill +
    count(s.revives) * r.revive +
    count(s.suppliesDelivered) * r.supplyDelivered +
    count(s.fortificationsBuilt) * r.fortificationBuilt +
    count(s.teamKills) * r.teamKill;
  return Math.min(Math.max(raw, 0), r.maxPerMatch);
}

/** A non-negative whole number, or 0 for anything else (NaN, -3, 2.7 → 2). */
const count = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
