-- Restructure database to align with Fantasy Premier League API

-- Update teams table to match FPL teams structure
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS fpl_team_id integer UNIQUE;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS code integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS strength_overall_home integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS strength_overall_away integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS strength_attack_home integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS strength_attack_away integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS strength_defence_home integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS strength_defence_away integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS pulse_id integer;

-- Update gameweeks table to match FPL events structure
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS fpl_event_id integer UNIQUE;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS finished boolean DEFAULT false;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS data_checked boolean DEFAULT false;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS is_previous boolean DEFAULT false;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT false;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS is_next boolean DEFAULT false;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS average_entry_score integer;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS highest_score integer;
ALTER TABLE public.gameweeks ADD COLUMN IF NOT EXISTS highest_scoring_entry integer;

-- Update fixtures table to match FPL fixtures structure
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS fpl_fixture_id integer UNIQUE;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS code integer;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS event integer; -- gameweek number
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS finished boolean DEFAULT false;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS finished_provisional boolean DEFAULT false;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS started boolean DEFAULT false;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS minutes integer DEFAULT 0;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS provisional_start_time boolean DEFAULT false;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS team_h_difficulty integer;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS team_a_difficulty integer;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS pulse_id integer;
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS stats jsonb DEFAULT '[]'::jsonb;

-- Rename columns in fixtures to match FPL naming convention
-- Note: We'll keep our existing columns and add FPL equivalents for clarity
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS team_h integer; -- home team FPL ID
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS team_a integer; -- away team FPL ID
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS team_h_score integer; -- home score (same as home_score)
ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS team_a_score integer; -- away score (same as away_score)

-- Add foreign key constraints to link teams properly
-- First, let's ensure we have proper relationships
ALTER TABLE public.fixtures DROP CONSTRAINT IF EXISTS fixtures_team_h_fkey;
ALTER TABLE public.fixtures DROP CONSTRAINT IF EXISTS fixtures_team_a_fkey;

-- We'll add these constraints after populating the FPL team IDs

-- Update picks table to better match FPL structure
ALTER TABLE public.picks ADD COLUMN IF NOT EXISTS multiplier integer DEFAULT 1;
ALTER TABLE public.picks ADD COLUMN IF NOT EXISTS is_captain boolean DEFAULT false;
ALTER TABLE public.picks ADD COLUMN IF NOT EXISTS is_vice_captain boolean DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_fpl_team_id ON public.teams(fpl_team_id);
CREATE INDEX IF NOT EXISTS idx_gameweeks_fpl_event_id ON public.gameweeks(fpl_event_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_fpl_fixture_id ON public.fixtures(fpl_fixture_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_event ON public.fixtures(event);
CREATE INDEX IF NOT EXISTS idx_fixtures_team_h ON public.fixtures(team_h);
CREATE INDEX IF NOT EXISTS idx_fixtures_team_a ON public.fixtures(team_a);

-- Add a function to sync fixture data from FPL API
CREATE OR REPLACE FUNCTION public.sync_fixture_with_fpl(
  p_fpl_fixture_id integer,
  p_code integer,
  p_event integer,
  p_finished boolean,
  p_finished_provisional boolean,
  p_kickoff_time timestamp with time zone,
  p_minutes integer,
  p_provisional_start_time boolean,
  p_started boolean,
  p_team_a integer,
  p_team_a_score integer,
  p_team_h integer,
  p_team_h_score integer,
  p_team_h_difficulty integer,
  p_team_a_difficulty integer,
  p_pulse_id integer,
  p_stats jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fixture_id uuid;
  home_team_uuid uuid;
  away_team_uuid uuid;
BEGIN
  -- Get the UUIDs for home and away teams based on FPL team IDs
  SELECT id INTO home_team_uuid FROM public.teams WHERE fpl_team_id = p_team_h;
  SELECT id INTO away_team_uuid FROM public.teams WHERE fpl_team_id = p_team_a;
  
  -- Insert or update fixture
  INSERT INTO public.fixtures (
    fpl_fixture_id, code, event, finished, finished_provisional,
    kickoff_time, minutes, provisional_start_time, started,
    team_a, team_a_score, team_h, team_h_score,
    team_h_difficulty, team_a_difficulty, pulse_id, stats,
    home_team_id, away_team_id, home_score, away_score,
    gameweek, is_completed
  ) VALUES (
    p_fpl_fixture_id, p_code, p_event, p_finished, p_finished_provisional,
    p_kickoff_time, p_minutes, p_provisional_start_time, p_started,
    p_team_a, p_team_a_score, p_team_h, p_team_h_score,
    p_team_h_difficulty, p_team_a_difficulty, p_pulse_id, p_stats,
    home_team_uuid, away_team_uuid, p_team_h_score, p_team_a_score,
    p_event, p_finished
  )
  ON CONFLICT (fpl_fixture_id) DO UPDATE SET
    code = p_code,
    event = p_event,
    finished = p_finished,
    finished_provisional = p_finished_provisional,
    kickoff_time = p_kickoff_time,
    minutes = p_minutes,
    provisional_start_time = p_provisional_start_time,
    started = p_started,
    team_a = p_team_a,
    team_a_score = p_team_a_score,
    team_h = p_team_h,
    team_h_score = p_team_h_score,
    team_h_difficulty = p_team_h_difficulty,
    team_a_difficulty = p_team_a_difficulty,
    pulse_id = p_pulse_id,
    stats = p_stats,
    home_team_id = home_team_uuid,
    away_team_id = away_team_uuid,
    home_score = p_team_h_score,
    away_score = p_team_a_score,
    gameweek = p_event,
    is_completed = p_finished
  RETURNING id INTO fixture_id;
  
  RETURN fixture_id;
END;
$$;

-- Add function to sync gameweek data from FPL API
CREATE OR REPLACE FUNCTION public.sync_gameweek_with_fpl(
  p_fpl_event_id integer,
  p_name text,
  p_deadline_time timestamp with time zone,
  p_finished boolean DEFAULT false,
  p_data_checked boolean DEFAULT false,
  p_is_previous boolean DEFAULT false,
  p_is_current boolean DEFAULT false,
  p_is_next boolean DEFAULT false,
  p_average_entry_score integer DEFAULT null,
  p_highest_score integer DEFAULT null,
  p_highest_scoring_entry integer DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  gameweek_id uuid;
BEGIN
  INSERT INTO public.gameweeks (
    fpl_event_id, name, deadline, finished, data_checked,
    is_previous, is_current, is_next, average_entry_score,
    highest_score, highest_scoring_entry, gameweek_number, is_active
  ) VALUES (
    p_fpl_event_id, p_name, p_deadline_time, p_finished, p_data_checked,
    p_is_previous, p_is_current, p_is_next, p_average_entry_score,
    p_highest_score, p_highest_scoring_entry, p_fpl_event_id, p_is_current
  )
  ON CONFLICT (fpl_event_id) DO UPDATE SET
    name = p_name,
    deadline = p_deadline_time,
    finished = p_finished,
    data_checked = p_data_checked,
    is_previous = p_is_previous,
    is_current = p_is_current,
    is_next = p_is_next,
    average_entry_score = p_average_entry_score,
    highest_score = p_highest_score,
    highest_scoring_entry = p_highest_scoring_entry,
    gameweek_number = p_fpl_event_id,
    is_active = p_is_current
  RETURNING id INTO gameweek_id;
  
  RETURN gameweek_id;
END;
$$;

-- Add function to sync team data from FPL API
CREATE OR REPLACE FUNCTION public.sync_team_with_fpl(
  p_fpl_team_id integer,
  p_name text,
  p_short_name text,
  p_code integer DEFAULT null,
  p_strength_overall_home integer DEFAULT null,
  p_strength_overall_away integer DEFAULT null,
  p_strength_attack_home integer DEFAULT null,
  p_strength_attack_away integer DEFAULT null,
  p_strength_defence_home integer DEFAULT null,
  p_strength_defence_away integer DEFAULT null,
  p_pulse_id integer DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  team_id uuid;
BEGIN
  INSERT INTO public.teams (
    fpl_team_id, name, short_name, code,
    strength_overall_home, strength_overall_away,
    strength_attack_home, strength_attack_away,
    strength_defence_home, strength_defence_away,
    pulse_id
  ) VALUES (
    p_fpl_team_id, p_name, p_short_name, p_code,
    p_strength_overall_home, p_strength_overall_away,
    p_strength_attack_home, p_strength_attack_away,
    p_strength_defence_home, p_strength_defence_away,
    p_pulse_id
  )
  ON CONFLICT (fpl_team_id) DO UPDATE SET
    name = p_name,
    short_name = p_short_name,
    code = p_code,
    strength_overall_home = p_strength_overall_home,
    strength_overall_away = p_strength_overall_away,
    strength_attack_home = p_strength_attack_home,
    strength_attack_away = p_strength_attack_away,
    strength_defence_home = p_strength_defence_home,
    strength_defence_away = p_strength_defence_away,
    pulse_id = p_pulse_id
  RETURNING id INTO team_id;
  
  RETURN team_id;
END;
$$;