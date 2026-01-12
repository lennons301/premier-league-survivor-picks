
-- Insert pick for Sto (Wolves, away side) in gameweek 21
-- The fixture was a 1-1 draw, so in classic mode this is a loss
INSERT INTO picks (game_id, user_id, fixture_id, team_id, picked_side, gameweek, result, goals_scored)
VALUES (
  'af26e727-477d-48fe-806f-895914fd3847',  -- game_id (New Year New LPS)
  '689768df-057a-41b5-98d8-a97247ae4365',  -- user_id (Sto)
  'e029006d-2cf4-407b-a29c-12636059b7fb',  -- fixture_id (Everton vs Wolves GW21)
  '39ef367e-7b2e-4038-b4ee-3fb54fc5f31b',  -- team_id (Wolves)
  'away',                                   -- picked_side
  21,                                       -- gameweek
  'loss',                                   -- result (draw in classic = loss)
  0                                         -- goals_scored
);

-- Eliminate Sto in gameweek 21
UPDATE game_players
SET is_eliminated = true, eliminated_gameweek = 21
WHERE game_id = 'af26e727-477d-48fe-806f-895914fd3847'
  AND user_id = '689768df-057a-41b5-98d8-a97247ae4365';
