-- Allow multiple picks per user per gameweek (required for turbo & escalating modes)
-- Old constraint enforced a single pick per gameweek.
ALTER TABLE public.picks
  DROP CONSTRAINT IF EXISTS picks_game_id_user_id_gameweek_key;

-- Prevent duplicate picks for the same fixture within a gameweek
ALTER TABLE public.picks
  ADD CONSTRAINT picks_game_id_user_id_gameweek_fixture_id_key
  UNIQUE (game_id, user_id, gameweek, fixture_id);
