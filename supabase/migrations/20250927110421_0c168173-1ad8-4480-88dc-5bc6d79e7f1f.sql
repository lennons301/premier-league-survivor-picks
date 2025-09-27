-- Create function for game admins to insert picks for users
CREATE OR REPLACE FUNCTION public.admin_insert_pick(
  p_game_id uuid,
  p_user_id uuid,
  p_fixture_id uuid,
  p_team_id uuid,
  p_picked_side text,
  p_gameweek integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  pick_id uuid;
BEGIN
  -- Check if caller is game admin
  IF NOT public.is_game_admin(p_game_id) THEN
    RAISE EXCEPTION 'Access denied. Only game admins can insert picks for users.';
  END IF;

  -- Insert the pick
  INSERT INTO public.picks (
    game_id,
    user_id,
    fixture_id,
    team_id,
    picked_side,
    gameweek
  ) VALUES (
    p_game_id,
    p_user_id,
    p_fixture_id,
    p_team_id,
    p_picked_side,
    p_gameweek
  ) RETURNING id INTO pick_id;

  RETURN pick_id;
END;
$function$;