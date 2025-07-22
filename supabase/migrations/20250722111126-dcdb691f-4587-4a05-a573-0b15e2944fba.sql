-- Ensure our database schema is optimized for FPL API data structure
-- Add any missing indexes and constraints for better performance

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teams_fpl_team_id ON public.teams(fpl_team_id);
CREATE INDEX IF NOT EXISTS idx_gameweeks_fpl_event_id ON public.gameweeks(fpl_event_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_fpl_fixture_id ON public.fixtures(fpl_fixture_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_event ON public.fixtures(event);
CREATE INDEX IF NOT EXISTS idx_fixtures_team_h ON public.fixtures(team_h);
CREATE INDEX IF NOT EXISTS idx_fixtures_team_a ON public.fixtures(team_a);
CREATE INDEX IF NOT EXISTS idx_picks_gameweek ON public.picks(gameweek);
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON public.picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_game_id ON public.picks(game_id);

-- Ensure proper constraints
ALTER TABLE public.teams ADD CONSTRAINT unique_fpl_team_id UNIQUE (fpl_team_id);
ALTER TABLE public.gameweeks ADD CONSTRAINT unique_fpl_event_id UNIQUE (fpl_event_id);
ALTER TABLE public.fixtures ADD CONSTRAINT unique_fpl_fixture_id UNIQUE (fpl_fixture_id);