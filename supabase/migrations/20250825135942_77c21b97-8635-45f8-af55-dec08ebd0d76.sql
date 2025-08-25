-- Create function to eliminate players with non-winning results after first gameweek
CREATE OR REPLACE FUNCTION public.eliminate_non_winners_after_first_gameweek()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  pick_record RECORD;
BEGIN
  -- Find all picks with non-winning results (loss or draw) after the starting gameweek
  FOR pick_record IN
    SELECT 
      p.user_id,
      p.game_id,
      p.gameweek,
      p.result
    FROM public.picks p
    JOIN public.games g ON p.game_id = g.id
    JOIN public.game_players gp ON p.game_id = gp.game_id AND p.user_id = gp.user_id
    WHERE g.status = 'active'
      AND p.result IN ('loss', 'draw')
      AND p.gameweek > g.starting_gameweek
      AND gp.is_eliminated = false
  LOOP
    -- Eliminate the player
    UPDATE public.game_players
    SET is_eliminated = true,
        eliminated_gameweek = pick_record.gameweek
    WHERE game_id = pick_record.game_id
      AND user_id = pick_record.user_id
      AND is_eliminated = false;
  END LOOP;
END;
$$;

-- Run the function to eliminate players with draws in gameweek 2
SELECT public.eliminate_non_winners_after_first_gameweek();