import { levelFor } from "./curve";
import type { ProgressStore } from "./ports";
import type { MatchId, MatchReport, PlayerId, PlayerMatchStats, PlayerProgress, SettleOutcome } from "./types";
import { computeMatchXp } from "./xp";

/**
 * What a gain of `gain` XP does to `p`. Pure: no I/O, easy to test.
 *
 * Why the level never goes down: if designers later make the curve
 * steeper, levelFor(totalXp) could drop below a level the player already
 * earned. Taking the max keeps every level ever reached.
 */
export function applyGain(p: PlayerProgress, gain: number): { next: PlayerProgress; levelUps: number[] } {
  const totalXp = p.totalXp + gain;
  const level = Math.max(p.level, levelFor(totalXp));
  const levelUps: number[] = [];
  for (let l = p.level + 1; l <= level; l++) levelUps.push(l);
  return { next: { ...p, totalXp, level, version: p.version + 1 }, levelUps };
}

/**
 * Settle one player's result from one match.
 *
 * Read, compute, then commit only if nobody changed the player meanwhile
 * (the version check in ProgressStore.commit). On a conflict, read again.
 * A retried report comes back as "duplicate" and changes nothing.
 */
export async function settlePlayer(store: ProgressStore, matchId: MatchId, stats: PlayerMatchStats): Promise<SettleOutcome> {
  const gain = computeMatchXp(stats);

  for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt++) {
    const before = (await store.get(stats.playerId)) ?? newPlayer(stats.playerId);
    const { next: after, levelUps } = applyGain(before, gain);

    const result = await store.commit({ matchId, gain, before, after, levelUps });
    if (result === "duplicate") return { kind: "duplicate" };
    if (result === "ok") return { kind: "applied", gain, before, after, levelUps };
    // "conflict": another write landed between our read and our commit.
  }
  throw new Error(`too many conflicts settling ${stats.playerId} in ${matchId}`);
}

/**
 * Settle a whole match report: up to 100 players.
 *
 * Players are independent, so they are settled in parallel, and one
 * player's failure does not block the others. Failed players are returned
 * so the DS (or a retry job) can send the same report again: players who
 * already succeeded come back as duplicates and are not paid twice.
 */
export async function settleMatch(
  store: ProgressStore,
  report: MatchReport,
): Promise<{ applied: number; duplicates: number; failed: PlayerId[] }> {
  // A player listed twice in one report (a DS bug) is settled once.
  const unique = new Map(report.players.map((p) => [p.playerId, p]));

  const results = await Promise.allSettled(
    [...unique.values()].map((p) => settlePlayer(store, report.matchId, p)),
  );

  let applied = 0;
  let duplicates = 0;
  const failed: PlayerId[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") failed.push([...unique.keys()][i]);
    else if (r.value.kind === "applied") applied++;
    else duplicates++;
  });
  return { applied, duplicates, failed };
}

const newPlayer = (playerId: PlayerId): PlayerProgress => ({ playerId, totalXp: 0, level: 1, version: 0 });

const MAX_CONFLICT_RETRIES = 5;
