-- Update the trigger function to also update games.current_gameweek when transitioning gameweeks
CREATE OR REPLACE FUNCTION public.update_game_gameweeks_on_global_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;