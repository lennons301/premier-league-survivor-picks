-- Update the pick results processing function to only allow rebuy for first gameweek losses
CREATE OR REPLACE FUNCTION public.process_pick_results_on_fixture_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  pick_record RECORD;
  is_win boolean;
  is_draw boolean;
  game_starting_gameweek integer;
BEGIN
  -- Only process if fixture is now finished and wasn't before
  IF NEW.finished = true AND (OLD.finished IS NULL OR OLD.finished = false) THEN
    
    -- Process all picks for this fixture
    FOR pick_record IN
      SELECT p.*, t.name as team_name, g.starting_gameweek
      FROM public.picks p
      JOIN public.teams t ON p.team_id = t.id
      JOIN public.games g ON p.game_id = g.id
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

      -- If it's a loss, check if user should be eliminated
      IF NOT is_win AND NOT is_draw THEN
        -- Only allow rebuy if this loss occurred in the starting gameweek of the game
        IF pick_record.gameweek = pick_record.starting_gameweek THEN
          -- Don't eliminate - user gets rebuy chance
          -- They will be eliminated later if they don't make a pick in the next gameweek
          NULL;
        ELSE
          -- Immediate elimination for losses after the first gameweek
          UPDATE public.game_players
          SET is_eliminated = true,
              eliminated_gameweek = pick_record.gameweek
          WHERE game_id = pick_record.game_id
            AND user_id = pick_record.user_id;
        END IF;
      END IF;
    END LOOP;

    -- Check if any games should be finished after this result
    PERFORM public.check_and_finish_games_after_results(NEW.gameweek);
  END IF;

  RETURN NEW;
END;
$function$;