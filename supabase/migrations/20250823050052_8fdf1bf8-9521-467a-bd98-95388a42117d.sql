-- Add elimination logic for players who failed to rebuy after first gameweek loss
CREATE OR REPLACE FUNCTION public.eliminate_players_who_failed_to_rebuy(p_gameweek_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  game_record RECORD;
  player_record RECORD;
BEGIN
  -- Check each active game
  FOR game_record IN
    SELECT g.id, g.starting_gameweek
    FROM public.games g
    WHERE g.status = 'active'
  LOOP
    -- Only process if this gameweek is the one after the starting gameweek
    IF p_gameweek_number = game_record.starting_gameweek + 1 THEN
      -- Find players who had losing picks in the starting gameweek
      -- but did not make a pick in this gameweek (failed to rebuy)
      FOR player_record IN
        SELECT DISTINCT p1.user_id
        FROM public.picks p1
        WHERE p1.game_id = game_record.id
          AND p1.gameweek = game_record.starting_gameweek
          AND p1.result IN ('loss', 'draw')  -- Non-winning pick in starting gameweek
          AND NOT EXISTS (
            -- No pick made in the current gameweek (failed to rebuy)
            SELECT 1 FROM public.picks p2
            WHERE p2.game_id = game_record.id
              AND p2.user_id = p1.user_id
              AND p2.gameweek = p_gameweek_number
          )
      LOOP
        -- Eliminate the player who failed to rebuy
        UPDATE public.game_players
        SET is_eliminated = true,
            eliminated_gameweek = p_gameweek_number
        WHERE game_id = game_record.id
          AND user_id = player_record.user_id
          AND is_eliminated = false;  -- Only eliminate if not already eliminated
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Update the existing trigger function to include elimination logic
CREATE OR REPLACE FUNCTION public.update_game_gameweeks_on_global_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  next_gameweek_num integer;
BEGIN
  -- When a gameweek becomes finished, close it and open the next gameweek
  IF NEW.finished = true AND (OLD.finished IS NULL OR OLD.finished = false) THEN
    -- Finish the current gameweek for all games
    UPDATE public.game_gameweeks 
    SET status = 'finished',
        picks_visible = true,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number;
    
    -- Get the next gameweek number
    SELECT gameweek_number INTO next_gameweek_num
    FROM public.gameweeks 
    WHERE is_next = true 
    LIMIT 1;
    
    -- Update games current_gameweek to the next gameweek
    UPDATE public.games 
    SET current_gameweek = next_gameweek_num,
        updated_at = now()
    WHERE status = 'active' AND next_gameweek_num IS NOT NULL;
    
    -- Open the next gameweek for all active games
    UPDATE public.game_gameweeks 
    SET status = 'open',
        picks_visible = false,
        updated_at = now()
    WHERE gameweek_number = next_gameweek_num
    AND EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = game_gameweeks.game_id 
      AND games.status = 'active'
    )
    AND next_gameweek_num IS NOT NULL;
  END IF;

  -- When a gameweek becomes current (is_current = true), activate it
  IF NEW.is_current = true AND (OLD.is_current IS NULL OR OLD.is_current = false) THEN
    -- FIRST: Eliminate players who failed to rebuy before activating the gameweek
    PERFORM public.eliminate_players_who_failed_to_rebuy(NEW.gameweek_number);
    
    -- THEN: Activate the gameweek (this locks picks)
    UPDATE public.game_gameweeks 
    SET status = 'active',
        picks_visible = true,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number
      AND status = 'open'
      AND EXISTS (
        SELECT 1 FROM public.games 
        WHERE games.id = game_gameweeks.game_id 
        AND games.status = 'active'
      );
  END IF;

  RETURN NEW;
END;
$$;