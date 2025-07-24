-- Remove the automatic activation trigger
DROP TRIGGER IF EXISTS maybe_activate_game_gameweek_trigger ON picks;

-- Update the function to not automatically activate when all picks are made
-- This function will now only be called manually or when deadlines pass
CREATE OR REPLACE FUNCTION public.maybe_activate_game_gameweek()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- This function is now only for manual activation or deadline-based activation
  -- No longer automatically activates when all picks are made
  RETURN NEW;
END;
$function$;

-- Create a new function to check and activate gameweeks based on deadlines
CREATE OR REPLACE FUNCTION public.activate_gameweeks_past_deadline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Activate gameweeks where the deadline has passed
  UPDATE public.game_gameweeks
  SET status = 'active',
      picks_visible = true,
      updated_at = now()
  WHERE status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.gameweeks gw
      WHERE gw.gameweek_number = game_gameweeks.gameweek_number
      AND gw.deadline < now()
    );
END;
$function$;

-- Enable pg_cron extension for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the deadline checker to run every minute
SELECT cron.schedule(
  'check-gameweek-deadlines',
  '* * * * *', -- every minute
  $$
  SELECT public.activate_gameweeks_past_deadline();
  $$
);