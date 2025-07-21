-- Create fixtures table for home vs away teams
CREATE TABLE public.fixtures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gameweek INTEGER NOT NULL,
  home_team_id UUID NOT NULL REFERENCES public.teams(id),
  away_team_id UUID NOT NULL REFERENCES public.teams(id),
  home_score INTEGER,
  away_score INTEGER,
  kickoff_time TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gameweek, home_team_id, away_team_id)
);

-- Enable RLS on fixtures
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

-- Create policy for fixtures
CREATE POLICY "Anyone can view fixtures" 
ON public.fixtures 
FOR SELECT 
USING (true);

-- Add columns to games table for gameweek management
ALTER TABLE public.games 
ADD COLUMN starting_gameweek INTEGER DEFAULT 1,
ADD COLUMN current_deadline TIMESTAMP WITH TIME ZONE;

-- Create gameweek_deadlines table to track deadlines for each gameweek
CREATE TABLE public.gameweek_deadlines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  gameweek INTEGER NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, gameweek)
);

-- Enable RLS on gameweek_deadlines
ALTER TABLE public.gameweek_deadlines ENABLE ROW LEVEL SECURITY;

-- Create policies for gameweek_deadlines
CREATE POLICY "Anyone can view gameweek deadlines" 
ON public.gameweek_deadlines 
FOR SELECT 
USING (true);

CREATE POLICY "Game creators can manage deadlines" 
ON public.gameweek_deadlines 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.games 
  WHERE games.id = gameweek_deadlines.game_id 
  AND games.created_by = auth.uid()
));

-- Modify picks table to reference fixtures instead of just teams
ALTER TABLE public.picks 
ADD COLUMN fixture_id UUID REFERENCES public.fixtures(id),
ADD COLUMN picked_side TEXT CHECK (picked_side IN ('home', 'away'));

-- Create function to check if user is game admin
CREATE OR REPLACE FUNCTION public.is_game_admin(game_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.games 
    WHERE id = game_id AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update picks RLS policies to allow game admins to make picks on behalf of users
DROP POLICY IF EXISTS "Users can create their own picks" ON public.picks;
DROP POLICY IF EXISTS "Users can update their own picks" ON public.picks;

CREATE POLICY "Users and game admins can create picks" 
ON public.picks 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR 
  public.is_game_admin(game_id)
);

CREATE POLICY "Users and game admins can update picks" 
ON public.picks 
FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  public.is_game_admin(game_id)
);

-- Create policy for admins to update fixtures results
CREATE POLICY "Game admins can update fixture results" 
ON public.fixtures 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.games 
  WHERE games.created_by = auth.uid()
));

CREATE POLICY "Game admins can insert fixtures" 
ON public.fixtures 
FOR INSERT 
WITH CHECK (true);

-- Add some sample fixtures for gameweek 1
INSERT INTO public.fixtures (gameweek, home_team_id, away_team_id, kickoff_time) 
SELECT 
  1,
  h.id,
  a.id,
  NOW() + INTERVAL '7 days'
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn 
  FROM public.teams 
  LIMIT 10
) h
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn 
  FROM public.teams 
  OFFSET 10 LIMIT 10
) a ON h.rn = a.rn;