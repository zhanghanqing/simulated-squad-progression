import type {
  LevelUpEvent, MatchId, MatchReport, PlayerId, PlayerProgress, ProgressView,
} from "./types";

// ---------------------------------------------------------------------------
// Storage. In SQL terms: sql/schema.sql. On InGame: TcaplusDB (see README).
// ---------------------------------------------------------------------------

/** One settled match for one player, ready to be committed. */
export interface Commit {
  matchId: MatchId;
  gain: number;
  before: PlayerProgress;      // what we read
  after: PlayerProgress;       // what we want to write
  levelUps: number[];
}

/**
 * Not implemented in this demo. Each method lists the SQL it stands for.
 */
export interface ProgressStore {
  /** SELECT * FROM player_progress WHERE player_id = ?  (null if new) */
  get(playerId: PlayerId): Promise<PlayerProgress | null>;

  /**
   * Apply one match to one player, in ONE transaction:
   *
   *   BEGIN;
   *   INSERT INTO xp_ledger (player_id, match_id, gain) VALUES (...);
   *     -- primary key (player_id, match_id) exists → ROLLBACK, "duplicate"
   *   UPDATE player_progress SET total_xp = ?, level = ?, version = ?
   *    WHERE player_id = ? AND version = :before.version;
   *     -- (INSERT instead when before.version = 0)
   *     -- 0 rows → ROLLBACK, "conflict"
   *   INSERT INTO progress_outbox (...) one row per level in levelUps;
   *   COMMIT;
   *
   * "duplicate": this match was already applied to this player. The DS
   *   retried its report; nothing changes.
   * "conflict": someone changed the player between our read and this
   *   write. Nothing changes; the caller reads again and retries.
   *
   * Why the ledger insert comes first: a retried report must be recognized
   * as a duplicate even when it also races with another write.
   * Why the outbox is in the same transaction: a level-up is announced if
   * and only if it was saved.
   */
  commit(c: Commit): Promise<"ok" | "duplicate" | "conflict">;
}

// ---------------------------------------------------------------------------
// Getting level-ups out: to the player's client and to the platform.
// ---------------------------------------------------------------------------

/**
 * Background job: reads unsent rows from progress_outbox, hands each to
 * ClientNotifier and PlatformEventSink, then marks it sent.
 *
 * Delivery is at-least-once: a crash after sending but before marking sent
 * sends again. Consumers de-duplicate on eventId.
 *
 * Not implemented in this demo.
 */
export interface OutboxRelay {
  runOnce(batchSize: number): Promise<number>;
}

/**
 * Push "you reached level N" to the player's client if they are online.
 * Offline players see it next time they call getMyProgress.
 * On InGame: the platform's push channel (assumption, see README).
 */
export interface ClientNotifier {
  levelUp(e: LevelUpEvent): Promise<void>;
}

/**
 * Tell other platform services about a level-up, for example a season
 * pass or the statistics service (both appear on InGame's public roadmap;
 * whether they accept such events is an assumption).
 */
export interface PlatformEventSink {
  publish(e: LevelUpEvent): Promise<void>;
}

// ---------------------------------------------------------------------------
// RPC surface of the progression service.
// ---------------------------------------------------------------------------

/**
 * Called by the dedicated server when a match ends.
 * Only DS identities may call it: a game client calling it could award
 * itself XP. Safe to retry with the same report.
 */
export interface MatchResultRpc {
  reportMatchResult(report: MatchReport): Promise<{ applied: number; duplicates: number; failed: PlayerId[] }>;
}

/**
 * Called by the game client (frontend) for its progress bar.
 * The player comes from the caller's session, never from a parameter: a
 * client cannot ask for, or pretend to be, another player.
 */
export interface ProgressRpc {
  getMyProgress(sessionPlayerId: PlayerId): Promise<ProgressView>;
}
