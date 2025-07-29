-- Fix the calculate_prize_pot function to correctly identify rebuys
CREATE OR REPLACE FUNCTION public.calculate_prize_pot(p_game_id uuid)
RETURNS decimal(10,2)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  entry_fee_amount decimal(10,2);
  initial_players integer;
  rebuy_count integer;
  game_starting_gameweek integer;
BEGIN
  -- Get entry fee and starting gameweek for the game
  SELECT entry_fee, starting_gameweek
  INTO entry_fee_amount, game_starting_gameweek
  FROM public.games
  WHERE id = p_game_id;

  -- Count initial players
  SELECT COUNT(*)
  INTO initial_players
  FROM public.game_players
  WHERE game_id = p_game_id;

  -- Count rebuys: players who had non-winning pick in starting gameweek 
  -- AND made a pick in the next gameweek
  SELECT COUNT(*)
  INTO rebuy_count
  FROM public.picks p1
  WHERE p1.game_id = p_game_id
    AND p1.gameweek = game_starting_gameweek
    AND p1.result IN ('loss', 'draw')  -- Non-winning pick in first gameweek
    AND EXISTS (
      SELECT 1 FROM public.picks p2
      WHERE p2.game_id = p_game_id
        AND p2.user_id = p1.user_id
        AND p2.gameweek = game_starting_gameweek + 1  -- Made any pick in next gameweek
    );

  RETURN (initial_players + rebuy_count) * entry_fee_amount;
END;
$function$