-- Fix the remaining functions that need search path security
CREATE OR REPLACE FUNCTION public.check_all_picks_made(p_game_id uuid, p_gameweek_number integer)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $function$
DECLARE
  total_players integer;
  picks_made integer;
BEGIN
  -- Count total active players in the game
  SELECT COUNT(*)
  INTO total_players
  FROM public.game_players
  WHERE game_id = p_game_id
    AND is_eliminated = false;

  -- Count picks made for this gameweek
  SELECT COUNT(*)
  INTO picks_made
  FROM public.picks
  WHERE game_id = p_game_id
    AND gameweek = p_gameweek_number;

  RETURN total_players = picks_made AND total_players > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maybe_activate_game_gameweek()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- This function is now only for manual activation or deadline-based activation
  -- No longer automatically activates when all picks are made
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_pick_results_on_fixture_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  pick_record RECORD;
  is_win boolean;
  is_draw boolean;
BEGIN
  -- Only process if fixture is now finished and wasn't before
  IF NEW.finished = true AND (OLD.finished IS NULL OR OLD.finished = false) THEN
    
    -- Process all picks for this fixture
    FOR pick_record IN
      SELECT p.*, t.name as team_name
      FROM public.picks p
      JOIN public.teams t ON p.team_id = t.id
      WHERE p.fixture_id = NEW.id
    LOOP
      -- Determine pick result
      is_draw := (NEW.home_score = NEW.away_score);
      
      IF pick_record.picked_side = 'home' THEN
        is_win := (NEW.home_score > NEW.away_score);
      ELSIF pick_record.picked_side = 'away' THEN
        is_win := (NEW.home_score < NEW.away_score);
      ELSE
        is_win := false; -- Invalid pick
      END IF;

      -- Update pick result
      UPDATE public.picks
      SET result = CASE
        WHEN is_win THEN 'win'
        WHEN is_draw THEN 'draw'
        ELSE 'loss'
      END
      WHERE id = pick_record.id;

      -- If it's a loss, eliminate the player
      IF NOT is_win AND NOT is_draw THEN
        UPDATE public.game_players
        SET is_eliminated = true,
            eliminated_gameweek = pick_record.gameweek
        WHERE game_id = pick_record.game_id
          AND user_id = pick_record.user_id;
      END IF;
    END LOOP;

    -- Check if any games should be finished after this result
    PERFORM public.check_and_finish_games_after_results(NEW.gameweek);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_and_finish_games_after_results(p_gameweek_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  game_record RECORD;
  active_players integer;
BEGIN
  -- Check all active games
  FOR game_record IN
    SELECT DISTINCT g.id, g.name
    FROM public.games g
    JOIN public.picks p ON g.id = p.game_id
    WHERE g.status = 'active'
      AND p.gameweek = p_gameweek_number
  LOOP
    -- Count active (non-eliminated) players
    SELECT COUNT(*)
    INTO active_players
    FROM public.game_players
    WHERE game_id = game_record.id
      AND is_eliminated = false;

    -- Finish game if 1 or 0 players remaining
    IF active_players <= 1 THEN
      UPDATE public.games
      SET status = 'finished'
      WHERE id = game_record.id;
      
      -- Mark all game gameweeks as finished
      UPDATE public.game_gameweeks
      SET status = 'finished',
          picks_visible = true
      WHERE game_id = game_record.id
        AND status IN ('open', 'active');
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_gameweeks_past_deadline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Activate gameweeks where the deadline has passed
  UPDATE public.game_gameweeks
  SET status = 'active',
      picks_visible = true,
      updated_at = now()
  WHERE status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.gameweeks gw
      WHERE gw.gameweek_number = game_gameweeks.gameweek_number
      AND gw.deadline < now()
    );
END;
$function$;