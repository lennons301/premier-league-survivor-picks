-- Clear existing games and picks data
DELETE FROM public.picks;
DELETE FROM public.game_players;
DELETE FROM public.games;

-- Clear existing fixtures
DELETE FROM public.fixtures;

-- Generate 10 weeks of fixtures (GW1-GW10)
-- Create a more comprehensive fixture list with proper home/away rotation
INSERT INTO public.fixtures (gameweek, home_team_id, away_team_id, kickoff_time) 
WITH team_pairs AS (
  SELECT 
    t1.id as team1_id,
    t2.id as team2_id,
    ROW_NUMBER() OVER (ORDER BY t1.name, t2.name) as pair_num
  FROM public.teams t1
  JOIN public.teams t2 ON t1.id != t2.id AND t1.name < t2.name
  LIMIT 95 -- Ensure we have enough unique pairs for 10 gameweeks (each with ~10 fixtures)
),
gameweek_fixtures AS (
  SELECT 
    ((pair_num - 1) % 10) + 1 as gameweek,
    CASE 
      WHEN ((pair_num - 1) / 10) % 2 = 0 THEN team1_id 
      ELSE team2_id 
    END as home_team_id,
    CASE 
      WHEN ((pair_num - 1) / 10) % 2 = 0 THEN team2_id 
      ELSE team1_id 
    END as away_team_id,
    pair_num
  FROM team_pairs
  WHERE pair_num <= 100 -- 10 fixtures per gameweek for 10 gameweeks
)
SELECT 
  gameweek,
  home_team_id,
  away_team_id,
  NOW() + INTERVAL '1 day' * gameweek as kickoff_time
FROM gameweek_fixtures
ORDER BY gameweek, pair_num;