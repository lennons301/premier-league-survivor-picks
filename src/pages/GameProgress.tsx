import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Users, Clock, Lock, Crown, Banknote } from "lucide-react";
import PickHistory from "@/components/PickHistory";

export default function GameProgress() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  // Fetch game details with prize pot
  const { data: game } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (error) throw error;

      // Get prize pot
      const { data: prizePot } = await supabase
        .rpc("calculate_prize_pot", { p_game_id: gameId });

      // Get winner if game is finished
      let winner = null;
      if (data.status === 'finished') {
        const { data: winnerUserId } = await supabase
          .rpc("get_game_winner", { p_game_id: gameId });
        if (winnerUserId) {
          const { data: winnerProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", winnerUserId)
            .single();
          winner = winnerProfile;
        }
      }

      return { 
        ...data, 
        prize_pot: prizePot,
        winner: winner
      };
    },
  });

  // Fetch game players with their current status
  const { data: players } = useQuery({
    queryKey: ["game-players", gameId],
    queryFn: async () => {
      const { data: gamePlayersData, error } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .order("joined_at");
      if (error) throw error;
      
      if (!gamePlayersData || gamePlayersData.length === 0) return [];
      
      // Fetch profiles separately
      const userIds = gamePlayersData.map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      
      // Merge the data
      return gamePlayersData.map(player => ({
        ...player,
        profiles: profilesData?.find(p => p.user_id === player.user_id)
      }));
    },
  });

  // Fetch current gameweek info
  const { data: currentGameweek } = useQuery({
    queryKey: ["current-gameweek"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gameweeks")
        .select("*")
        .eq("is_current", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch game gameweek status
  const { data: gameGameweek } = useQuery({
    queryKey: ["game-gameweek", gameId, game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return null;
      const { data, error } = await supabase
        .from("game_gameweeks")
        .select("*")
        .eq("game_id", gameId)
        .eq("gameweek_number", game.current_gameweek)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!game?.current_gameweek,
  });

  // Fetch all game gameweeks for pick history
  const { data: allGameGameweeks } = useQuery({
    queryKey: ["all-game-gameweeks", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_gameweeks")
        .select("*")
        .eq("game_id", gameId)
        .order("gameweek_number");
      if (error) throw error;
      return data;
    },
    enabled: !!gameId,
  });

  // Fetch all picks for this game with results
  const { data: allPicks } = useQuery({
    queryKey: ["game-picks", gameId],
    queryFn: async () => {
      const { data: picksData, error } = await supabase
        .from("picks")
        .select(`
          *,
          teams (name, short_name),
          fixtures (
            home_team:teams!fixtures_home_team_id_fkey (name, short_name),
            away_team:teams!fixtures_away_team_id_fkey (name, short_name),
            home_score,
            away_score,
            is_completed
          )
        `)
        .eq("game_id", gameId)
        .order("gameweek", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      
      if (!picksData || picksData.length === 0) return [];
      
      // Fetch profiles separately
      const userIds = [...new Set(picksData.map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      
      // Merge the data
      return picksData.map(pick => ({
        ...pick,
        profiles: profilesData?.find(p => p.user_id === pick.user_id)
      }));
    },
  });

  // Calculate statistics
  const activePlayers = players?.filter(p => !p.is_eliminated) || [];
  const eliminatedPlayers = players?.filter(p => p.is_eliminated) || [];

  

  if (!game) {
    return <div>Loading...</div>;
  }

  // Check if user is admin
  const isAdmin = user && game && game.created_by === user.id;


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/games/${gameId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Game
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{game.name} - Progress</h1>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">Current Gameweek: {game.current_gameweek}</p>
            {gameGameweek && (
              <Badge variant={
                gameGameweek.status === 'open' ? 'secondary' : 
                gameGameweek.status === 'active' ? 'default' : 
                'outline'
              }>
                {gameGameweek.status === 'open' && <Clock className="h-3 w-3 mr-1" />}
                {gameGameweek.status === 'active' && <Lock className="h-3 w-3 mr-1" />}
                {gameGameweek.status}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Game Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePlayers.length}</div>
            <p className="text-xs text-muted-foreground">
              {eliminatedPlayers.length} eliminated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Game Status</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{game.status}</div>
            <p className="text-xs text-muted-foreground">
              Started GW{game.starting_gameweek}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prize Pot</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{game.prize_pot ? Number(game.prize_pot).toFixed(2) : '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              £10 entry + rebuys
            </p>
          </CardContent>
        </Card>

        {game.status === 'finished' && game.winner && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Winner</CardTitle>
              <Crown className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{game.winner.display_name}</div>
              <p className="text-xs text-muted-foreground">
                Congratulations!
              </p>
            </CardContent>
          </Card>
        )}
      </div>


      {/* Pick History */}
      <PickHistory 
        allPicks={allPicks || []} 
        players={players || []} 
        currentGameweek={game.current_gameweek || 1}
        gameGameweeks={allGameGameweeks || []}
        gamePlayers={players || []}
        game={game}
        gameGameweek={gameGameweek}
      />
    </div>
  );
}