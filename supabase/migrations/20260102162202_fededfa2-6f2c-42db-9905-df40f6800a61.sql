
-- Fix LPS 3 2025: Eliminate all players who got draw in GW19
UPDATE public.game_players
SET is_eliminated = true, eliminated_gameweek = 19
WHERE game_id = '15597efe-565a-44ce-8c6a-1644a22aa2bd'
  AND is_eliminated = false;

-- Finish the game with VinnieS as winner (highest goals: 9)
UPDATE public.games 
SET status = 'finished', 
    winner_id = 'd2e42f66-1bbe-4e39-8adc-be1f9f0400db'
WHERE id = '15597efe-565a-44ce-8c6a-1644a22aa2bd';

-- Insert winner record
INSERT INTO public.game_winners (game_id, user_id, payout_amount, is_split)
VALUES (
  '15597efe-565a-44ce-8c6a-1644a22aa2bd', 
  'd2e42f66-1bbe-4e39-8adc-be1f9f0400db',
  (SELECT public.calculate_prize_pot('15597efe-565a-44ce-8c6a-1644a22aa2bd')),
  false
);

-- Mark open/active gameweeks as finished
UPDATE public.game_gameweeks
SET status = 'finished', picks_visible = true
WHERE game_id = '15597efe-565a-44ce-8c6a-1644a22aa2bd'
  AND status IN ('open', 'active');
