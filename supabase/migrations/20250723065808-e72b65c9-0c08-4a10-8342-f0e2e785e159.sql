-- Update default game status from 'open' to 'active'
ALTER TABLE public.games ALTER COLUMN status SET DEFAULT 'active';