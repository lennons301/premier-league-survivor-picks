-- Add game_mode column to games table
ALTER TABLE public.games 
ADD COLUMN game_mode text NOT NULL DEFAULT 'classic';

-- Add allow_rebuys column for escalating mode
ALTER TABLE public.games 
ADD COLUMN allow_rebuys boolean NOT NULL DEFAULT true;

-- Add preference_order column to picks table for turbo mode ranking
ALTER TABLE public.picks 
ADD COLUMN preference_order integer;

-- Add predicted_result column to picks for turbo mode (home_win, away_win, draw)
ALTER TABLE public.picks 
ADD COLUMN predicted_result text;

-- Add goals_scored column to track goals for tiebreaker
ALTER TABLE public.picks 
ADD COLUMN goals_scored integer DEFAULT 0;

-- Create index for game mode queries
CREATE INDEX idx_games_game_mode ON public.games(game_mode);

-- Create index for preference order queries
CREATE INDEX idx_picks_preference_order ON public.picks(preference_order);

-- Comment on the new columns
COMMENT ON COLUMN public.games.game_mode IS 'Game mode: classic, escalating, turbo';
COMMENT ON COLUMN public.games.allow_rebuys IS 'Whether rebuys are allowed (only affects escalating mode)';
COMMENT ON COLUMN public.picks.preference_order IS 'Preference order for turbo mode (1 = highest confidence)';
COMMENT ON COLUMN public.picks.predicted_result IS 'Predicted result for turbo mode: home_win, away_win, draw';
COMMENT ON COLUMN public.picks.goals_scored IS 'Goals scored in the picked team match for tiebreaker';