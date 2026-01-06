-- Update initialize_game_gameweeks to handle Turbo (single gameweek) and Cup (no gameweeks) modes
CREATE OR REPLACE FUNCTION public.initialize_game_gameweeks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  gw_record RECORD;
  next_gameweek_num integer;
BEGIN
  -- Cup games don't use gameweeks at all - skip initialization
  IF NEW.game_mode = 'cup' THEN
    RETURN NEW;
  END IF;

  -- Get the starting gameweek (use the game's starting_gameweek if set)
  next_gameweek_num := NEW.starting_gameweek;
  
  -- If no starting gameweek set, get the next gameweek
  IF next_gameweek_num IS NULL THEN
    SELECT gameweek_number INTO next_gameweek_num
    FROM public.gameweeks
    WHERE is_next = true
    LIMIT 1;

    -- If no next gameweek found, use current + 1
    IF next_gameweek_num IS NULL THEN
      SELECT COALESCE(MAX(gameweek_number), 0) + 1 INTO next_gameweek_num
      FROM public.gameweeks;
    END IF;
  END IF;

  -- For Turbo games, only create the single starting gameweek
  IF NEW.game_mode = 'turbo' THEN
    SELECT id, gameweek_number INTO gw_record
    FROM public.gameweeks 
    WHERE gameweek_number = next_gameweek_num
    LIMIT 1;
    
    IF gw_record.id IS NOT NULL THEN
      INSERT INTO public.game_gameweeks (
        game_id, 
        gameweek_id, 
        gameweek_number,
        status,
        picks_visible
      ) VALUES (
        NEW.id,
        gw_record.id,
        gw_record.gameweek_number,
        'open',
        false
      );
    END IF;
    
    RETURN NEW;
  END IF;

  -- For Classic/Escalating games, create game_gameweek records for all future gameweeks
  FOR gw_record IN 
    SELECT id, gameweek_number
    FROM public.gameweeks 
    WHERE gameweek_number >= next_gameweek_num
    ORDER BY gameweek_number
  LOOP
    INSERT INTO public.game_gameweeks (
      game_id, 
      gameweek_id, 
      gameweek_number,
      status,
      picks_visible
    ) VALUES (
      NEW.id,
      gw_record.id,
      gw_record.gameweek_number,
      CASE 
        WHEN gw_record.gameweek_number = next_gameweek_num THEN 'open'
        ELSE 'upcoming'
      END,
      false
    );
  END LOOP;

  -- Update the game's current_gameweek
  UPDATE public.games 
  SET current_gameweek = next_gameweek_num
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- Update the global gameweek change handler to skip Turbo and Cup games
CREATE OR REPLACE FUNCTION public.update_game_gameweeks_on_global_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  next_gameweek_num integer;
BEGIN
  -- When a gameweek becomes finished, close it and open the next gameweek
  IF NEW.finished = true AND (OLD.finished IS NULL OR OLD.finished = false) THEN
    -- Finish the current gameweek for all games (including turbo - marks it done)
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
    -- SKIP Turbo and Cup games - they don't advance gameweeks
    UPDATE public.games 
    SET current_gameweek = next_gameweek_num,
        updated_at = now()
    WHERE status = 'active' 
      AND next_gameweek_num IS NOT NULL
      AND game_mode NOT IN ('turbo', 'cup');
    
    -- Open the next gameweek for active games
    -- SKIP Turbo and Cup games - they don't have future gameweeks
    UPDATE public.game_gameweeks 
    SET status = 'open',
        picks_visible = false,
        updated_at = now()
    WHERE gameweek_number = next_gameweek_num
    AND EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = game_gameweeks.game_id 
      AND games.status = 'active'
      AND games.game_mode NOT IN ('turbo', 'cup')
    )
    AND next_gameweek_num IS NOT NULL;
  END IF;

  -- When a gameweek becomes current (is_current = true), activate it automatically
  -- BUT only if no custom deadline exists for the specific game
  IF NEW.is_current = true AND (OLD.is_current IS NULL OR OLD.is_current = false) THEN
    -- FIRST: Eliminate players who failed to rebuy before activating the gameweek
    -- Skip for turbo/cup as they don't have rebuy mechanics
    PERFORM public.eliminate_players_who_failed_to_rebuy(NEW.gameweek_number);
    
    -- THEN: Activate the gameweek for games WITHOUT custom deadlines
    -- This includes Turbo games that haven't been activated yet
    UPDATE public.game_gameweeks 
    SET status = 'active',
        picks_visible = true,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number
      AND status = 'open'
      AND NOT EXISTS (
        -- Don't auto-activate if game has custom deadline that hasn't passed
        SELECT 1 FROM public.gameweek_deadlines gd
        WHERE gd.game_id = game_gameweeks.game_id
          AND gd.gameweek = NEW.gameweek_number
          AND gd.deadline > now()
      )
      AND EXISTS (
        SELECT 1 FROM public.games 
        WHERE games.id = game_gameweeks.game_id 
        AND games.status = 'active'
        AND games.game_mode != 'cup'  -- Cup games use current_deadline, not gameweeks
      );
  END IF;

  RETURN NEW;
END;
$function$;