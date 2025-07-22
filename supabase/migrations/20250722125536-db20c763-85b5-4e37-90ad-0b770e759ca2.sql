-- Create game_gameweeks table to track gameweek status per game
CREATE TABLE public.game_gameweeks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL,
  gameweek_id uuid NOT NULL,
  gameweek_number integer NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'active', 'finished')),
  picks_visible boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(game_id, gameweek_number)
);

-- Enable RLS
ALTER TABLE public.game_gameweeks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view game gameweeks"
ON public.game_gameweeks FOR SELECT
USING (true);

CREATE POLICY "Game admins can update game gameweeks"
ON public.game_gameweeks FOR UPDATE
USING (is_game_admin(game_id));

CREATE POLICY "System can insert game gameweeks"
ON public.game_gameweeks FOR INSERT
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_game_gameweeks_updated_at
  BEFORE UPDATE ON public.game_gameweeks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize game gameweeks when a game is created
CREATE OR REPLACE FUNCTION public.initialize_game_gameweeks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  gw_record RECORD;
  next_gameweek_num integer;
BEGIN
  -- Get the next gameweek number
  SELECT gameweek_number INTO next_gameweek_num
  FROM public.gameweeks
  WHERE is_next = true
  LIMIT 1;

  -- If no next gameweek found, use current + 1
  IF next_gameweek_num IS NULL THEN
    SELECT COALESCE(MAX(gameweek_number), 0) + 1 INTO next_gameweek_num
    FROM public.gameweeks;
  END IF;

  -- Create game_gameweek records for all future gameweeks
  FOR gw_record IN 
    SELECT id, gameweek_number
    FROM public.gameweeks 
    WHERE gameweek_number >= next_gameweek_num
    ORDER BY gameweek_number
  LOOP
    INSERT INTO public.game_gameweeks (
      game_id, 
      gameweek_id, 
      gameweek_number,
      status,
      picks_visible
    ) VALUES (
      NEW.id,
      gw_record.id,
      gw_record.gameweek_number,
      CASE 
        WHEN gw_record.gameweek_number = next_gameweek_num THEN 'open'
        ELSE 'upcoming'
      END,
      false
    );
  END LOOP;

  -- Update the game's current_gameweek
  UPDATE public.games 
  SET current_gameweek = next_gameweek_num
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger to initialize game gameweeks when a game is created
CREATE TRIGGER trigger_initialize_game_gameweeks
  AFTER INSERT ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_game_gameweeks();

-- Function to update game gameweek status based on global gameweek changes
CREATE OR REPLACE FUNCTION public.update_game_gameweeks_on_global_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a gameweek becomes current (is_current = true), make it open for all active games
  IF NEW.is_current = true AND (OLD.is_current IS NULL OR OLD.is_current = false) THEN
    UPDATE public.game_gameweeks 
    SET status = 'open',
        picks_visible = false,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number
      AND EXISTS (
        SELECT 1 FROM public.games 
        WHERE games.id = game_gameweeks.game_id 
        AND games.status = 'active'
      );
  END IF;

  -- When a gameweek becomes previous (is_previous = true), finish it for all games
  IF NEW.is_previous = true AND (OLD.is_previous IS NULL OR OLD.is_previous = false) THEN
    UPDATE public.game_gameweeks 
    SET status = 'finished',
        picks_visible = true,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number;
    
    -- Open the next gameweek for active games
    UPDATE public.game_gameweeks 
    SET status = 'open',
        picks_visible = false,
        updated_at = now()
    WHERE gameweek_number = NEW.gameweek_number + 1
      AND EXISTS (
        SELECT 1 FROM public.games 
        WHERE games.id = game_gameweeks.game_id 
        AND games.status = 'active'
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for global gameweek changes
CREATE TRIGGER trigger_update_game_gameweeks_on_global_change
  AFTER UPDATE ON public.gameweeks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_game_gameweeks_on_global_change();

-- Function to check if all users have picked for a game gameweek
CREATE OR REPLACE FUNCTION public.check_all_picks_made(p_game_id uuid, p_gameweek_number integer)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_players integer;
  picks_made integer;
BEGIN
  -- Count total active players in the game
  SELECT COUNT(*)
  INTO total_players
  FROM public.game_players
  WHERE game_id = p_game_id
    AND is_eliminated = false;

  -- Count picks made for this gameweek
  SELECT COUNT(*)
  INTO picks_made
  FROM public.picks
  WHERE game_id = p_game_id
    AND gameweek = p_gameweek_number;

  RETURN total_players = picks_made AND total_players > 0;
END;
$$;

-- Function to activate game gameweek when all picks are made
CREATE OR REPLACE FUNCTION public.maybe_activate_game_gameweek()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if this pick completes all picks for the gameweek
  IF public.check_all_picks_made(NEW.game_id, NEW.gameweek) THEN
    UPDATE public.game_gameweeks
    SET status = 'active',
        picks_visible = true,
        updated_at = now()
    WHERE game_id = NEW.game_id
      AND gameweek_number = NEW.gameweek
      AND status = 'open';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to check for gameweek activation when picks are made
CREATE TRIGGER trigger_maybe_activate_game_gameweek
  AFTER INSERT ON public.picks
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_activate_game_gameweek();

-- Function to process pick results when fixtures are updated
CREATE OR REPLACE FUNCTION public.process_pick_results_on_fixture_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pick_record RECORD;
  is_win boolean;
  is_draw boolean;
BEGIN
  -- Only process if fixture is now finished and wasn't before
  IF NEW.finished = true AND (OLD.finished IS NULL OR OLD.finished = false) THEN
    
    -- Process all picks for this fixture
    FOR pick_record IN
      SELECT p.*, t.name as team_name
      FROM public.picks p
      JOIN public.teams t ON p.team_id = t.id
      WHERE p.fixture_id = NEW.id
    LOOP
      -- Determine pick result
      is_draw := (NEW.home_score = NEW.away_score);
      
      IF pick_record.picked_side = 'home' THEN
        is_win := (NEW.home_score > NEW.away_score);
      ELSIF pick_record.picked_side = 'away' THEN
        is_win := (NEW.home_score < NEW.away_score);
      ELSE
        is_win := false; -- Invalid pick
      END IF;

      -- Update pick result
      UPDATE public.picks
      SET result = CASE
        WHEN is_win THEN 'win'
        WHEN is_draw THEN 'draw'
        ELSE 'loss'
      END
      WHERE id = pick_record.id;

      -- If it's a loss, eliminate the player
      IF NOT is_win AND NOT is_draw THEN
        UPDATE public.game_players
        SET is_eliminated = true,
            eliminated_gameweek = pick_record.gameweek
        WHERE game_id = pick_record.game_id
          AND user_id = pick_record.user_id;
      END IF;
    END LOOP;

    -- Check if any games should be finished after this result
    PERFORM public.check_and_finish_games_after_results(NEW.gameweek);
  END IF;

  RETURN NEW;
END;
$$;

-- Function to check and finish games after results are processed
CREATE OR REPLACE FUNCTION public.check_and_finish_games_after_results(p_gameweek_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  game_record RECORD;
  active_players integer;
BEGIN
  -- Check all active games
  FOR game_record IN
    SELECT DISTINCT g.id, g.name
    FROM public.games g
    JOIN public.picks p ON g.id = p.game_id
    WHERE g.status = 'active'
      AND p.gameweek = p_gameweek_number
  LOOP
    -- Count active (non-eliminated) players
    SELECT COUNT(*)
    INTO active_players
    FROM public.game_players
    WHERE game_id = game_record.id
      AND is_eliminated = false;

    -- Finish game if 1 or 0 players remaining
    IF active_players <= 1 THEN
      UPDATE public.games
      SET status = 'finished'
      WHERE id = game_record.id;
      
      -- Mark all game gameweeks as finished
      UPDATE public.game_gameweeks
      SET status = 'finished',
          picks_visible = true
      WHERE game_id = game_record.id
        AND status IN ('open', 'active');
    END IF;
  END LOOP;
END;
$$;

-- Trigger to process pick results when fixtures are updated
CREATE TRIGGER trigger_process_pick_results_on_fixture_update
  AFTER UPDATE ON public.fixtures
  FOR EACH ROW
  EXECUTE FUNCTION public.process_pick_results_on_fixture_update();

-- Add indexes for performance
CREATE INDEX idx_game_gameweeks_game_id ON public.game_gameweeks(game_id);
CREATE INDEX idx_game_gameweeks_gameweek_number ON public.game_gameweeks(gameweek_number);
CREATE INDEX idx_game_gameweeks_status ON public.game_gameweeks(status);
CREATE INDEX idx_picks_game_gameweek ON public.picks(game_id, gameweek);
CREATE INDEX idx_game_players_game_eliminated ON public.game_players(game_id, is_eliminated);