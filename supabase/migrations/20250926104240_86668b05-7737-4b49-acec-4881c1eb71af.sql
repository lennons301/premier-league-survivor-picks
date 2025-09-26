-- Fix LPS 1 2025 stuck on gameweek 5
-- Update the game to current gameweek 6
UPDATE public.games 
SET current_gameweek = 6,
    updated_at = now()
WHERE name = 'LPS 1 2025' AND current_gameweek = 5;

-- Open gameweek 6 for LPS 1 2025
UPDATE public.game_gameweeks 
SET status = 'open',
    picks_visible = false,
    updated_at = now()
WHERE game_id = (SELECT id FROM public.games WHERE name = 'LPS 1 2025')
  AND gameweek_number = 6
  AND status = 'upcoming';