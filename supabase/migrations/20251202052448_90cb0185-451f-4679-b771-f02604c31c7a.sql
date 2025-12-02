-- Move from gameweek 13 to gameweek 14
-- Update global gameweeks table
UPDATE gameweeks 
SET is_current = false, is_previous = true
WHERE gameweek_number = 13;

UPDATE gameweeks 
SET is_current = true, is_next = false
WHERE gameweek_number = 14;

-- Mark the next gameweek (15) as is_next
UPDATE gameweeks 
SET is_next = true
WHERE gameweek_number = 15;

-- Update game_gameweeks for all games to open gameweek 14
UPDATE game_gameweeks 
SET 
  status = 'open',
  picks_visible = false,
  updated_at = now()
WHERE gameweek_number = 14
  AND status = 'upcoming'
  AND EXISTS (
    SELECT 1 FROM games 
    WHERE games.id = game_gameweeks.game_id 
    AND games.status = 'active'
  );

-- Update games current_gameweek
UPDATE games 
SET current_gameweek = 14,
    updated_at = now()
WHERE status = 'active';