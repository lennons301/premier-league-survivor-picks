-- Create helper function to get users without picks for a specific gameweek
CREATE OR REPLACE FUNCTION public.get_users_without_picks(p_game_id uuid, p_gameweek integer)
RETURNS TABLE(
  user_id uuid,
  display_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    gp.user_id,
    p.display_name
  FROM public.game_players gp
  JOIN public.profiles p ON gp.user_id = p.user_id
  WHERE gp.game_id = p_game_id
    AND gp.is_eliminated = false
    AND NOT EXISTS (
      SELECT 1 FROM public.picks
      WHERE game_id = p_game_id
        AND user_id = gp.user_id 
        AND gameweek = p_gameweek
    );
$$;