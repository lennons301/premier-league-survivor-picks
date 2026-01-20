
-- Fix 1: Clear winner_id for the incorrectly finished game (split winners are in game_winners table)
UPDATE games
SET winner_id = NULL
WHERE id = 'af26e727-477d-48fe-806f-895914fd3847';

-- Fix 2: Update check_and_finish_games_after_results to only finish when ALL fixtures with picks are complete
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
  all_pick_fixtures_complete boolean;
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
    -- CRITICAL: Check if ALL fixtures that have picks in this gameweek are complete
    -- Do NOT finish the game until all picked fixtures have results
    SELECT NOT EXISTS (
      SELECT 1 
      FROM public.picks p
      JOIN public.fixtures f ON p.fixture_id = f.id
      WHERE p.game_id = game_record.id
        AND p.gameweek = p_gameweek_number
        AND (f.finished IS NULL OR f.finished = false)
    ) INTO all_pick_fixtures_complete;
    
    -- Only proceed if ALL fixtures with picks are complete
    IF NOT all_pick_fixtures_complete THEN
      CONTINUE;  -- Skip this game, check again later
    END IF;
    
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
