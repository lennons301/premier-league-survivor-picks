-- Mark gameweek 10 as finished since all its fixtures are complete
-- This will trigger the update_game_gameweeks_on_global_change function
-- which will automatically finish gameweek 10 and open gameweek 11 for all games

UPDATE gameweeks 
SET 
  finished = true,
  is_current = false,
  is_previous = true
WHERE gameweek_number = 10;

-- Mark gameweek 11 as current
UPDATE gameweeks 
SET 
  is_current = true,
  is_next = false
WHERE gameweek_number = 11;

-- Mark gameweek 12 as next
UPDATE gameweeks 
SET 
  is_next = true
WHERE gameweek_number = 12;