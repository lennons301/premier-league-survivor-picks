
-- Update the process_pick_results_on_fixture_update trigger to also handle eliminations and game finishing
CREATE OR REPLACE FUNCTION public.process_pick_results_on_fixture_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_actual_result TEXT;
    v_home_score INTEGER;
    v_away_score INTEGER;
    v_gameweek INTEGER;
BEGIN
    -- Only process if fixture is completed
    IF NEW.is_completed = TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed = FALSE) THEN
        v_home_score := COALESCE(NEW.home_score, NEW.team_h_score);
        v_away_score := COALESCE(NEW.away_score, NEW.team_a_score);
        v_gameweek := NEW.gameweek;
        
        -- Determine actual result
        IF v_home_score > v_away_score THEN
            v_actual_result := 'home_win';
        ELSIF v_away_score > v_home_score THEN
            v_actual_result := 'away_win';
        ELSE
            v_actual_result := 'draw';
        END IF;
        
        -- Update all picks for this fixture
        -- Handle both classic mode (picked_side) and turbo mode (predicted_result)
        UPDATE picks
        SET 
            result = CASE 
                -- Turbo mode: uses predicted_result (home_win, away_win, draw)
                WHEN predicted_result IS NOT NULL THEN
                    CASE WHEN predicted_result = v_actual_result THEN 'win' ELSE 'loss' END
                -- Classic mode: uses picked_side (home, away) - only home/away wins count
                WHEN picked_side IS NOT NULL THEN
                    CASE 
                        WHEN picked_side = 'home' AND v_actual_result = 'home_win' THEN 'win'
                        WHEN picked_side = 'away' AND v_actual_result = 'away_win' THEN 'win'
                        WHEN v_actual_result = 'draw' THEN 'draw'
                        ELSE 'loss'
                    END
                ELSE 'loss'
            END,
            goals_scored = CASE
                -- Turbo mode goals calculation
                WHEN predicted_result IS NOT NULL AND predicted_result = v_actual_result THEN
                    CASE 
                        WHEN predicted_result = 'draw' THEN v_home_score + v_away_score
                        WHEN predicted_result = 'home_win' THEN v_home_score
                        WHEN predicted_result = 'away_win' THEN v_away_score
                        ELSE 0
                    END
                -- Classic mode goals calculation
                WHEN picked_side = 'home' AND v_actual_result = 'home_win' THEN v_home_score
                WHEN picked_side = 'away' AND v_actual_result = 'away_win' THEN v_away_score
                ELSE 0
            END
        WHERE fixture_id = NEW.id;
        
        -- After updating picks, eliminate non-winners for Classic/Escalating games (after starting gameweek)
        PERFORM public.eliminate_non_winners_after_first_gameweek();
        
        -- Check if any games should be finished (1 or 0 players remaining)
        PERFORM public.check_and_finish_games_after_results(v_gameweek);
        
        RAISE LOG 'Processed picks for fixture %: actual_result=%, home_score=%, away_score=%', 
            NEW.id, v_actual_result, v_home_score, v_away_score;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Also update check_and_finish_games_after_results to determine winner by goals when all eliminated
CREATE OR REPLACE FUNCTION public.check_and_finish_games_after_results(p_gameweek_number integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  game_record RECORD;
  active_players integer;
  winner_user_id uuid;
  prize_pot numeric;
BEGIN
  -- Check all active classic/escalating games (turbo has its own finishing logic)
  FOR game_record IN
    SELECT DISTINCT g.id, g.name, g.game_mode
    FROM public.games g
    JOIN public.picks p ON g.id = p.game_id
    WHERE g.status = 'active'
      AND g.game_mode IN ('classic', 'escalating')
      AND p.gameweek = p_gameweek_number
  LOOP
    -- Count active (non-eliminated) players
    SELECT COUNT(*)
    INTO active_players
    FROM public.game_players
    WHERE game_id = game_record.id
      AND is_eliminated = false;

    -- Finish game if 1 player remaining - they are the winner
    IF active_players = 1 THEN
      -- Get the winner
      SELECT user_id INTO winner_user_id
      FROM public.game_players
      WHERE game_id = game_record.id
        AND is_eliminated = false;
      
      UPDATE public.games
      SET status = 'finished',
          winner_id = winner_user_id
      WHERE id = game_record.id;
      
      -- Calculate prize pot and insert winner
      prize_pot := public.calculate_prize_pot(game_record.id);
      
      INSERT INTO public.game_winners (game_id, user_id, payout_amount, is_split)
      VALUES (game_record.id, winner_user_id, prize_pot, false);
      
      -- Mark all game gameweeks as finished
      UPDATE public.game_gameweeks
      SET status = 'finished',
          picks_visible = true
      WHERE game_id = game_record.id
        AND status IN ('open', 'active');
        
    -- Finish game if 0 players remaining - determine winner by most goals scored
    ELSIF active_players = 0 THEN
      -- Find player with most total goals scored across all winning picks
      SELECT gp.user_id INTO winner_user_id
      FROM public.game_players gp
      LEFT JOIN (
        SELECT user_id, SUM(COALESCE(goals_scored, 0)) as total_goals
        FROM public.picks
        WHERE game_id = game_record.id AND result = 'win'
        GROUP BY user_id
      ) goal_totals ON gp.user_id = goal_totals.user_id
      WHERE gp.game_id = game_record.id
      ORDER BY COALESCE(goal_totals.total_goals, 0) DESC
      LIMIT 1;
      
      UPDATE public.games
      SET status = 'finished',
          winner_id = winner_user_id
      WHERE id = game_record.id;
      
      -- Calculate prize pot and insert winner
      prize_pot := public.calculate_prize_pot(game_record.id);
      
      INSERT INTO public.game_winners (game_id, user_id, payout_amount, is_split)
      VALUES (game_record.id, winner_user_id, prize_pot, false);
      
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
