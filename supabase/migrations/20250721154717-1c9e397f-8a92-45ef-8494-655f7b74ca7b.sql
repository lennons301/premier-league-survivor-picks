-- Clear existing game data for testing
DELETE FROM picks;
DELETE FROM game_players;  
DELETE FROM games;
DELETE FROM gameweek_deadlines;

-- Reset fixture results to clear scores and completion status
UPDATE fixtures SET 
  home_score = NULL,
  away_score = NULL,
  team_h_score = NULL,
  team_a_score = NULL,
  is_completed = false,
  finished = false,
  finished_provisional = false,
  started = false,
  minutes = 0;

-- Keep only first 10 gameweeks of fixtures for testing
DELETE FROM fixtures WHERE gameweek > 10;

-- Keep only first 10 gameweeks 
DELETE FROM gameweeks WHERE gameweek_number > 10;