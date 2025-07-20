-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teams table for Premier League teams
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create games table for Last Man Standing instances
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'finished')),
  current_gameweek INTEGER DEFAULT 1,
  max_players INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game_players table for tracking who's in each game
CREATE TABLE public.game_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_eliminated BOOLEAN DEFAULT FALSE,
  eliminated_gameweek INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id)
);

-- Create picks table for user team selections
CREATE TABLE public.picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  gameweek INTEGER NOT NULL,
  result TEXT CHECK (result IN ('pending', 'win', 'lose', 'draw')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id, gameweek)
);

-- Create gameweeks table for fixture tracking
CREATE TABLE public.gameweeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gameweek_number INTEGER NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gameweek_number)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gameweeks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for teams (read-only for all)
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);

-- Create RLS policies for games
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Users can create games" ON public.games FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Game creators can update their games" ON public.games FOR UPDATE USING (auth.uid() = created_by);

-- Create RLS policies for game_players
CREATE POLICY "Anyone can view game players" ON public.game_players FOR SELECT USING (true);
CREATE POLICY "Users can join games" ON public.game_players FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for picks
CREATE POLICY "Users can view picks in games they're in" ON public.picks FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.game_players 
    WHERE game_id = picks.game_id AND user_id = auth.uid()
  )
);
CREATE POLICY "Users can create their own picks" ON public.picks FOR INSERT 
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own picks" ON public.picks FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for gameweeks
CREATE POLICY "Anyone can view gameweeks" ON public.gameweeks FOR SELECT USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert Premier League teams
INSERT INTO public.teams (name, short_name) VALUES
('Arsenal', 'ARS'),
('Aston Villa', 'AVL'),
('Bournemouth', 'BOU'),
('Brentford', 'BRE'),
('Brighton & Hove Albion', 'BHA'),
('Chelsea', 'CHE'),
('Crystal Palace', 'CRY'),
('Everton', 'EVE'),
('Fulham', 'FUL'),
('Ipswich Town', 'IPS'),
('Leicester City', 'LEI'),
('Liverpool', 'LIV'),
('Manchester City', 'MCI'),
('Manchester United', 'MUN'),
('Newcastle United', 'NEW'),
('Nottingham Forest', 'NFO'),
('Southampton', 'SOU'),
('Tottenham Hotspur', 'TOT'),
('West Ham United', 'WHU'),
('Wolverhampton Wanderers', 'WOL');