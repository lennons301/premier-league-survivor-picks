-- Fix search path security issues for all functions
SET search_path = '';

-- Update all functions to have secure search paths
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_game_admin(game_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.games 
    WHERE id = game_id AND created_by = auth.uid()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_fixture_with_fpl(p_fpl_fixture_id integer, p_code integer, p_event integer, p_finished boolean, p_finished_provisional boolean, p_kickoff_time timestamp with time zone, p_minutes integer, p_provisional_start_time boolean, p_started boolean, p_team_a integer, p_team_a_score integer, p_team_h integer, p_team_h_score integer, p_team_h_difficulty integer, p_team_a_difficulty integer, p_pulse_id integer, p_stats jsonb DEFAULT '[]'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_gameweek_with_fpl(p_fpl_event_id integer, p_name text, p_deadline_time timestamp with time zone, p_finished boolean DEFAULT false, p_data_checked boolean DEFAULT false, p_is_previous boolean DEFAULT false, p_is_current boolean DEFAULT false, p_is_next boolean DEFAULT false, p_average_entry_score integer DEFAULT NULL::integer, p_highest_score integer DEFAULT NULL::integer, p_highest_scoring_entry integer DEFAULT NULL::integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;