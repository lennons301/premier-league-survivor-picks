-- Update the game_players insert policy to allow game admins to add users
DROP POLICY IF EXISTS "Users can join games" ON public.game_players;

CREATE POLICY "Users and game admins can join games" 
ON public.game_players 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.games 
    WHERE id = game_id AND created_by = auth.uid()
  )
);