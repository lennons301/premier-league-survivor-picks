import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFPLSync } from "@/hooks/useFPLSync";
import { useDeadlineCheck } from "@/hooks/useDeadlineCheck";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Users, Clock, Lock, Crown, Banknote } from "lucide-react";
import PickHistory from "@/components/PickHistory";
import { useEffect } from "react";

export default function GameProgress() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { syncFPLData } = useFPLSync();
  const { checkDeadlines } = useDeadlineCheck();

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

      // Get winner(s) if game is finished
      let winner = null;
      let winners = null;
      let isSplit = false;
      if (data.status === 'finished') {
        // Check if there are split winners
        const { data: splitWinners } = await supabase
          .from("game_winners")
          .select(`
            user_id,
            payout_amount,
            is_split,
            profiles:user_id (display_name)
          `)
          .eq("game_id", gameId);
        
        if (splitWinners && splitWinners.length > 0) {
          winners = splitWinners;
          isSplit = splitWinners[0].is_split;
        } else {
          // Fall back to single winner
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
      }

      return { 
        ...data, 
        prize_pot: prizePot,
        winner: winner,
        winners: winners,
        is_split: isSplit
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

  // Fetch cup picks for Cup games
  const { data: cupPicks } = useQuery({
    queryKey: ["cup-picks-all", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cup_picks")
        .select(`
          *,
          cup_fixtures (
            home_team,
            away_team,
            tier_difference,
            home_goals,
            away_goals
          )
        `)
        .eq("game_id", gameId)
        .order("preference_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!gameId && game?.game_mode === 'cup',
  });

  // Trigger deadline check when page loads and game gameweek is open
  useEffect(() => {
    if (gameId && gameGameweek?.status === 'open') {
      checkDeadlines(gameId);
    }
  }, [gameId, gameGameweek?.status, checkDeadlines]);

  // Sync FPL data when gameweek is active (relevant for eliminations)
  useEffect(() => {
    if (gameGameweek?.status === 'active') {
      syncFPLData();
    }
  }, [gameGameweek?.status, syncFPLData]);

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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{game.name} - Progress</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <p className="text-sm sm:text-base text-muted-foreground">GW{game.current_gameweek}</p>
            {gameGameweek && (
              <Badge variant={
                gameGameweek.status === 'open' ? 'secondary' : 
                gameGameweek.status === 'active' ? 'default' : 
                'outline'
              } className="text-xs">
                {gameGameweek.status === 'open' && <Clock className="h-3 w-3 mr-1" />}
                {gameGameweek.status === 'active' && <Lock className="h-3 w-3 mr-1" />}
                {gameGameweek.status}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Game Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="p-3 sm:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-0 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Active</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="text-lg sm:text-2xl font-bold">{activePlayers.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {eliminatedPlayers.length} eliminated
            </p>
          </CardContent>
        </Card>

        <Card className="p-3 sm:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-0 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Status</CardTitle>
            <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="text-lg sm:text-2xl font-bold capitalize">{game.status}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              From GW{game.starting_gameweek}
            </p>
          </CardContent>
        </Card>

        <Card className="p-3 sm:p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-0 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Prize</CardTitle>
            <Banknote className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="text-lg sm:text-2xl font-bold">£{game.prize_pot ? Number(game.prize_pot).toFixed(2) : '0.00'}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Entry + rebuys
            </p>
          </CardContent>
        </Card>

        {game.status === 'finished' && (game.winner || game.winners) && (
          <Card className="p-3 sm:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-0 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">
                {game.is_split ? 'Winners (Split)' : 'Winner'}
              </CardTitle>
              <Crown className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {game.is_split && game.winners ? (
                <div className="space-y-2">
                  {game.winners.map((w: any) => (
                    <div key={w.user_id} className="flex justify-between items-center">
                      <span className="font-semibold text-yellow-600">{w.profiles?.display_name}</span>
                      <span className="text-sm text-muted-foreground">£{Number(w.payout_amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                    Prize split equally among remaining players
                  </p>
                </div>
              ) : game.winner ? (
                <>
                  <div className="text-lg sm:text-2xl font-bold text-yellow-600">{game.winner.display_name}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Congratulations!
                  </p>
                </>
              ) : null}
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
        cupPicks={cupPicks || []}
      />
    </div>
  );
}