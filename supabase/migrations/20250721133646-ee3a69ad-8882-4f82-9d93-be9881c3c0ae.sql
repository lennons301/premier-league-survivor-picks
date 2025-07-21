-- Clear existing data and populate with real FPL data
-- This migration will reset all test data and populate with actual Premier League data

-- Clear existing data (in order to avoid foreign key conflicts)
DELETE FROM public.picks;
DELETE FROM public.game_players;
DELETE FROM public.games;
DELETE FROM public.gameweek_deadlines;
DELETE FROM public.fixtures;
DELETE FROM public.gameweeks;
DELETE FROM public.teams;

-- Insert real Premier League teams with FPL IDs
INSERT INTO public.teams (fpl_team_id, name, short_name, code) VALUES
(1, 'Arsenal', 'ARS', 3),
(2, 'Aston Villa', 'AVL', 7),
(3, 'Bournemouth', 'BOU', 91),
(4, 'Brentford', 'BRE', 94),
(5, 'Brighton & Hove Albion', 'BHA', 36),
(6, 'Chelsea', 'CHE', 8),
(7, 'Crystal Palace', 'CRY', 31),
(8, 'Everton', 'EVE', 11),
(9, 'Fulham', 'FUL', 54),
(10, 'Ipswich Town', 'IPS', 40),
(11, 'Leicester City', 'LEI', 13),
(12, 'Liverpool', 'LIV', 14),
(13, 'Manchester City', 'MCI', 43),
(14, 'Manchester United', 'MUN', 1),
(15, 'Newcastle United', 'NEW', 4),
(16, 'Nottingham Forest', 'NFO', 17),
(17, 'Southampton', 'SOU', 20),
(18, 'Tottenham Hotspur', 'TOT', 6),
(19, 'West Ham United', 'WHU', 21),
(20, 'Wolverhampton Wanderers', 'WOL', 39);

-- Insert gameweeks (current season schedule)
INSERT INTO public.gameweeks (fpl_event_id, name, deadline, gameweek_number, is_current, finished) VALUES
(1, 'Gameweek 1', '2024-08-16 17:30:00+00', 1, false, true),
(2, 'Gameweek 2', '2024-08-24 10:30:00+00', 2, false, true),
(3, 'Gameweek 3', '2024-08-31 10:30:00+00', 3, false, true),
(4, 'Gameweek 4', '2024-09-14 10:30:00+00', 4, false, true),
(5, 'Gameweek 5', '2024-09-21 10:30:00+00', 5, false, true),
(6, 'Gameweek 6', '2024-09-28 10:30:00+00', 6, false, true),
(7, 'Gameweek 7', '2024-10-05 10:30:00+00', 7, false, true),
(8, 'Gameweek 8', '2024-10-19 10:30:00+00', 8, false, true),
(9, 'Gameweek 9', '2024-10-26 10:30:00+00', 9, false, true),
(10, 'Gameweek 10', '2024-11-02 11:30:00+00', 10, false, true),
(11, 'Gameweek 11', '2024-11-09 11:30:00+00', 11, false, true),
(12, 'Gameweek 12', '2024-11-23 11:30:00+00', 12, false, true),
(13, 'Gameweek 13', '2024-11-30 11:30:00+00', 13, false, true),
(14, 'Gameweek 14', '2024-12-03 17:30:00+00', 14, false, true),
(15, 'Gameweek 15', '2024-12-07 11:30:00+00', 15, false, true),
(16, 'Gameweek 16', '2024-12-14 11:30:00+00', 16, false, true),
(17, 'Gameweek 17', '2024-12-21 11:30:00+00', 17, false, true),
(18, 'Gameweek 18', '2024-12-26 11:30:00+00', 18, false, true),
(19, 'Gameweek 19', '2024-12-29 11:30:00+00', 19, false, true),
(20, 'Gameweek 20', '2025-01-04 11:30:00+00', 20, false, true),
(21, 'Gameweek 21', '2025-01-14 17:30:00+00', 21, true, false),
(22, 'Gameweek 22', '2025-01-18 11:30:00+00', 22, false, false),
(23, 'Gameweek 23', '2025-01-25 11:30:00+00', 23, false, false),
(24, 'Gameweek 24', '2025-02-01 11:30:00+00', 24, false, false),
(25, 'Gameweek 25', '2025-02-15 11:30:00+00', 25, false, false),
(26, 'Gameweek 26', '2025-02-22 11:30:00+00', 26, false, false),
(27, 'Gameweek 27', '2025-03-08 11:30:00+00', 27, false, false),
(28, 'Gameweek 28', '2025-03-15 11:30:00+00', 28, false, false),
(29, 'Gameweek 29', '2025-04-02 16:30:00+00', 29, false, false),
(30, 'Gameweek 30', '2025-04-05 10:30:00+00', 30, false, false),
(31, 'Gameweek 31', '2025-04-12 10:30:00+00', 31, false, false),
(32, 'Gameweek 32', '2025-04-19 10:30:00+00', 32, false, false),
(33, 'Gameweek 33', '2025-04-26 10:30:00+00', 33, false, false),
(34, 'Gameweek 34', '2025-05-03 10:30:00+00', 34, false, false),
(35, 'Gameweek 35', '2025-05-10 10:30:00+00', 35, false, false),
(36, 'Gameweek 36', '2025-05-17 10:30:00+00', 36, false, false),
(37, 'Gameweek 37', '2025-05-24 10:30:00+00', 37, false, false),
(38, 'Gameweek 38', '2025-05-25 14:00:00+00', 38, false, false);

-- Sample fixtures for current gameweek (21) with some results
-- Get team UUIDs for fixture creation
DO $$
DECLARE
    arsenal_id UUID;
    liverpool_id UUID;
    city_id UUID;
    united_id UUID;
    chelsea_id UUID;
    tottenham_id UUID;
    newcastle_id UUID;
    brighton_id UUID;
    villa_id UUID;
    west_ham_id UUID;
    crystal_palace_id UUID;
    everton_id UUID;
    fulham_id UUID;
    brentford_id UUID;
    bournemouth_id UUID;
    wolves_id UUID;
    forest_id UUID;
    ipswich_id UUID;
    leicester_id UUID;
    southampton_id UUID;
BEGIN
    -- Get team IDs
    SELECT id INTO arsenal_id FROM public.teams WHERE fpl_team_id = 1;
    SELECT id INTO liverpool_id FROM public.teams WHERE fpl_team_id = 12;
    SELECT id INTO city_id FROM public.teams WHERE fpl_team_id = 13;
    SELECT id INTO united_id FROM public.teams WHERE fpl_team_id = 14;
    SELECT id INTO chelsea_id FROM public.teams WHERE fpl_team_id = 6;
    SELECT id INTO tottenham_id FROM public.teams WHERE fpl_team_id = 18;
    SELECT id INTO newcastle_id FROM public.teams WHERE fpl_team_id = 15;
    SELECT id INTO brighton_id FROM public.teams WHERE fpl_team_id = 5;
    SELECT id INTO villa_id FROM public.teams WHERE fpl_team_id = 2;
    SELECT id INTO west_ham_id FROM public.teams WHERE fpl_team_id = 19;
    SELECT id INTO crystal_palace_id FROM public.teams WHERE fpl_team_id = 7;
    SELECT id INTO everton_id FROM public.teams WHERE fpl_team_id = 8;
    SELECT id INTO fulham_id FROM public.teams WHERE fpl_team_id = 9;
    SELECT id INTO brentford_id FROM public.teams WHERE fpl_team_id = 4;
    SELECT id INTO bournemouth_id FROM public.teams WHERE fpl_team_id = 3;
    SELECT id INTO wolves_id FROM public.teams WHERE fpl_team_id = 20;
    SELECT id INTO forest_id FROM public.teams WHERE fpl_team_id = 16;
    SELECT id INTO ipswich_id FROM public.teams WHERE fpl_team_id = 10;
    SELECT id INTO leicester_id FROM public.teams WHERE fpl_team_id = 11;
    SELECT id INTO southampton_id FROM public.teams WHERE fpl_team_id = 17;

    -- Insert fixtures for GW21 (current gameweek)
    INSERT INTO public.fixtures (gameweek, home_team_id, away_team_id, kickoff_time, fpl_fixture_id, team_h, team_a, event) VALUES
    (21, arsenal_id, crystal_palace_id, '2025-01-15 19:30:00+00', 6001, 1, 7, 21),
    (21, brighton_id, everton_id, '2025-01-15 17:30:00+00', 6002, 5, 8, 21),
    (21, city_id, chelsea_id, '2025-01-18 17:30:00+00', 6003, 13, 6, 21),
    (21, newcastle_id, bournemouth_id, '2025-01-18 15:00:00+00', 6004, 15, 3, 21),
    (21, forest_id, liverpool_id, '2025-01-14 20:00:00+00', 6005, 16, 12, 21),
    (21, southampton_id, tottenham_id, '2025-01-19 14:00:00+00', 6006, 17, 18, 21),
    (21, west_ham_id, fulham_id, '2025-01-14 19:45:00+00', 6007, 19, 9, 21),
    (21, wolves_id, arsenal_id, '2025-01-25 15:00:00+00', 6008, 20, 1, 21),
    (21, ipswich_id, united_id, '2025-01-19 16:30:00+00', 6009, 10, 14, 21),
    (21, leicester_id, brentford_id, '2025-01-19 14:00:00+00', 6010, 11, 4, 21);

    -- Some completed fixtures with results for testing
    UPDATE public.fixtures 
    SET home_score = 1, away_score = 1, is_completed = true, finished = true 
    WHERE fpl_fixture_id = 6005; -- Forest 1-1 Liverpool

    UPDATE public.fixtures 
    SET home_score = 3, away_score = 2, is_completed = true, finished = true 
    WHERE fpl_fixture_id = 6007; -- West Ham 3-2 Fulham
END $$;

-- Create a test game for development
INSERT INTO public.games (name, status, current_gameweek, starting_gameweek, created_by) 
VALUES ('Development Test Game', 'active', 21, 21, '11111111-1111-1111-1111-111111111111');

-- Add some test players to the game
DO $$
DECLARE
    game_id UUID;
BEGIN
    SELECT id INTO game_id FROM public.games WHERE name = 'Development Test Game';
    
    INSERT INTO public.game_players (game_id, user_id) VALUES
    (game_id, '11111111-1111-1111-1111-111111111111'),
    (game_id, '22222222-2222-2222-2222-222222222222'),
    (game_id, '33333333-3333-3333-3333-333333333333'),
    (game_id, '44444444-4444-4444-4444-444444444444'),
    (game_id, '55555555-5555-5555-5555-555555555555');
END $$;