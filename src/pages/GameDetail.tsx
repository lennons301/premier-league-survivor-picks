import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Trophy, Users, Calendar, Target, UserPlus, Settings, Play, Clock } from "lucide-react";
import { useState, useEffect } from "react";

const GameDetail = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  const { data: game, isLoading } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select(`
          *
        `)
        .eq("id", gameId)
        .single();
      
      if (error) throw error;
      
      // Get creator profile separately
      const { data: creatorData } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.created_by)
        .single();
      
      return { ...data, creator: creatorData };
    },
  });

  const { data: players } = useQuery({
    queryKey: ["game-players", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .order("joined_at", { ascending: true });
      
      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      // Fetch profiles separately
      const userIds = data.map(p => p.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      
      // Merge the data
      return data.map(player => ({
        ...player,
        profiles: profilesData?.find(p => p.user_id === player.user_id)
      }));
    },
  });

  const { data: myParticipation } = useQuery({
    queryKey: ["my-participation", gameId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch current gameweek deadline
  const { data: currentDeadline } = useQuery({
    queryKey: ["current-deadline", gameId, game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return null;
      
      // First try to get game-specific deadline
      const { data: gameDeadline } = await supabase
        .from("gameweek_deadlines")
        .select("*")
        .eq("game_id", gameId)
        .eq("gameweek", game.current_gameweek)
        .single();
      
      if (gameDeadline) return gameDeadline;
      
      // Fall back to global gameweek deadline
      const { data: globalDeadline } = await supabase
        .from("gameweeks")
        .select("*")
        .eq("gameweek_number", game.current_gameweek)
        .single();
      
      return globalDeadline ? { deadline: globalDeadline.deadline } : null;
    },
    enabled: !!game?.current_gameweek,
  });

  // Countdown timer effect
  useEffect(() => {
    if (!currentDeadline?.deadline) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const deadline = new Date(currentDeadline.deadline).getTime();
      const difference = deadline - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        if (days > 0) {
          setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        }
      } else {
        setTimeRemaining("Deadline passed");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [currentDeadline?.deadline]);

  const joinGameMutation = useMutation({
    mutationFn: async () => {
      if (!user || !gameId) throw new Error("User not logged in");
      
      const { error } = await supabase
        .from("game_players")
        .insert({
          game_id: gameId,
          user_id: user.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Joined Game!",
        description: "You've successfully joined the game. Good luck!",
      });
      queryClient.invalidateQueries({ queryKey: ["game-players", gameId] });
      queryClient.invalidateQueries({ queryKey: ["my-participation", gameId, user?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join game",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-blue-500";
      case "finished": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const activePlayers = players?.filter(p => !p.is_eliminated) || [];
  const eliminatedPlayers = players?.filter(p => p.is_eliminated) || [];
  const isGameCreator = user && game && user.id === game.created_by;
  const canJoin = user && !myParticipation && (game?.status === "active" || isGameCreator);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-6">
          <div className="text-center">Loading game details...</div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-6">
          <div className="text-center">Game not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-primary" />
              {game.name}
            </h1>
            <p className="text-muted-foreground">
              Created by {game.creator?.display_name || "Unknown"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`${getStatusColor(game.status)} text-white`}
            >
              {game.status}
            </Badge>
            {isGameCreator && (
              <Link to={`/games/${gameId}/admin`}>
                <Button variant="outline" size="sm">
                  <Settings size={16} className="mr-2" />
                  Admin Panel
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Game Stats */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Game Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={`${getStatusColor(game.status)} text-white`}>
                    {game.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Gameweek</span>
                  <span className="font-semibold">{game.current_gameweek}</span>
                </div>
                {timeRemaining && game.status === "active" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pick Deadline</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span className="font-semibold text-orange-600">{timeRemaining}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Players</span>
                  <span className="font-semibold">{players?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Players</span>
                  <span className="font-semibold text-green-600">
                    {activePlayers.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Eliminated</span>
                  <span className="font-semibold text-red-600">{eliminatedPlayers.length}</span>
                </div>
                {game.max_players && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Players</span>
                    <span className="font-semibold">{game.max_players}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {canJoin && (
                    <Button 
                      onClick={() => joinGameMutation.mutate()}
                      disabled={joinGameMutation.isPending}
                      className="w-full"
                    >
                      <UserPlus size={16} className="mr-2" />
                      {joinGameMutation.isPending ? "Joining..." : "Join Game"}
                    </Button>
                  )}
                  
                  {myParticipation && !myParticipation.is_eliminated && game.status === "active" && (
                    <>
                      <Link to={`/games/${gameId}/pick`}>
                        <Button className="w-full">
                          <Play size={16} className="mr-2" />
                          Make Pick for GW {game.current_gameweek}
                        </Button>
                      </Link>
                      <Link to={`/games/${gameId}/progress`}>
                        <Button variant="outline" className="w-full">
                          View Progress
                        </Button>
                      </Link>
                    </>
                  )}
                  
                  {myParticipation && myParticipation.is_eliminated && (
                    <Badge variant="destructive" className="w-full justify-center py-2">
                      Eliminated in GW {myParticipation.eliminated_gameweek}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Players List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Players */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Active Players ({activePlayers.length})
                </CardTitle>
                <CardDescription>
                  Players still in the competition
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activePlayers.length > 0 ? (
                  <div className="grid gap-2">
                    {activePlayers.map((player: any) => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {player.profiles?.display_name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <span className="font-medium">{player.profiles?.display_name || "Unknown"}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Joined {new Date(player.joined_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No active players</p>
                )}
              </CardContent>
            </Card>

            {/* Eliminated Players */}
            {eliminatedPlayers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-red-600" />
                    Eliminated Players ({eliminatedPlayers.length})
                  </CardTitle>
                  <CardDescription>
                    Players who have been eliminated
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {eliminatedPlayers.map((player: any) => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-muted rounded-lg opacity-75">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {player.profiles?.display_name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <span className="font-medium">{player.profiles?.display_name || "Unknown"}</span>
                        </div>
                        <Badge variant="destructive">
                          GW {player.eliminated_gameweek}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameDetail;