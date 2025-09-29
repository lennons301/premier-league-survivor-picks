-- Add admin_fee to games table
ALTER TABLE public.games ADD COLUMN admin_fee numeric(10,2) DEFAULT 0.00;

-- Create game_winners table to track multiple winners (for splits)
CREATE TABLE public.game_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_amount numeric(10,2) NOT NULL,
  is_split boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(game_id, user_id)
);

-- Enable RLS
ALTER TABLE public.game_winners ENABLE ROW LEVEL SECURITY;

-- Anyone can view winners
CREATE POLICY "Anyone can view game winners"
ON public.game_winners FOR SELECT
USING (true);

-- Only game admins can insert winners
CREATE POLICY "Game admins can insert winners"
ON public.game_winners FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = game_winners.game_id
    AND games.created_by = auth.uid()
  )
);

-- Create function to end game as split
CREATE OR REPLACE FUNCTION public.end_game_as_split(
  p_game_id uuid,
  p_admin_fee numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  prize_pot numeric;
  remaining_amount numeric;
  player_count integer;
  split_amount numeric;
  player_record RECORD;
BEGIN
  -- Check if caller is game admin
  IF NOT public.is_game_admin(p_game_id) THEN
    RAISE EXCEPTION 'Access denied. Only game admins can end games.';
  END IF;

  -- Calculate prize pot
  prize_pot := public.calculate_prize_pot(p_game_id);
  
  -- Calculate remaining amount after admin fee
  remaining_amount := prize_pot - p_admin_fee;
  
  IF remaining_amount < 0 THEN
    RAISE EXCEPTION 'Admin fee cannot exceed prize pot';
  END IF;

  -- Count remaining non-eliminated players
  SELECT COUNT(*) INTO player_count
  FROM public.game_players
  WHERE game_id = p_game_id
    AND is_eliminated = false;

  IF player_count = 0 THEN
    RAISE EXCEPTION 'No remaining players to split among';
  END IF;

  -- Calculate split amount per player
  split_amount := remaining_amount / player_count;

  -- Update game status and admin fee
  UPDATE public.games
  SET status = 'finished',
      admin_fee = p_admin_fee,
      updated_at = now()
  WHERE id = p_game_id;

  -- Insert winners for each remaining player
  FOR player_record IN
    SELECT user_id
    FROM public.game_players
    WHERE game_id = p_game_id
      AND is_eliminated = false
  LOOP
    INSERT INTO public.game_winners (game_id, user_id, payout_amount, is_split)
    VALUES (p_game_id, player_record.user_id, split_amount, true);
  END LOOP;

END;
$$;