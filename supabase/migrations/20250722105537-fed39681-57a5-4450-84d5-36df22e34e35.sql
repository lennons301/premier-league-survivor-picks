-- Clear all game data while preserving user profiles
DELETE FROM public.picks;
DELETE FROM public.game_players;
DELETE FROM public.gameweek_deadlines;
DELETE FROM public.games;
DELETE FROM public.fixtures;
DELETE FROM public.gameweeks;
DELETE FROM public.teams;