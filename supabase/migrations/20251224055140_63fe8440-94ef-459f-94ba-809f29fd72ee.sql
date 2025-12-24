-- Function to check and finish turbo games after fixture results
CREATE OR REPLACE FUNCTION public.check_and_finish_turbo_games(p_gameweek_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  game_record RECORD;
  player_record RECORD;
  all_fixtures_complete boolean;
  max_streak integer;
  players_with_max_streak integer;
  winner_user_id uuid;
  max_goals integer;
  players_with_max_goals integer;
  prize_pot numeric;
  split_amount numeric;
  player_count integer;
BEGIN
  -- Check each active turbo game
  FOR game_record IN
    SELECT g.id, g.entry_fee
    FROM public.games g
    WHERE g.status = 'active'
      AND g.game_mode = 'turbo'
  LOOP
    -- Check if all fixtures for this gameweek are complete
    SELECT NOT EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.gameweek = p_gameweek_number
        AND (f.finished IS NULL OR f.finished = false)
    ) INTO all_fixtures_complete;

    -- Only process if all fixtures are complete
    IF all_fixtures_complete THEN
      -- Calculate streaks for each player in this game
      -- A streak breaks when any prediction is wrong (ordered by preference_order)
      CREATE TEMP TABLE IF NOT EXISTS turbo_streaks (
        user_id uuid,
        consecutive_correct integer,
        goals_in_correct integer
      ) ON COMMIT DROP;
      
      DELETE FROM turbo_streaks;
      
      -- Calculate streaks and goals for each active player
      FOR player_record IN
        SELECT gp.user_id
        FROM public.game_players gp
        WHERE gp.game_id = game_record.id
          AND gp.is_eliminated = false
      LOOP
        -- Calculate consecutive correct picks (by preference order)
        -- and goals scored in those correct picks
        INSERT INTO turbo_streaks (user_id, consecutive_correct, goals_in_correct)
        SELECT 
          player_record.user_id,
          COALESCE((
            SELECT COUNT(*)
            FROM (
              SELECT p.id, p.result, p.preference_order,
                     ROW_NUMBER() OVER (ORDER BY p.preference_order ASC) as rn
              FROM public.picks p
              WHERE p.game_id = game_record.id
                AND p.user_id = player_record.user_id
                AND p.gameweek = p_gameweek_number
              ORDER BY p.preference_order ASC
            ) ordered_picks
            WHERE ordered_picks.result = 'win'
              AND ordered_picks.preference_order = ordered_picks.rn
          ), 0),
          COALESCE((
            SELECT SUM(
              CASE 
                -- For draws (predicted_result = 'draw' and result = 'win'), include both teams' goals
                WHEN p.predicted_result = 'draw' AND p.result = 'win' THEN
                  COALESCE(f.home_score, 0) + COALESCE(f.away_score, 0)
                -- For home/away wins, include goals from picked side
                WHEN p.result = 'win' THEN COALESCE(p.goals_scored, 0)
                ELSE 0
              END
            )
            FROM public.picks p
            LEFT JOIN public.fixtures f ON p.fixture_id = f.id
            WHERE p.game_id = game_record.id
              AND p.user_id = player_record.user_id
              AND p.gameweek = p_gameweek_number
              AND p.result = 'win'
              AND p.preference_order <= (
                -- Only count goals from picks within the streak
                SELECT COALESCE(MIN(p2.preference_order) - 1, 
                  (SELECT MAX(p3.preference_order) FROM public.picks p3 
                   WHERE p3.game_id = game_record.id 
                   AND p3.user_id = player_record.user_id 
                   AND p3.gameweek = p_gameweek_number))
                FROM public.picks p2
                WHERE p2.game_id = game_record.id
                  AND p2.user_id = player_record.user_id
                  AND p2.gameweek = p_gameweek_number
                  AND p2.result = 'loss'
              )
          ), 0);
      END LOOP;

      -- Find the maximum streak
      SELECT MAX(consecutive_correct) INTO max_streak FROM turbo_streaks;
      
      -- Count players with max streak
      SELECT COUNT(*) INTO players_with_max_streak 
      FROM turbo_streaks 
      WHERE consecutive_correct = max_streak;

      -- If only one player has max streak, they win
      IF players_with_max_streak = 1 THEN
        SELECT user_id INTO winner_user_id 
        FROM turbo_streaks 
        WHERE consecutive_correct = max_streak;
        
        -- Mark game as finished with winner
        UPDATE public.games
        SET status = 'finished',
            winner_id = winner_user_id,
            updated_at = now()
        WHERE id = game_record.id;
        
        -- Calculate prize pot and insert winner
        prize_pot := public.calculate_prize_pot(game_record.id);
        
        INSERT INTO public.game_winners (game_id, user_id, payout_amount, is_split)
        VALUES (game_record.id, winner_user_id, prize_pot, false);
        
      -- Multiple players tied on streak - use goals tiebreaker
      ELSIF players_with_max_streak > 1 THEN
        -- Find max goals among players with max streak
        SELECT MAX(goals_in_correct) INTO max_goals 
        FROM turbo_streaks 
        WHERE consecutive_correct = max_streak;
        
        -- Count players with both max streak AND max goals
        SELECT COUNT(*) INTO players_with_max_goals 
        FROM turbo_streaks 
        WHERE consecutive_correct = max_streak 
          AND goals_in_correct = max_goals;
        
        -- If only one player has max goals, they win
        IF players_with_max_goals = 1 THEN
          SELECT user_id INTO winner_user_id 
          FROM turbo_streaks 
          WHERE consecutive_correct = max_streak 
            AND goals_in_correct = max_goals;
          
          UPDATE public.games
          SET status = 'finished',
              winner_id = winner_user_id,
              updated_at = now()
          WHERE id = game_record.id;
          
          prize_pot := public.calculate_prize_pot(game_record.id);
          
          INSERT INTO public.game_winners (game_id, user_id, payout_amount, is_split)
          VALUES (game_record.id, winner_user_id, prize_pot, false);
          
        -- Still tied - split the pot
        ELSE
          prize_pot := public.calculate_prize_pot(game_record.id);
          split_amount := prize_pot / players_with_max_goals;
          
          UPDATE public.games
          SET status = 'finished',
              updated_at = now()
          WHERE id = game_record.id;
          
          -- Insert winners for each tied player
          INSERT INTO public.game_winners (game_id, user_id, payout_amount, is_split)
          SELECT game_record.id, user_id, split_amount, true
          FROM turbo_streaks
          WHERE consecutive_correct = max_streak
            AND goals_in_correct = max_goals;
        END IF;
      END IF;
      
      -- Mark game gameweeks as finished
      UPDATE public.game_gameweeks
      SET status = 'finished',
          picks_visible = true,
          updated_at = now()
      WHERE game_id = game_record.id
        AND gameweek_number = p_gameweek_number;
        
    END IF;
  END LOOP;
END;
$function$;

-- Update the main fixture update trigger to also call turbo game checking
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
        IF pick_record.predicted_result = actual_result THEN
          UPDATE public.picks
          SET result = 'win',
              goals_scored = CASE 
                WHEN actual_result = 'draw' THEN NEW.home_score + NEW.away_score
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

        UPDATE public.picks
        SET result = CASE
          WHEN is_win THEN 'win'
          WHEN is_draw THEN 'draw'
          ELSE 'loss'
        END
        WHERE id = pick_record.id;

        IF NOT is_win THEN
          IF pick_record.gameweek = game_starting_gameweek THEN
            NULL;
          ELSE
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

    -- Check if any classic/escalating games should be finished
    PERFORM public.check_and_finish_games_after_results(NEW.gameweek);
    
    -- Check if any turbo games should be finished
    PERFORM public.check_and_finish_turbo_games(NEW.gameweek);
  END IF;

  RETURN NEW;
END;
$function$;