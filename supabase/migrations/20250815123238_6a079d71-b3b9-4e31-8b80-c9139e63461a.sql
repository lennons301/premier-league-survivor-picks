-- Add RLS policy to allow game admins to delete players from their games
CREATE POLICY "Game admins can remove players from their games" 
ON public.game_players 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = game_players.game_id 
    AND games.created_by = auth.uid()
  )
);

-- Add RLS policy to allow game admins to update players in their games
CREATE POLICY "Game admins can update players in their games" 
ON public.game_players 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = game_players.game_id 
    AND games.created_by = auth.uid()
  )
);