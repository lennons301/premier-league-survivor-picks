-- Function to get the winner of a game
CREATE OR REPLACE FUNCTION public.get_game_winner(p_game_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  winner_user_id uuid;
BEGIN
  -- Get the winner from the winner_id field first
  SELECT winner_id INTO winner_user_id
  FROM public.games
  WHERE id = p_game_id AND status = 'finished' AND winner_id IS NOT NULL;

  -- If no winner_id set, find the last remaining active player
  IF winner_user_id IS NULL THEN
    SELECT user_id INTO winner_user_id
    FROM public.game_players
    WHERE game_id = p_game_id 
      AND is_eliminated = false
    LIMIT 1;
  END IF;

  RETURN winner_user_id;
END;
$function$