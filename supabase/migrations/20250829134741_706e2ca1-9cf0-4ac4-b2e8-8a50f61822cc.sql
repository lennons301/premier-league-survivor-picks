-- Fix manual gameweek activation to only affect specific games, not global deadlines

-- Create function to manually activate a gameweek for a specific game only
CREATE OR REPLACE FUNCTION public.manually_activate_gameweek(p_game_id uuid, p_gameweek_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Check if user is game admin
  IF NOT public.is_game_admin(p_game_id) THEN
    RAISE EXCEPTION 'Access denied. Only game admins can activate gameweeks.';
  END IF;

  -- Eliminate players who failed to rebuy before activating the gameweek
  PERFORM public.eliminate_players_who_failed_to_rebuy(p_gameweek_number);
  
  -- Activate the gameweek for this specific game only
  UPDATE public.game_gameweeks 
  SET status = 'active',
      picks_visible = true,
      updated_at = now()
  WHERE game_id = p_game_id
    AND gameweek_number = p_gameweek_number
    AND status IN ('open', 'upcoming');

  -- Create or update a custom deadline for this specific game
  -- Set deadline to current time to indicate manual activation
  INSERT INTO public.gameweek_deadlines (game_id, gameweek, deadline)
  VALUES (p_game_id, p_gameweek_number, now())
  ON CONFLICT (game_id, gameweek) 
  DO UPDATE SET 
    deadline = now(),
    created_at = now();
END;
$function$;

-- Update the global gameweek trigger to NOT manually set deadlines
-- Manual activation should only affect game-specific deadlines, not global ones
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

  -- When a gameweek becomes current (is_current = true), activate it automatically
  -- BUT only if no custom deadline exists for the specific game
  IF NEW.is_current = true AND (OLD.is_current IS NULL OR OLD.is_current = false) THEN
    -- FIRST: Eliminate players who failed to rebuy before activating the gameweek
    PERFORM public.eliminate_players_who_failed_to_rebuy(NEW.gameweek_number);
    
    -- THEN: Activate the gameweek for games WITHOUT custom deadlines
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
      );
  END IF;

  RETURN NEW;
END;
$function$;

-- Update the deadline-based activation to respect custom game deadlines
CREATE OR REPLACE FUNCTION public.activate_gameweeks_past_deadline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Eliminate players who failed to rebuy before activating gameweeks
  PERFORM public.eliminate_players_who_failed_to_rebuy(gw.gameweek_number)
  FROM public.gameweeks gw
  WHERE gw.deadline < now() AND gw.is_current = false;

  -- Activate gameweeks where the global deadline has passed
  -- BUT respect custom game deadlines
  UPDATE public.game_gameweeks
  SET status = 'active',
      picks_visible = true,
      updated_at = now()
  WHERE status = 'open'
    AND (
      -- Use custom deadline if it exists and has passed
      EXISTS (
        SELECT 1 FROM public.gameweek_deadlines gd
        WHERE gd.game_id = game_gameweeks.game_id
          AND gd.gameweek = game_gameweeks.gameweek_number
          AND gd.deadline <= now()
      )
      OR
      -- Otherwise use global deadline if no custom deadline exists
      (
        NOT EXISTS (
          SELECT 1 FROM public.gameweek_deadlines gd
          WHERE gd.game_id = game_gameweeks.game_id
            AND gd.gameweek = game_gameweeks.gameweek_number
        )
        AND EXISTS (
          SELECT 1 FROM public.gameweeks gw
          WHERE gw.gameweek_number = game_gameweeks.gameweek_number
          AND gw.deadline <= now()
        )
      )
    );
END;
$function$;