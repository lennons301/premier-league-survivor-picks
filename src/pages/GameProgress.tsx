import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Trophy, Users, Target, ChevronDown, ChevronUp, Check, X, Clock, Lock } from "lucide-react";
import { useState, useMemo } from "react";
import PickHistory from "@/components/PickHistory";

export default function GameProgress() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<'name' | 'goals' | 'status'>('goals');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  // Calculate statistics and user progress
  const activePlayers = players?.filter(p => !p.is_eliminated) || [];
  const eliminatedPlayers = players?.filter(p => p.is_eliminated) || [];
  
  // Calculate cumulative goals per user
  const userProgress = useMemo(() => {
    if (!players || !allPicks) return [];
    
    return players.map(player => {
      const userPicks = allPicks.filter(pick => pick.user_id === player.user_id);
      const currentGameweekPick = userPicks.find(pick => pick.gameweek === game?.current_gameweek);
      
      const cumulativeGoals = userPicks.reduce((sum, pick) => {
        console.log('🔍 Pick debug:', {
          user: player.profiles?.display_name,
          gameweek: pick.gameweek,
          result: pick.result,
          completed: pick.fixtures?.is_completed,
          homeScore: pick.fixtures?.home_score,
          awayScore: pick.fixtures?.away_score,
          pickedSide: pick.picked_side,
          multiplier: pick.multiplier
        });
        
        if (pick.fixtures?.is_completed && pick.fixtures.home_score !== null && pick.fixtures.away_score !== null) {
          // Check if this pick resulted in elimination
          const isEliminating = pick.result === 'lose' && pick.gameweek > (game?.starting_gameweek || 1);
          
          if (!isEliminating) {
            const goals = pick.picked_side === 'home' 
              ? pick.fixtures.home_score || 0
              : pick.fixtures.away_score || 0;
            const goalCount = goals * (pick.multiplier || 1);
            console.log('✅ Adding goals:', goalCount, 'for', player.profiles?.display_name, 'result:', pick.result);
            return sum + goalCount;
          } else {
            console.log('❌ Skipping goals for eliminating pick:', player.profiles?.display_name);
          }
        }
        return sum;
      }, 0);
      
      const gameweekResults = userPicks.reduce((acc, pick) => {
        if (!acc[pick.gameweek]) acc[pick.gameweek] = [];
        acc[pick.gameweek].push(pick);
        return acc;
      }, {} as Record<number, typeof userPicks>);
      
      return {
        ...player,
        cumulativeGoals,
        gameweekResults,
        totalPicks: userPicks.length,
        winningPicks: userPicks.filter(p => p.result === 'win').length,
        hasCurrentGameweekPick: !!currentGameweekPick,
        currentGameweekPick: currentGameweekPick
      };
    });
  }, [players, allPicks, game?.current_gameweek]);

  // Sort users
  const sortedUsers = useMemo(() => {
    const sorted = [...userProgress].sort((a, b) => {
      let compareValue = 0;
      if (sortBy === 'name') {
        compareValue = (a.profiles?.display_name || '').localeCompare(b.profiles?.display_name || '');
      } else if (sortBy === 'goals') {
        compareValue = a.cumulativeGoals - b.cumulativeGoals;
      } else if (sortBy === 'status') {
        compareValue = Number(a.is_eliminated) - Number(b.is_eliminated);
      }
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    return sorted;
  }, [userProgress, sortBy, sortOrder]);

  

  if (!game) {
    return <div>Loading...</div>;
  }

  // Check if user is admin
  const isAdmin = user && game && game.created_by === user.id;

  const handleSort = (column: 'name' | 'goals' | 'status') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'goals' ? 'desc' : 'asc');
    }
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* User Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle>Player Progress & Standings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cumulative goals are used as tiebreakers when all players are eliminated
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Player
                    {sortBy === 'name' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortBy === 'status' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('goals')}
                >
                  <div className="flex items-center gap-2">
                    Cumulative Goals
                    {sortBy === 'goals' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Record</TableHead>
                {gameGameweek?.status === 'open' && (
                  <TableHead>GW{game.current_gameweek} Pick Status</TableHead>
                )}
                {gameGameweek?.status === 'active' && (
                  <TableHead>GW{game.current_gameweek} Pick</TableHead>
                )}
                <TableHead>Recent Gameweeks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.profiles?.display_name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.is_eliminated ? "destructive" : "secondary"}
                      className={user.is_eliminated ? "" : "bg-green-100 text-green-800"}
                    >
                      {user.is_eliminated 
                        ? `Eliminated (GW${user.eliminated_gameweek})`
                        : "Active"
                      }
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {user.cumulativeGoals}
                      </span>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-green-600 font-medium">{user.winningPicks}W</span>
                      <span className="text-muted-foreground mx-1">-</span>
                      <span className="text-red-600 font-medium">{user.totalPicks - user.winningPicks}L</span>
                      <div className="text-xs text-muted-foreground">
                        {user.totalPicks} total picks
                      </div>
                    </div>
                  </TableCell>
                  {gameGameweek?.status === 'open' && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.hasCurrentGameweekPick ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="h-4 w-4" />
                            <span className="text-sm font-medium">Picked</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600">
                            <X className="h-4 w-4" />
                            <span className="text-sm font-medium">Not Picked</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {gameGameweek?.status === 'active' && (
                    <TableCell>
                      {user.currentGameweekPick ? (
                        <div className="text-sm">
                          <div className="font-medium">
                            {user.currentGameweekPick.fixtures?.home_team?.short_name} vs {user.currentGameweekPick.fixtures?.away_team?.short_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Picked: {user.currentGameweekPick.picked_side === 'home' 
                              ? user.currentGameweekPick.fixtures?.home_team?.short_name 
                              : user.currentGameweekPick.fixtures?.away_team?.short_name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No pick</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex gap-1">
                      {Object.entries(user.gameweekResults)
                        .sort(([a], [b]) => Number(b) - Number(a))
                         .slice(0, 5)
                         .map(([gameweek, picks]) => {
                           const pick = picks[0]; // One pick per gameweek
                           const isCurrentGameweek = Number(gameweek) === game?.current_gameweek;
                           const shouldShowPick = gameGameweek?.picks_visible || !isCurrentGameweek;
                           
                           return (
                             <div
                               key={gameweek}
                               title={
                                 shouldShowPick 
                                   ? `GW${gameweek}: ${pick?.result || 'pending'} ${
                                       pick?.result === 'win' && pick?.fixtures?.is_completed
                                         ? `(${pick.picked_side === 'home' 
                                             ? pick.fixtures.home_score 
                                             : pick.fixtures.away_score} goals)`
                                         : ''
                                     }`
                                   : `GW${gameweek}: Pick hidden until gameweek is active`
                               }
                               className={`w-8 h-8 rounded text-xs flex items-center justify-center font-medium ${
                                 !shouldShowPick && isCurrentGameweek
                                   ? 'bg-gray-200 text-gray-500'
                                   : pick?.result === 'win' 
                                   ? 'bg-green-100 text-green-800' 
                                   : pick?.result === 'lose' || pick?.result === 'draw'
                                   ? 'bg-red-100 text-red-800'
                                   : 'bg-gray-100 text-gray-600'
                               }`}
                             >
                               {!shouldShowPick && isCurrentGameweek
                                 ? '?'
                                 : pick?.result === 'win' && pick?.fixtures?.is_completed
                                 ? pick.picked_side === 'home' 
                                   ? pick.fixtures.home_score 
                                   : pick.fixtures.away_score
                                 : pick?.result === 'lose' 
                                 ? 'L'
                                 : pick?.result === 'draw'
                                 ? 'D'
                                 : '?'
                               }
                             </div>
                           );
                         })
                      }
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pick History */}
      <PickHistory 
        allPicks={allPicks || []} 
        players={players || []} 
        currentGameweek={game.current_gameweek || 1}
        gameGameweeks={allGameGameweeks || []}
      />
    </div>
  );
}