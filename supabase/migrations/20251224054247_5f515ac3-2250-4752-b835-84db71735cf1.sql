-- Allow 'draw' as a valid picked_side for turbo mode predictions
ALTER TABLE public.picks
  DROP CONSTRAINT IF EXISTS picks_picked_side_check;

ALTER TABLE public.picks
  ADD CONSTRAINT picks_picked_side_check
  CHECK (picked_side = ANY (ARRAY['home'::text, 'away'::text, 'draw'::text]));