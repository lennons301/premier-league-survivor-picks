-- Reset database to clean state
-- This script will:
-- 1. Clear all game data while preserving user profiles
-- 2. Restore teams, gameweeks (events), and fixtures from seed data

-- Step 1: Clear all game data except users
DELETE FROM public.picks;
DELETE FROM public.game_players;
DELETE FROM public.gameweek_deadlines;
DELETE FROM public.games;
DELETE FROM public.fixtures;
DELETE FROM public.gameweeks;
DELETE FROM public.teams;

-- Step 2: Insert teams data
INSERT INTO public.teams (fpl_team_id, name, short_name, code, strength_overall_home, strength_overall_away, strength_attack_home, strength_attack_away, strength_defence_home, strength_defence_away, pulse_id) VALUES
(1, 'Arsenal', 'ARS', 3, 4, 4, 4, 4, 4, 4, 1),
(2, 'Aston Villa', 'AVL', 7, 3, 3, 3, 3, 3, 3, 2),
(3, 'Bournemouth', 'BOU', 91, 2, 2, 2, 2, 2, 2, 127),
(4, 'Brentford', 'BRE', 94, 2, 2, 2, 2, 2, 2, 130),
(5, 'Brighton & Hove Albion', 'BHA', 36, 3, 3, 3, 3, 3, 3, 131),
(6, 'Burnley', 'BUR', 90, 2, 2, 2, 2, 2, 2, 43),
(7, 'Chelsea', 'CHE', 8, 4, 4, 4, 4, 4, 4, 4),
(8, 'Crystal Palace', 'CRY', 31, 2, 2, 2, 2, 2, 2, 6),
(9, 'Everton', 'EVE', 11, 2, 2, 2, 2, 2, 2, 7),
(10, 'Fulham', 'FUL', 54, 3, 3, 3, 3, 3, 3, 34),
(11, 'Ipswich Town', 'IPS', 102, 2, 2, 2, 2, 2, 2, 40),
(12, 'Leicester City', 'LEI', 25, 2, 2, 2, 2, 2, 2, 13),
(13, 'Liverpool', 'LIV', 14, 5, 5, 5, 5, 5, 5, 14),
(14, 'Manchester City', 'MCI', 43, 5, 5, 5, 5, 5, 5, 11),
(15, 'Manchester United', 'MUN', 1, 4, 4, 4, 4, 4, 4, 12),
(16, 'Newcastle United', 'NEW', 4, 3, 3, 3, 3, 3, 3, 23),
(17, 'Nottingham Forest', 'NFO', 45, 2, 2, 2, 2, 2, 2, 15),
(18, 'Southampton', 'SOU', 20, 2, 2, 2, 2, 2, 2, 20),
(19, 'Tottenham Hotspur', 'TOT', 6, 4, 4, 4, 4, 4, 4, 21),
(20, 'West Ham United', 'WHU', 35, 3, 3, 3, 3, 3, 3, 25);

-- Step 3: Insert gameweeks (events) data
INSERT INTO public.gameweeks (fpl_event_id, name, deadline, finished, data_checked, is_previous, is_current, is_next, average_entry_score, highest_score, highest_scoring_entry, gameweek_number, is_active) VALUES
(1, 'Gameweek 1', '2025-08-15T17:30:00Z', false, false, false, false, true, 0, null, null, 1, false),
(2, 'Gameweek 2', '2025-08-22T17:30:00Z', false, false, false, false, false, 0, null, null, 2, false),
(3, 'Gameweek 3', '2025-08-29T17:30:00Z', false, false, false, false, false, 0, null, null, 3, false),
(4, 'Gameweek 4', '2025-09-12T17:30:00Z', false, false, false, false, false, 0, null, null, 4, false),
(5, 'Gameweek 5', '2025-09-19T17:30:00Z', false, false, false, false, false, 0, null, null, 5, false);

-- Step 4: Insert fixtures data
-- First get team UUIDs for proper foreign key references
DO $$
DECLARE
    team_1_uuid uuid;
    team_2_uuid uuid;
    team_3_uuid uuid;
    team_4_uuid uuid;
    team_5_uuid uuid;
    team_6_uuid uuid;
    team_7_uuid uuid;
    team_8_uuid uuid;
    team_9_uuid uuid;
    team_10_uuid uuid;
    team_11_uuid uuid;
    team_12_uuid uuid;
    team_13_uuid uuid;
    team_14_uuid uuid;
    team_15_uuid uuid;
    team_16_uuid uuid;
    team_17_uuid uuid;
    team_18_uuid uuid;
    team_19_uuid uuid;
    team_20_uuid uuid;
BEGIN
    -- Get all team UUIDs
    SELECT id INTO team_1_uuid FROM public.teams WHERE fpl_team_id = 1;
    SELECT id INTO team_2_uuid FROM public.teams WHERE fpl_team_id = 2;
    SELECT id INTO team_3_uuid FROM public.teams WHERE fpl_team_id = 3;
    SELECT id INTO team_4_uuid FROM public.teams WHERE fpl_team_id = 4;
    SELECT id INTO team_5_uuid FROM public.teams WHERE fpl_team_id = 5;
    SELECT id INTO team_6_uuid FROM public.teams WHERE fpl_team_id = 6;
    SELECT id INTO team_7_uuid FROM public.teams WHERE fpl_team_id = 7;
    SELECT id INTO team_8_uuid FROM public.teams WHERE fpl_team_id = 8;
    SELECT id INTO team_9_uuid FROM public.teams WHERE fpl_team_id = 9;
    SELECT id INTO team_10_uuid FROM public.teams WHERE fpl_team_id = 10;
    SELECT id INTO team_11_uuid FROM public.teams WHERE fpl_team_id = 11;
    SELECT id INTO team_12_uuid FROM public.teams WHERE fpl_team_id = 12;
    SELECT id INTO team_13_uuid FROM public.teams WHERE fpl_team_id = 13;
    SELECT id INTO team_14_uuid FROM public.teams WHERE fpl_team_id = 14;
    SELECT id INTO team_15_uuid FROM public.teams WHERE fpl_team_id = 15;
    SELECT id INTO team_16_uuid FROM public.teams WHERE fpl_team_id = 16;
    SELECT id INTO team_17_uuid FROM public.teams WHERE fpl_team_id = 17;
    SELECT id INTO team_18_uuid FROM public.teams WHERE fpl_team_id = 18;
    SELECT id INTO team_19_uuid FROM public.teams WHERE fpl_team_id = 19;
    SELECT id INTO team_20_uuid FROM public.teams WHERE fpl_team_id = 20;

    -- Insert fixtures
    INSERT INTO public.fixtures (fpl_fixture_id, code, event, finished, finished_provisional, kickoff_time, minutes, provisional_start_time, started, team_a, team_a_score, team_h, team_h_score, team_h_difficulty, team_a_difficulty, pulse_id, stats, home_team_id, away_team_id, home_score, away_score, gameweek, is_completed) VALUES
    (1, 2561895, 1, false, false, '2025-08-15T19:00:00Z', 0, false, false, 4, null, 12, null, 3, 5, 124791, '[]'::jsonb, team_12_uuid, team_4_uuid, null, null, 1, false),
    (2, 2561896, 1, false, false, '2025-08-16T11:30:00Z', 0, false, false, 15, null, 2, null, 3, 4, 124792, '[]'::jsonb, team_2_uuid, team_15_uuid, null, null, 1, false),
    (3, 2561897, 1, false, false, '2025-08-16T14:00:00Z', 0, false, false, 10, null, 6, null, 3, 3, 124793, '[]'::jsonb, team_6_uuid, team_10_uuid, null, null, 1, false),
    (6, 2561900, 1, false, false, '2025-08-16T14:00:00Z', 0, false, false, 3, null, 18, null, 2, 3, 124796, '[]'::jsonb, team_18_uuid, team_3_uuid, null, null, 1, false),
    (5, 2561899, 1, false, false, '2025-08-16T14:00:00Z', 0, false, false, 19, null, 17, null, 2, 2, 124795, '[]'::jsonb, team_17_uuid, team_19_uuid, null, null, 1, false),
    (7, 2561901, 1, false, false, '2025-08-16T16:30:00Z', 0, false, false, 13, null, 20, null, 4, 3, 124797, '[]'::jsonb, team_20_uuid, team_13_uuid, null, null, 1, false),
    (8, 2561902, 1, false, false, '2025-08-17T13:00:00Z', 0, false, false, 1, null, 16, null, 3, 4, 124798, '[]'::jsonb, team_16_uuid, team_1_uuid, null, null, 1, false),
    (9, 2561903, 1, false, false, '2025-08-17T15:30:00Z', 0, false, false, 14, null, 7, null, 4, 5, 124799, '[]'::jsonb, team_7_uuid, team_14_uuid, null, null, 1, false),
    (10, 2561904, 1, false, false, '2025-08-18T15:00:00Z', 0, false, false, 5, null, 9, null, 2, 3, 124800, '[]'::jsonb, team_9_uuid, team_5_uuid, null, null, 1, false);
END $$;