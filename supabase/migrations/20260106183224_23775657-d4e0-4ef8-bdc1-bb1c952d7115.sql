-- Reset FA Cup test game to 'open' status
UPDATE games SET status = 'open' WHERE id = '45d6823c-db07-4773-939e-4390c714fc0d';

-- Reset completed turbo games to their starting gameweek
UPDATE games SET current_gameweek = starting_gameweek WHERE id IN (
  '736199f5-0cbd-4580-8dbb-8c6d0cdcebdb',  -- GW19 Lightning -> 19
  'fb0cafce-7cab-4f83-b78f-f4644545a960',  -- GW20 Rollover -> 20
  'cb679f10-79d3-483d-b690-94a385661333'   -- Boxing Day -> 18
);