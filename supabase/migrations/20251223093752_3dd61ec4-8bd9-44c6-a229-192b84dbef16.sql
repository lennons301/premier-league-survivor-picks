
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
  actual_result text;
  game_mode text;
  game_starting_gameweek integer;
  player_picks_count integer;
  player_losses_count integer;
BEGIN
  -- Only process if fixture is now finished and wasn't before
  IF NEW.finished = true AND (OLD.finished IS NULL OR OLD.finished = false) THEN
    
    -- Process all picks for this fixture
    FOR pick_record IN
      SELECT p.*, t.name as team_name, g.starting_gameweek, g.game_mode
      FROM public.picks p
      JOIN public.teams t ON p.team_id = t.id
      JOIN public.games g ON p.game_id = g.id
      WHERE p.fixture_id = NEW.id
    LOOP
      game_mode := pick_record.game_mode;
      game_starting_gameweek := pick_record.starting_gameweek;
      
      -- Determine actual result of the match
      IF NEW.home_score > NEW.away_score THEN
        actual_result := 'home';
      ELSIF NEW.home_score < NEW.away_score THEN
        actual_result := 'away';
      ELSE
        actual_result := 'draw';
      END IF;
      
      -- Determine if draw occurred
      is_draw := (NEW.home_score = NEW.away_score);
      
      -- Process based on game mode
      IF game_mode = 'turbo' THEN
        -- TURBO MODE: Compare predicted_result with actual result
        -- No elimination, just record if prediction was correct
        IF pick_record.predicted_result = actual_result THEN
          UPDATE public.picks
          SET result = 'win',
              goals_scored = CASE 
                WHEN pick_record.picked_side = 'home' THEN NEW.home_score
                WHEN pick_record.picked_side = 'away' THEN NEW.away_score
                ELSE 0
              END
          WHERE id = pick_record.id;
        ELSE
          UPDATE public.picks
          SET result = 'loss',
              goals_scored = 0
          WHERE id = pick_record.id;
        END IF;
        
      ELSIF game_mode = 'escalating' THEN
        -- ESCALATING MODE: Check if picked team won
        IF pick_record.picked_side = 'home' THEN
          is_win := (NEW.home_score > NEW.away_score);
        ELSIF pick_record.picked_side = 'away' THEN
          is_win := (NEW.home_score < NEW.away_score);
        ELSE
          is_win := false;
        END IF;
        
        -- Update pick result with goals scored
        UPDATE public.picks
        SET result = CASE
          WHEN is_win THEN 'win'
          WHEN is_draw THEN 'draw'
          ELSE 'loss'
        END,
        goals_scored = CASE
          WHEN pick_record.picked_side = 'home' THEN NEW.home_score
          WHEN pick_record.picked_side = 'away' THEN NEW.away_score
          ELSE 0
        END
        WHERE id = pick_record.id;
        
        -- For escalating mode, any non-win (loss or draw) eliminates the player
        -- But only after the starting gameweek (first gameweek allows rebuy)
        IF NOT is_win AND pick_record.gameweek > game_starting_gameweek THEN
          UPDATE public.game_players
          SET is_eliminated = true,
              eliminated_gameweek = pick_record.gameweek
          WHERE game_id = pick_record.game_id
            AND user_id = pick_record.user_id
            AND is_eliminated = false;
        END IF;
        
      ELSE
        -- CLASSIC MODE (default): Original logic
        IF pick_record.picked_side = 'home' THEN
          is_win := (NEW.home_score > NEW.away_score);
        ELSIF pick_record.picked_side = 'away' THEN
          is_win := (NEW.home_score < NEW.away_score);
        ELSE
          is_win := false;
        END IF;

        -- Update pick result
        UPDATE public.picks
        SET result = CASE
          WHEN is_win THEN 'win'
          WHEN is_draw THEN 'draw'
          ELSE 'loss'
        END
        WHERE id = pick_record.id;

        -- If it's not a win (loss or draw), check if user should be eliminated
        IF NOT is_win THEN
          IF pick_record.gameweek = game_starting_gameweek THEN
            -- Don't eliminate - user gets rebuy chance for first gameweek non-wins
            NULL;
          ELSE
            -- Immediate elimination for non-wins after the first gameweek
            UPDATE public.game_players
            SET is_eliminated = true,
                eliminated_gameweek = pick_record.gameweek
            WHERE game_id = pick_record.game_id
              AND user_id = pick_record.user_id
              AND is_eliminated = false;
          END IF;
        END IF;
      END IF;
      
    END LOOP;

    -- Check if any games should be finished after this result
    PERFORM public.check_and_finish_games_after_results(NEW.gameweek);
  END IF;

  RETURN NEW;
END;
$function$;
