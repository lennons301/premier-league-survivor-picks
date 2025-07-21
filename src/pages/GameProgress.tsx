import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Users, Target } from "lucide-react";

export default function GameProgress() {
  const { gameId } = useParams<{ gameId: string }>();

  // Fetch game details
  const { data: game } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (error) throw error;
      return data;
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
  const totalGoalsScored = allPicks?.reduce((sum, pick) => {
    if (pick.result === 'success' && pick.fixtures?.is_completed) {
      const goals = pick.picked_side === 'home' 
        ? pick.fixtures.home_score || 0
        : pick.fixtures.away_score || 0;
      return sum + goals;
    }
    return sum;
  }, 0) || 0;

  if (!game) {
    return <div>Loading...</div>;
  }

  // Group picks by gameweek
  const picksByGameweek = allPicks?.reduce((acc, pick) => {
    if (!acc[pick.gameweek]) {
      acc[pick.gameweek] = [];
    }
    acc[pick.gameweek].push(pick);
    return acc;
  }, {} as Record<number, typeof allPicks>) || {};

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
          <p className="text-muted-foreground">Current Gameweek: {game.current_gameweek}</p>
        </div>
      </div>

      {/* Game Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGoalsScored}</div>
            <p className="text-xs text-muted-foreground">
              From successful picks
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
      </div>

      {/* Player Status */}
      <Card>
        <CardHeader>
          <CardTitle>Player Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-green-600 mb-2">Active Players ({activePlayers.length})</h4>
              <div className="flex flex-wrap gap-2">
                {activePlayers.map((player) => (
                  <Badge key={player.id} variant="secondary" className="bg-green-100 text-green-800">
                    {player.profiles?.display_name}
                  </Badge>
                ))}
              </div>
            </div>

            {eliminatedPlayers.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-600 mb-2">Eliminated Players ({eliminatedPlayers.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {eliminatedPlayers.map((player) => (
                    <Badge key={player.id} variant="destructive">
                      {player.profiles?.display_name} (GW{player.eliminated_gameweek})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gameweek Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Pick Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(picksByGameweek)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([gameweek, picks]) => (
                <div key={gameweek} className="border-l-2 border-muted pl-4">
                  <h4 className="font-semibold mb-3">Gameweek {gameweek}</h4>
                  <div className="grid gap-2">
                    {picks.map((pick) => (
                      <div
                        key={pick.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">
                            {pick.profiles?.display_name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            picked {pick.teams?.name}
                          </span>
                          {pick.fixtures && (
                            <span className="text-xs text-muted-foreground">
                              vs {pick.picked_side === 'home' 
                                ? pick.fixtures.away_team?.name 
                                : pick.fixtures.home_team?.name
                              } ({pick.picked_side})
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {pick.fixtures?.is_completed && (
                            <span className="text-sm text-muted-foreground">
                              {pick.fixtures.home_score}-{pick.fixtures.away_score}
                            </span>
                          )}
                          <Badge
                            variant={
                              pick.result === 'success' 
                                ? 'default' 
                                : pick.result === 'failure' 
                                ? 'destructive' 
                                : 'secondary'
                            }
                            className={
                              pick.result === 'success'
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : ''
                            }
                          >
                            {pick.result === 'success' && pick.fixtures?.is_completed
                              ? `${pick.picked_side === 'home' 
                                  ? pick.fixtures.home_score 
                                  : pick.fixtures.away_score} goals`
                              : pick.result || 'pending'
                            }
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}