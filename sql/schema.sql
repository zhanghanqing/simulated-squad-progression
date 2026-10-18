-- Three tables are all XP/level settlement needs. MySQL syntax.
-- On InGame the same data lives in TcaplusDB; see README "Mapping to TcaplusDB".

-- Current progress, one row per player.
CREATE TABLE player_progress (
  player_id   VARCHAR(64)  PRIMARY KEY,
  total_xp    BIGINT       NOT NULL,     -- all XP ever earned; never reset
  level       SMALLINT     NOT NULL,     -- derived from total_xp, never decreases
  version     BIGINT       NOT NULL,     -- +1 per change; writes check it
  updated_at  DATETIME     NOT NULL
);

-- Every XP grant. The primary key is what makes a retried report harmless.
CREATE TABLE xp_ledger (
  player_id   VARCHAR(64)  NOT NULL,
  match_id    VARCHAR(64)  NOT NULL,
  gain        INT          NOT NULL,
  created_at  DATETIME     NOT NULL,
  PRIMARY KEY (player_id, match_id)      -- one grant per player per match
);

-- Level-ups waiting to be announced to the client and the platform.
-- Written in the same transaction as player_progress, sent by a relay job.
CREATE TABLE progress_outbox (
  id          BIGINT       PRIMARY KEY AUTO_INCREMENT,  -- also the eventId
  player_id   VARCHAR(64)  NOT NULL,
  level       SMALLINT     NOT NULL,
  match_id    VARCHAR(64)  NOT NULL,
  created_at  DATETIME     NOT NULL,
  sent_at     DATETIME     NULL,         -- NULL = not delivered yet
  KEY idx_unsent (sent_at, id)
);
