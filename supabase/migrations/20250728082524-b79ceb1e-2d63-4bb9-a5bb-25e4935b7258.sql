-- Update the picks_result_check constraint to use 'loss' instead of 'lose'
ALTER TABLE public.picks DROP CONSTRAINT picks_result_check;

ALTER TABLE public.picks ADD CONSTRAINT picks_result_check 
CHECK (result = ANY (ARRAY['pending'::text, 'win'::text, 'loss'::text, 'draw'::text]));