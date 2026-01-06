-- Add 'Cup' to supported game modes by updating existing games constraint
-- First, add lives column to game_players
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS lives integer DEFAULT 0;

-- Create cup_fixtures table for manual fixture management
CREATE TABLE public.cup_fixtures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  tier_difference INTEGER NOT NULL DEFAULT 0, -- positive = home higher tier, negative = away higher tier
  home_goals INTEGER, -- null until result entered
  away_goals INTEGER, -- null until result entered
  fixture_order INTEGER NOT NULL, -- order in the fixture list
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, fixture_order)
);

-- Enable RLS on cup_fixtures
ALTER TABLE public.cup_fixtures ENABLE ROW LEVEL SECURITY;

-- RLS policies for cup_fixtures
CREATE POLICY "Anyone can view cup fixtures"
ON public.cup_fixtures FOR SELECT
USING (true);

CREATE POLICY "Game creators can manage cup fixtures"
ON public.cup_fixtures FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.games g 
    WHERE g.id = game_id AND g.created_by = auth.uid()
  )
);

-- Create cup_picks table for cup game picks
CREATE TABLE public.cup_picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixture_id UUID NOT NULL REFERENCES public.cup_fixtures(id) ON DELETE CASCADE,
  picked_team TEXT NOT NULL, -- 'home' or 'away'
  preference_order INTEGER NOT NULL, -- 1-10 are active picks, 11+ are backup
  result TEXT, -- 'win', 'loss', 'draw_success', 'saved_by_life' (null until processed)
  goals_counted INTEGER DEFAULT 0, -- goals that count toward tiebreaker
  life_gained INTEGER DEFAULT 0, -- lives gained from this pick
  life_spent BOOLEAN DEFAULT false, -- true if a life was spent to save this pick
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id, fixture_id)
);

-- Enable RLS on cup_picks
ALTER TABLE public.cup_picks ENABLE ROW LEVEL SECURITY;

-- RLS policies for cup_picks
CREATE POLICY "Users can view their own cup picks"
ON public.cup_picks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view all cup picks when game is active or finished"
ON public.cup_picks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.games g 
    WHERE g.id = game_id AND g.status IN ('active', 'finished')
  )
);

CREATE POLICY "Users can manage their own cup picks"
ON public.cup_picks FOR ALL
USING (auth.uid() = user_id);

-- Add trigger for updated_at on cup_fixtures
CREATE TRIGGER update_cup_fixtures_updated_at
BEFORE UPDATE ON public.cup_fixtures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on cup_picks
CREATE TRIGGER update_cup_picks_updated_at
BEFORE UPDATE ON public.cup_picks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to process cup results
CREATE OR REPLACE FUNCTION public.process_cup_results(p_game_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick RECORD;
  v_fixture RECORD;
  v_player RECORD;
  v_current_lives INTEGER;
  v_streak_broken BOOLEAN;
  v_pick_result TEXT;
  v_goals_to_count INTEGER;
  v_lives_gained INTEGER;
BEGIN
  -- Process each player's picks in preference order
  FOR v_player IN 
    SELECT DISTINCT user_id FROM public.cup_picks WHERE game_id = p_game_id
  LOOP
    v_current_lives := COALESCE((SELECT lives FROM public.game_players WHERE game_id = p_game_id AND user_id = v_player.user_id), 0);
    v_streak_broken := false;
    
    -- Process picks in order (1-10 only for main game)
    FOR v_pick IN 
      SELECT cp.*, cf.home_goals, cf.away_goals, cf.tier_difference, cf.home_team, cf.away_team
      FROM public.cup_picks cp
      JOIN public.cup_fixtures cf ON cf.id = cp.fixture_id
      WHERE cp.game_id = p_game_id 
        AND cp.user_id = v_player.user_id
        AND cp.preference_order <= 10
        AND cf.home_goals IS NOT NULL 
        AND cf.away_goals IS NOT NULL
      ORDER BY cp.preference_order
    LOOP
      v_lives_gained := 0;
      v_goals_to_count := 0;
      
      -- Determine if pick won
      IF (v_pick.picked_team = 'home' AND v_pick.home_goals > v_pick.away_goals) OR
         (v_pick.picked_team = 'away' AND v_pick.away_goals > v_pick.home_goals) THEN
        -- Pick won
        v_pick_result := 'win';
        
        -- Calculate tier difference from picked team's perspective
        -- tier_difference is from home perspective, so if picking away, invert it
        DECLARE
          v_pick_tier_diff INTEGER;
        BEGIN
          IF v_pick.picked_team = 'home' THEN
            v_pick_tier_diff := v_pick.tier_difference;
          ELSE
            v_pick_tier_diff := -v_pick.tier_difference;
          END IF;
          
          -- Goals count unless picking against team 1 tier below (tier_diff = 1)
          IF v_pick_tier_diff != 1 THEN
            IF v_pick.picked_team = 'home' THEN
              v_goals_to_count := v_pick.home_goals;
            ELSE
              v_goals_to_count := v_pick.away_goals;
            END IF;
          END IF;
          
          -- Lives gained if picked against higher tier team (tier_diff < 0)
          IF v_pick_tier_diff < 0 THEN
            v_lives_gained := ABS(v_pick_tier_diff);
          END IF;
        END;
        
      ELSIF v_pick.home_goals = v_pick.away_goals THEN
        -- Draw result
        DECLARE
          v_pick_tier_diff INTEGER;
        BEGIN
          IF v_pick.picked_team = 'home' THEN
            v_pick_tier_diff := v_pick.tier_difference;
          ELSE
            v_pick_tier_diff := -v_pick.tier_difference;
          END IF;
          
          -- Draw success if picked against team 1+ tiers above
          IF v_pick_tier_diff <= -1 THEN
            v_pick_result := 'draw_success';
            -- Lives gained for draws against teams 2+ tiers above
            IF v_pick_tier_diff <= -2 THEN
              v_lives_gained := ABS(v_pick_tier_diff) - 1;
            END IF;
          ELSE
            -- Draw is a loss unless picking against higher tier
            IF NOT v_streak_broken AND v_current_lives > 0 THEN
              v_pick_result := 'saved_by_life';
              v_current_lives := v_current_lives - 1;
              -- Goals count when saved by life
              IF v_pick.picked_team = 'home' THEN
                v_goals_to_count := v_pick.home_goals;
              ELSE
                v_goals_to_count := v_pick.away_goals;
              END IF;
            ELSE
              v_pick_result := 'loss';
              v_streak_broken := true;
            END IF;
          END IF;
        END;
        
      ELSE
        -- Pick lost
        IF NOT v_streak_broken AND v_current_lives > 0 THEN
          v_pick_result := 'saved_by_life';
          v_current_lives := v_current_lives - 1;
          -- Goals count when saved by life
          IF v_pick.picked_team = 'home' THEN
            v_goals_to_count := v_pick.home_goals;
          ELSE
            v_goals_to_count := v_pick.away_goals;
          END IF;
        ELSE
          v_pick_result := 'loss';
          v_streak_broken := true;
        END IF;
      END IF;
      
      -- Add lives gained
      v_current_lives := v_current_lives + v_lives_gained;
      
      -- Update pick record
      UPDATE public.cup_picks
      SET result = v_pick_result,
          goals_counted = v_goals_to_count,
          life_gained = v_lives_gained,
          life_spent = (v_pick_result = 'saved_by_life')
      WHERE id = v_pick.id;
    END LOOP;
    
    -- Update player's lives
    UPDATE public.game_players
    SET lives = v_current_lives
    WHERE game_id = p_game_id AND user_id = v_player.user_id;
  END LOOP;
END;
$$;