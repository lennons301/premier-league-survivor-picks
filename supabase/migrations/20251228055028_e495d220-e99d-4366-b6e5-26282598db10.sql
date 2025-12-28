-- Fix the trigger to handle both classic and turbo game modes
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
BEGIN
    -- Only process if fixture is completed
    IF NEW.is_completed = TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed = FALSE) THEN
        v_home_score := COALESCE(NEW.home_score, NEW.team_h_score);
        v_away_score := COALESCE(NEW.away_score, NEW.team_a_score);
        
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
        
        RAISE LOG 'Processed picks for fixture %: actual_result=%, home_score=%, away_score=%', 
            NEW.id, v_actual_result, v_home_score, v_away_score;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Now fix the existing classic game picks with incorrect results
-- LIV 2-1 WOL: picked_side=home should be WIN
UPDATE picks p
SET result = 'win', goals_scored = f.home_score
FROM fixtures f
WHERE p.fixture_id = f.id
  AND p.picked_side = 'home'
  AND f.home_score > f.away_score
  AND f.is_completed = true
  AND p.predicted_result IS NULL;

-- Fix away wins
UPDATE picks p
SET result = 'win', goals_scored = f.away_score
FROM fixtures f
WHERE p.fixture_id = f.id
  AND p.picked_side = 'away'
  AND f.away_score > f.home_score
  AND f.is_completed = true
  AND p.predicted_result IS NULL;

-- Fix draws
UPDATE picks p
SET result = 'draw', goals_scored = 0
FROM fixtures f
WHERE p.fixture_id = f.id
  AND f.home_score = f.away_score
  AND f.is_completed = true
  AND p.predicted_result IS NULL;

-- Fix losses (home picked but away won, or away picked but home won)
UPDATE picks p
SET result = 'loss', goals_scored = 0
FROM fixtures f
WHERE p.fixture_id = f.id
  AND f.is_completed = true
  AND p.predicted_result IS NULL
  AND (
    (p.picked_side = 'home' AND f.away_score > f.home_score) OR
    (p.picked_side = 'away' AND f.home_score > f.away_score)
  );