-- Add missing columns and functions for prize pot and winners

-- Add entry_fee and winner_id columns to games table
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS entry_fee decimal(10,2) DEFAULT 10.00 NOT NULL,
ADD COLUMN IF NOT EXISTS winner_id uuid DEFAULT NULL;

-- Create user_stats table for tracking user statistics
CREATE TABLE IF NOT EXISTS public.user_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  total_games_played integer DEFAULT 0 NOT NULL,
  total_games_won integer DEFAULT 0 NOT NULL,
  total_picks_made integer DEFAULT 0 NOT NULL,
  total_successful_picks integer DEFAULT 0 NOT NULL,
  total_rebuys integer DEFAULT 0 NOT NULL,
  total_prize_money decimal(10,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_stats
CREATE POLICY "Users can view their own stats" 
ON public.user_stats 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats" 
ON public.user_stats 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats" 
ON public.user_stats 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add updated_at trigger for user_stats
CREATE TRIGGER update_user_stats_updated_at
BEFORE UPDATE ON public.user_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get the winner of a game
CREATE OR REPLACE FUNCTION public.get_game_winner(p_game_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  winner_user_id uuid;
BEGIN
  -- Get the winner from the winner_id field first
  SELECT winner_id INTO winner_user_id
  FROM public.games
  WHERE id = p_game_id AND status = 'finished' AND winner_id IS NOT NULL;

  -- If no winner_id set, find the last remaining active player
  IF winner_user_id IS NULL THEN
    SELECT user_id INTO winner_user_id
    FROM public.game_players
    WHERE game_id = p_game_id 
      AND is_eliminated = false
    LIMIT 1;
  END IF;

  RETURN winner_user_id;
END;
$function$

-- Function to update user stats (called when games finish)
CREATE OR REPLACE FUNCTION public.update_user_stats_on_game_finish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  winner_user_id uuid;
  game_prize decimal(10,2);
BEGIN
  -- Only process when game status changes to finished
  IF NEW.status = 'finished' AND (OLD.status IS NULL OR OLD.status != 'finished') THEN
    
    -- Get the winner
    winner_user_id := public.get_game_winner(NEW.id);
    
    -- Update the winner_id in the game if not already set
    IF winner_user_id IS NOT NULL AND NEW.winner_id IS NULL THEN
      UPDATE public.games 
      SET winner_id = winner_user_id 
      WHERE id = NEW.id;
    END IF;
    
    -- Calculate prize pot
    SELECT public.calculate_prize_pot(NEW.id) INTO game_prize;
    
    -- Update stats for all players who participated
    INSERT INTO public.user_stats (user_id, total_games_played, total_games_won, total_prize_money)
    SELECT 
      gp.user_id,
      1,
      CASE WHEN gp.user_id = winner_user_id THEN 1 ELSE 0 END,
      CASE WHEN gp.user_id = winner_user_id THEN game_prize ELSE 0 END
    FROM public.game_players gp
    WHERE gp.game_id = NEW.id
    ON CONFLICT (user_id) DO UPDATE SET
      total_games_played = user_stats.total_games_played + 1,
      total_games_won = user_stats.total_games_won + CASE WHEN EXCLUDED.user_id = winner_user_id THEN 1 ELSE 0 END,
      total_prize_money = user_stats.total_prize_money + CASE WHEN EXCLUDED.user_id = winner_user_id THEN game_prize ELSE 0 END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$

-- Create trigger for updating user stats when games finish
DROP TRIGGER IF EXISTS update_user_stats_on_game_finish ON public.games;
CREATE TRIGGER update_user_stats_on_game_finish
  AFTER UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_stats_on_game_finish();