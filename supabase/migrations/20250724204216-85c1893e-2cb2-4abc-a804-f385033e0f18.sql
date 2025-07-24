-- Continue fixing the remaining functions
CREATE OR REPLACE FUNCTION public.sync_team_with_fpl(p_fpl_team_id integer, p_name text, p_short_name text, p_code integer DEFAULT NULL::integer, p_strength_overall_home integer DEFAULT NULL::integer, p_strength_overall_away integer DEFAULT NULL::integer, p_strength_attack_home integer DEFAULT NULL::integer, p_strength_attack_away integer DEFAULT NULL::integer, p_strength_defence_home integer DEFAULT NULL::integer, p_strength_defence_away integer DEFAULT NULL::integer, p_pulse_id integer DEFAULT NULL::integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  team_id uuid;
BEGIN
  INSERT INTO public.teams (
    fpl_team_id, name, short_name, code,
    strength_overall_home, strength_overall_away,
    strength_attack_home, strength_attack_away,
    strength_defence_home, strength_defence_away,
    pulse_id
  ) VALUES (
    p_fpl_team_id, p_name, p_short_name, p_code,
    p_strength_overall_home, p_strength_overall_away,
    p_strength_attack_home, p_strength_attack_away,
    p_strength_defence_home, p_strength_defence_away,
    p_pulse_id
  )
  ON CONFLICT (fpl_team_id) DO UPDATE SET
    name = p_name,
    short_name = p_short_name,
    code = p_code,
    strength_overall_home = p_strength_overall_home,
    strength_overall_away = p_strength_overall_away,
    strength_attack_home = p_strength_attack_home,
    strength_attack_away = p_strength_attack_away,
    strength_defence_home = p_strength_defence_home,
    strength_defence_away = p_strength_defence_away,
    pulse_id = p_pulse_id
  RETURNING id INTO team_id;
  
  RETURN team_id;
END;
$function$;

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
  -- Get the next gameweek number
  SELECT gameweek_number INTO next_gameweek_num
  FROM public.gameweeks
  WHERE is_next = true
  LIMIT 1;

  -- If no next gameweek found, use current + 1
  IF next_gameweek_num IS NULL THEN
    SELECT COALESCE(MAX(gameweek_number), 0) + 1 INTO next_gameweek_num
    FROM public.gameweeks;
  END IF;

  -- Create game_gameweek records for all future gameweeks
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

CREATE OR REPLACE FUNCTION public.update_game_gameweeks_on_global_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- When a gameweek becomes current (is_current = true), make it open for all active games
  IF NEW.is_current = true AND (OLD.is_current IS NULL OR OLD.is_current = false) THEN
    UPDATE public.game_gameweeks 
    SET status = 'open',
        picks_visible = false,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number
      AND EXISTS (
        SELECT 1 FROM public.games 
        WHERE games.id = game_gameweeks.game_id 
        AND games.status = 'active'
      );
  END IF;

  -- When a gameweek becomes previous (is_previous = true), finish it for all games
  IF NEW.is_previous = true AND (OLD.is_previous IS NULL OR OLD.is_previous = false) THEN
    UPDATE public.game_gameweeks 
    SET status = 'finished',
        picks_visible = true,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number;
    
    -- Open the next gameweek for active games
    UPDATE public.game_gameweeks 
    SET status = 'open',
        picks_visible = false,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number + 1
      AND EXISTS (
        SELECT 1 FROM public.games 
        WHERE games.id = game_gameweeks.game_id 
        AND games.status = 'active'
      );
  END IF;

  RETURN NEW;
END;
$function$;