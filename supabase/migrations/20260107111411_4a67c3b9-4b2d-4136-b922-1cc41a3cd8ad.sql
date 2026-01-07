-- Delete all related data for fa cuptest game, then the game itself
DELETE FROM cup_picks WHERE game_id = '45d6823c-db07-4773-939e-4390c714fc0d';
DELETE FROM cup_fixtures WHERE game_id = '45d6823c-db07-4773-939e-4390c714fc0d';
DELETE FROM game_players WHERE game_id = '45d6823c-db07-4773-939e-4390c714fc0d';
DELETE FROM game_gameweeks WHERE game_id = '45d6823c-db07-4773-939e-4390c714fc0d';
DELETE FROM gameweek_deadlines WHERE game_id = '45d6823c-db07-4773-939e-4390c714fc0d';
DELETE FROM game_winners WHERE game_id = '45d6823c-db07-4773-939e-4390c714fc0d';
DELETE FROM games WHERE id = '45d6823c-db07-4773-939e-4390c714fc0d';