-- Set gameweek 11 back to 'open' status with picks not visible
-- This is the correct state until the deadline passes
UPDATE game_gameweeks 
SET 
  status = 'open',
  picks_visible = false,
  updated_at = now()
WHERE gameweek_number = 11
  AND status = 'active';