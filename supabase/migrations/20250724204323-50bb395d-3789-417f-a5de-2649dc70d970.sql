-- Reset current games to 'open' status so we can test the new behavior
UPDATE public.game_gameweeks 
SET status = 'open', 
    picks_visible = false,
    updated_at = now()
WHERE status = 'active' 
  AND gameweek_number = 1;