/** Our player id (from the platform's verified login). */
export type PlayerId = string;

/** Unique id of one finished match, chosen by the dedicated server. */
export type MatchId = string;

/**
 * What the dedicated server (DS) reports for one player when a match ends.
 * Raw facts only, never XP: the XP rules live on the backend so they can be
 * tuned without shipping a new DS build.
 */
export interface PlayerMatchStats {
  playerId: PlayerId;
  minutesPlayed: number;
  completed: boolean;          // still in the match when it ended
  kills: number;
  revives: number;
  suppliesDelivered: number;
  fortificationsBuilt: number;
  teamKills: number;
}

/** One report per match: up to 100 players in a 50v50 match. */
export interface MatchReport {
  matchId: MatchId;
  endedAt: number;             // ms since epoch
  players: PlayerMatchStats[];
}

/**
 * One player's stored progress.
 *
 * Why store total XP and not "XP inside the current level": the total
 * never needs converting when the level curve is rebalanced. The level is
 * derived from it (and kept so it never goes down; see applyGain).
 */
export interface PlayerProgress {
  playerId: PlayerId;
  totalXp: number;
  level: number;
  version: number;             // bumps on every change; 0 = not stored yet
}

/** Everything one settled match changes for one player. */
export interface SettleOutcome {
  kind: "applied" | "duplicate";
  gain?: number;
  before?: PlayerProgress;
  after?: PlayerProgress;
  levelUps?: number[];         // every level reached, e.g. [7, 8]
}

/** What the client's progress bar needs. */
export interface ProgressView {
  level: number;
  maxLevel: number;
  totalXp: number;
  xpIntoLevel: number;         // how far into the current level
  xpForThisLevel: number | null; // size of the current level; null at max
}

/** A level-up, queued for the client and the platform. */
export interface LevelUpEvent {
  eventId: string;             // unique; consumers de-duplicate on it
  playerId: PlayerId;
  level: number;
  matchId: MatchId;
}
