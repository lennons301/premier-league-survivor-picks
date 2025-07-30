-- Clear all game data while preserving user profiles
-- This script only removes game-related data, keeping users and teams/fixtures/gameweeks intact

DELETE FROM public.picks;
DELETE FROM public.game_players;
DELETE FROM public.gameweek_deadlines;
DELETE FROM public.game_gameweeks;
DELETE FROM public.games;
