-- Migration: mark teams as 'finished' when the event date has passed
-- Created: 2025-11-20

BEGIN;

-- Set teams to 'finished' when their event_date is in the past and event is not deleted
UPDATE teams
SET status = 'finished', updated_at = NOW()
FROM events
WHERE teams.event_id = events.id
  AND events.event_date < NOW()::date
  AND teams.status != 'finished';

COMMIT;

-- Verification (run manually after applying):
-- SELECT COUNT(*) FROM teams t JOIN events e ON t.event_id = e.id WHERE e.event_date < NOW()::date AND t.status = 'finished';

-- NOTE: This migration is a one-time data-fix. For ongoing enforcement, schedule this
-- query to run daily using pg_cron or an external scheduler (e.g. GitHub Actions, server cron).
