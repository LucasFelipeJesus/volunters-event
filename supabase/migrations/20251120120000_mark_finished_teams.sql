-- Migration: mark teams as 'finished' when their event is completed
-- Created: 2025-11-20

BEGIN;

-- Update teams that are still 'complete' but the event is already 'completed'
UPDATE teams
SET status = 'finished', updated_at = NOW()
FROM events
WHERE teams.event_id = events.id
  AND events.status = 'completed'
  AND teams.status = 'complete';

-- Optional: report how many rows were affected (clients may ignore NOTICE)
-- Not all migration runners show NOTICE; run the SELECT below after applying to verify.

COMMIT;

-- Verification queries (run manually after migration):
-- SELECT COUNT(*) FROM teams t JOIN events e ON t.event_id = e.id WHERE e.status = 'completed' AND t.status = 'finished';
-- SELECT id, name, status, event_id FROM teams WHERE status = 'finished' ORDER BY updated_at DESC LIMIT 200;
