import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, Plus, Eye, UserPlus, Crown, Banknote } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

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

          // Get winner if game is finished
          let winner = null;
          if (game.status === 'finished' && (game as any).winner_id) {
            const { data: winnerProfile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", (game as any).winner_id)
              .single();
            winner = winnerProfile;
          }
          
          return { 
            ...game, 
            creator: creatorData,
            prize_pot: prizePot,
            winner: winner
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
      
      // Add prize pot data to my games
      const gamesWithPrizePots = await Promise.all(
        data.map(async (gamePlayer: any) => {
          const { data: prizePot } = await supabase
            .rpc("calculate_prize_pot", { p_game_id: gamePlayer.games.id });

          // Get winner if game is finished
          let winner = null;
          if (gamePlayer.games.status === 'finished' && (gamePlayer.games as any).winner_id) {
            const { data: winnerProfile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", (gamePlayer.games as any).winner_id)
              .single();
            winner = winnerProfile;
          }
          
          return {
            ...gamePlayer,
            games: {
              ...gamePlayer.games,
              prize_pot: prizePot,
              winner: winner
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
        {myGames && myGames.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">My Games</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myGames.map((gamePlayer: any) => (
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
                      {gamePlayer.games.status === 'finished' && gamePlayer.games.winner && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Crown size={16} />
                            <span>Winner</span>
                          </div>
                          <span className="font-semibold text-yellow-600">{gamePlayer.games.winner.display_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/games/${gamePlayer.games.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye size={16} className="mr-2" />
                          View Game
                        </Button>
                      </Link>
                      {gamePlayer.games.status === "active" && !gamePlayer.is_eliminated && (
                        <Link to={`/games/${gamePlayer.games.id}/pick`} className="flex-1">
                          <Button size="sm" className="w-full">
                            Make Pick
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
          </div>
        )}

        {/* Available Games */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Available Games</h2>
          {games && games.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {games.map((game: any) => (
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
                      {game.status === 'finished' && game.winner && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Crown size={16} />
                            <span>Winner</span>
                          </div>
                          <span className="font-semibold text-yellow-600">{game.winner.display_name}</span>
                        </div>
                      )}
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
                      {game.status === "active" && game.current_gameweek === game.starting_gameweek && (
                        <JoinGameButton gameId={game.id} />
                      )}
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
      </div>
    </div>
  );
};

export default Games;