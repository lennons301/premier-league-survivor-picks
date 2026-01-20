import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, Plus, Eye, UserPlus, Crown, Banknote, ChevronDown, ChevronUp, BarChart3, Settings, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// Join Game Button Component
const JoinGameButton = ({ gameId }: { gameId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const joinGameMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in to join game");
      
      const { error } = await supabase
        .from("game_players")
        .insert({
          user_id: user.id,
          game_id: gameId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Joined game successfully!",
        description: "You can now make picks for this game.",
      });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["my-games", user?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join game",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      size="sm"
      onClick={() => joinGameMutation.mutate()}
      disabled={joinGameMutation.isPending || !user}
      className="flex-1"
    >
      <UserPlus size={16} className="mr-2" />
      {joinGameMutation.isPending ? "Joining..." : "Join"}
    </Button>
  );
};

const Games = () => {
  const { user } = useAuth();
  const [finishedGamesOpen, setFinishedGamesOpen] = useState(false);

  const { data: games, isLoading } = useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const { data: gamesData, error } = await supabase
        .from("games")
        .select(`
          *,
          game_players(count)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Get creator profiles and additional data
      const gamesWithCreators = await Promise.all(
        gamesData.map(async (game: any) => {
          const { data: creatorData } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", game.created_by)
            .single();

          // Get prize pot
          const { data: prizePot } = await supabase
            .rpc("calculate_prize_pot", { p_game_id: game.id });

          // Get winner(s) if game is finished
          let winner: { display_name: string } | null = null;
          let winners: any[] | null = null;
          let isSplit = false;

          if (game.status === 'finished') {
            // Source of truth: game_winners rows (supports split + single)
            const { data: winnerRows, error: winnersError } = await supabase
              .from("game_winners")
              .select("user_id,payout_amount,is_split")
              .eq("game_id", game.id);

            if (winnersError) throw winnersError;

            if (winnerRows && winnerRows.length > 0) {
              const winnerUserIds = winnerRows.map((w) => w.user_id);
              const { data: winnerProfiles, error: profilesError } = await supabase
                .from("profiles")
                .select("user_id,display_name")
                .in("user_id", winnerUserIds);

              if (profilesError) throw profilesError;

              winners = winnerRows.map((w) => ({
                ...w,
                profiles: winnerProfiles?.find((p) => p.user_id === w.user_id),
              }));
              isSplit = !!winnerRows[0].is_split;
            } else if (game.winner_id) {
              // Fallback: winner_id on games (no RPC to avoid stale/incorrect results)
              const { data: winnerProfile, error: winnerProfileError } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", game.winner_id)
                .maybeSingle();

              if (winnerProfileError) throw winnerProfileError;
              if (winnerProfile) winner = winnerProfile;
            }
          }
          
          return { 
            ...game, 
            creator: creatorData,
            prize_pot: prizePot,
            winner: winner,
            winners: winners,
            is_split: isSplit
          };
        })
      );
      
      return gamesWithCreators;
    },
  });

  const { data: myGames } = useQuery({
    queryKey: ["my-games", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("game_players")
        .select(`
          *,
          games(*)
        `)
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      // Add prize pot data to my games and check for current picks
      const gamesWithPrizePots = await Promise.all(
        data.map(async (gamePlayer: any) => {
          const { data: prizePot } = await supabase
            .rpc("calculate_prize_pot", { p_game_id: gamePlayer.games.id });

          // Get winner(s) if game is finished
          let winner: { display_name: string } | null = null;
          let winners: any[] | null = null;
          let isSplit = false;

          if (gamePlayer.games.status === 'finished') {
            // Source of truth: game_winners rows (supports split + single)
            const { data: winnerRows, error: winnersError } = await supabase
              .from("game_winners")
              .select("user_id,payout_amount,is_split")
              .eq("game_id", gamePlayer.games.id);

            if (winnersError) throw winnersError;

            if (winnerRows && winnerRows.length > 0) {
              const winnerUserIds = winnerRows.map((w) => w.user_id);
              const { data: winnerProfiles, error: profilesError } = await supabase
                .from("profiles")
                .select("user_id,display_name")
                .in("user_id", winnerUserIds);

              if (profilesError) throw profilesError;

              winners = winnerRows.map((w) => ({
                ...w,
                profiles: winnerProfiles?.find((p) => p.user_id === w.user_id),
              }));
              isSplit = !!winnerRows[0].is_split;
            } else if (gamePlayer.games.winner_id) {
              // Fallback: winner_id on games (no RPC to avoid stale/incorrect results)
              const { data: winnerProfile, error: winnerProfileError } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", gamePlayer.games.winner_id)
                .maybeSingle();

              if (winnerProfileError) throw winnerProfileError;
              if (winnerProfile) winner = winnerProfile;
            }
          }

          // Check for current pick and deadline
          let currentPick = null;
          let currentDeadline = null;
          if (gamePlayer.games.status === 'active') {
            // Cup mode: check for cup_picks, other modes: check for picks
            if (gamePlayer.games.game_mode === 'cup') {
              const { data: cupPickData } = await supabase
                .from("cup_picks")
                .select("*")
                .eq("game_id", gamePlayer.games.id)
                .eq("user_id", user.id)
                .limit(1)
                .maybeSingle();
              currentPick = cupPickData;
              // Cup mode uses current_deadline from the game directly
              currentDeadline = gamePlayer.games.current_deadline;
            } else {
              const { data: pickData } = await supabase
                .from("picks")
                .select("*")
                .eq("game_id", gamePlayer.games.id)
                .eq("user_id", user.id)
                .eq("gameweek", gamePlayer.games.current_gameweek)
                .maybeSingle();
              currentPick = pickData;

              // Get current gameweek deadline
              const { data: gameDeadline } = await supabase
                .from("gameweek_deadlines")
                .select("deadline")
                .eq("game_id", gamePlayer.games.id)
                .eq("gameweek", gamePlayer.games.current_gameweek)
                .maybeSingle();
              
              if (gameDeadline) {
                currentDeadline = gameDeadline.deadline;
              } else {
                // Fall back to global gameweek deadline
                const { data: globalDeadline } = await supabase
                  .from("gameweeks")
                  .select("deadline")
                  .eq("gameweek_number", gamePlayer.games.current_gameweek)
                  .maybeSingle();
                currentDeadline = globalDeadline?.deadline;
              }
            }
          }
          
          return {
            ...gamePlayer,
            games: {
              ...gamePlayer.games,
              prize_pot: prizePot,
              winner: winner,
              winners: winners,
              is_split: isSplit,
              current_pick: currentPick,
              current_deadline: currentDeadline
            }
          };
        })
      );
      
      return gamesWithPrizePots;
    },
    enabled: !!user,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-500";
      case "active": return "bg-blue-500";
      case "finished": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-6">
          <div className="text-center">Loading games...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Games</h1>
            <p className="text-muted-foreground">Join or create Last Person Standing (LPS) competitions</p>
          </div>
          <Link to="/games/create">
            <Button className="flex items-center gap-2">
              <Plus size={20} />
              Create Game
            </Button>
          </Link>
        </div>

        {/* My Games */}
        {myGames && myGames.length > 0 && (() => {
          const activeGames = myGames.filter((gp: any) => gp.games.status !== 'finished');
          const finishedGames = myGames.filter((gp: any) => gp.games.status === 'finished');
          
          return (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">My Games</h2>
              
              {/* Active Games */}
              {activeGames.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
                  {activeGames.map((gamePlayer: any) => (
                    <Card key={gamePlayer.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{gamePlayer.games.name}</CardTitle>
                            <CardDescription>
                              Gameweek {gamePlayer.games.current_gameweek}
                            </CardDescription>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`${getStatusColor(gamePlayer.games.status)} text-white`}
                          >
                            {gamePlayer.games.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm text-muted-foreground mb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Banknote size={16} />
                              <span>Prize Pot</span>
                            </div>
                            <span>£{gamePlayer.games.prize_pot ? Number(gamePlayer.games.prize_pot).toFixed(2) : '0.00'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            {gamePlayer.games.status === "active" && !gamePlayer.is_eliminated && (
                              gamePlayer.games.current_deadline && new Date(gamePlayer.games.current_deadline) > new Date() ? (
                                <Link to={
                                  gamePlayer.games.game_mode === "turbo" 
                                    ? `/games/${gamePlayer.games.id}/turbo-pick` 
                                    : gamePlayer.games.game_mode === "escalating"
                                    ? `/games/${gamePlayer.games.id}/escalating-pick`
                                    : gamePlayer.games.game_mode === "cup"
                                    ? `/games/${gamePlayer.games.id}/cup-pick`
                                    : `/games/${gamePlayer.games.id}/pick`
                                } className="flex-1">
                                  <Button size="sm" className="w-full">
                                    <Target size={16} className="mr-2" />
                                    {gamePlayer.games.current_pick ? 'Edit Pick' : 'Make Pick'}
                                  </Button>
                                </Link>
                              ) : (
                                <Button size="sm" variant="outline" disabled className="flex-1">
                                  <Target size={16} className="mr-2" />
                                  Picks Locked
                                </Button>
                              )
                            )}
                            <Link to={`/games/${gamePlayer.games.id}/progress`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full">
                                <BarChart3 size={16} className="mr-2" />
                                Progress
                              </Button>
                            </Link>
                          </div>
                          {user?.id === gamePlayer.games.created_by && (
                            <Link to={`/games/${gamePlayer.games.id}/admin`} className="w-full">
                              <Button variant="secondary" size="sm" className="w-full">
                                <Settings size={16} className="mr-2" />
                                Admin Panel
                              </Button>
                            </Link>
                          )}
                        </div>
                        {gamePlayer.is_eliminated && (
                          <Badge variant="destructive" className="mt-2">
                            Eliminated in GW {gamePlayer.eliminated_gameweek}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Finished Games (Collapsible) */}
              {finishedGames.length > 0 && (
                <Collapsible open={finishedGamesOpen} onOpenChange={setFinishedGamesOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 mb-4 text-muted-foreground hover:text-foreground">
                      {finishedGamesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      Finished Games ({finishedGames.length})
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {finishedGames.map((gamePlayer: any) => (
                        <Card key={gamePlayer.id} className="hover:shadow-lg transition-shadow opacity-75">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">{gamePlayer.games.name}</CardTitle>
                                <CardDescription>
                                  Gameweek {gamePlayer.games.current_gameweek}
                                </CardDescription>
                              </div>
                              <Badge 
                                variant="secondary" 
                                className={`${getStatusColor(gamePlayer.games.status)} text-white`}
                              >
                                {gamePlayer.games.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm text-muted-foreground mb-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <Banknote size={16} />
                                  <span>Prize Pot</span>
                                </div>
                                <span>£{gamePlayer.games.prize_pot ? Number(gamePlayer.games.prize_pot).toFixed(2) : '0.00'}</span>
                              </div>
                              {(gamePlayer.games.winner || gamePlayer.games.winners) && (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    <Crown size={16} />
                                    <span className="font-semibold">{gamePlayer.games.is_split ? 'Winners (Split)' : 'Winner'}</span>
                                  </div>
                                  {gamePlayer.games.is_split && gamePlayer.games.winners ? (
                                    <div className="space-y-1 ml-5">
                                      {gamePlayer.games.winners.map((w: any) => (
                                        <div key={w.user_id} className="flex justify-between text-sm">
                                          <span className="text-yellow-600">{w.profiles?.display_name}</span>
                                          <span className="text-muted-foreground">£{Number(w.payout_amount).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : gamePlayer.games.winner ? (
                                    <span className="ml-5 font-semibold text-yellow-600">{gamePlayer.games.winner.display_name}</span>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              <Link to={`/games/${gamePlayer.games.id}/progress`} className="w-full">
                                <Button variant="outline" size="sm" className="w-full">
                                  <BarChart3 size={16} className="mr-2" />
                                  View Progress
                                </Button>
                              </Link>
                              {user?.id === gamePlayer.games.created_by && (
                                <Link to={`/games/${gamePlayer.games.id}/admin`} className="w-full">
                                  <Button variant="secondary" size="sm" className="w-full">
                                    <Settings size={16} className="mr-2" />
                                    Admin Panel
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })()}

        {/* Available Games */}
        {(() => {
          // Filter to only show games that are joinable:
          // 1. Status is "active" and still on starting gameweek (picks not locked)
          // 2. User is not already in the game
          const myGameIds = new Set(myGames?.map((gp: any) => gp.games.id) || []);
          const availableGames = games?.filter((game: any) => 
            game.status === "active" && 
            game.current_gameweek === game.starting_gameweek &&
            !myGameIds.has(game.id)
          ) || [];
          
          return (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Available Games</h2>
              {availableGames.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableGames.map((game: any) => (
                    <Card key={game.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{game.name}</CardTitle>
                            <CardDescription>
                              Created by {game.creator?.display_name || "Unknown"}
                            </CardDescription>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`${getStatusColor(game.status)} text-white`}
                          >
                            {game.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm text-muted-foreground mb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Users size={16} />
                              <span>Players</span>
                            </div>
                            <span>{game.game_players?.[0]?.count || 0}{game.max_players ? `/${game.max_players}` : ""}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Trophy size={16} />
                              <span>Gameweek</span>
                            </div>
                            <span>{game.current_gameweek}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Banknote size={16} />
                              <span>Prize Pot</span>
                            </div>
                            <span>£{game.prize_pot ? Number(game.prize_pot).toFixed(2) : '0.00'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Calendar size={16} />
                              <span>Created</span>
                            </div>
                            <span>{new Date(game.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link to={`/games/${game.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              <Eye size={16} className="mr-2" />
                              View Details
                            </Button>
                          </Link>
                          <JoinGameButton gameId={game.id} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <CardTitle className="mb-2">No Games Available</CardTitle>
                    <CardDescription className="mb-4">
                      Be the first to create a Last Person Standing (LPS) game!
                    </CardDescription>
                    <Link to="/games/create">
                      <Button>
                        <Plus size={16} className="mr-2" />
                        Create Game
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Games;