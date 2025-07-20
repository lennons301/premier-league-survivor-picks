import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Target, Clock, CheckCircle, AlertCircle } from "lucide-react";

const MakePick = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  // Get game details
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

  // Get all teams
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  // Get user's previous picks in this game
  const { data: previousPicks } = useQuery({
    queryKey: ["previous-picks", gameId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("picks")
        .select(`
          *,
          teams(name, short_name)
        `)
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .order("gameweek", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get current pick for this gameweek
  const { data: currentPick } = useQuery({
    queryKey: ["current-pick", gameId, user?.id, game?.current_gameweek],
    queryFn: async () => {
      if (!user || !game) return null;
      const { data, error } = await supabase
        .from("picks")
        .select(`
          *,
          teams(name, short_name)
        `)
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .eq("gameweek", game.current_gameweek)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!game,
  });

  const submitPickMutation = useMutation({
    mutationFn: async () => {
      if (!user || !gameId || !selectedTeam || !game) {
        throw new Error("Missing required data");
      }

      if (currentPick) {
        // Update existing pick
        const { error } = await supabase
          .from("picks")
          .update({
            team_id: selectedTeam,
          })
          .eq("id", currentPick.id);
        
        if (error) throw error;
      } else {
        // Create new pick
        const { error } = await supabase
          .from("picks")
          .insert({
            game_id: gameId,
            user_id: user.id,
            team_id: selectedTeam,
            gameweek: game.current_gameweek,
            result: "pending"
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Pick Submitted!",
        description: `Your pick for Gameweek ${game?.current_gameweek} has been ${currentPick ? 'updated' : 'submitted'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["current-pick"] });
      navigate(`/games/${gameId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit pick",
        variant: "destructive",
      });
    },
  });

  const usedTeamIds = previousPicks?.map(pick => pick.team_id) || [];
  const availableTeams = teams?.filter(team => 
    !usedTeamIds.includes(team.id) || team.id === currentPick?.team_id
  ) || [];

  if (!game || !teams) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-6">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Make Your Pick
          </h1>
          <p className="text-muted-foreground">
            Gameweek {game.current_gameweek} • {game.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pick Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {currentPick ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Update Your Pick
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5" />
                      Select Your Team
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {currentPick 
                    ? `You've already picked ${currentPick.teams?.name}. You can change it below.`
                    : "Choose a Premier League team for this gameweek. Remember, you can only pick each team once!"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentPick && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Current Pick: {currentPick.teams?.name}</span>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {availableTeams.map((team: any) => {
                    const isSelected = selectedTeam === team.id;
                    const isCurrentPick = currentPick?.team_id === team.id;
                    
                    return (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeam(team.id)}
                        className={`p-4 border rounded-lg text-left transition-all hover:shadow-md ${
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : isCurrentPick
                            ? "border-green-500 bg-green-50"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{team.name}</div>
                            <div className="text-sm text-muted-foreground">{team.short_name}</div>
                          </div>
                          {isCurrentPick && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Current
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {availableTeams.length === 0 && (
                  <div className="text-center py-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Teams Available</h3>
                    <p className="text-muted-foreground">
                      You've already used all Premier League teams in this game.
                    </p>
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/games/${gameId}`)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitPickMutation.mutate()}
                    disabled={!selectedTeam || submitPickMutation.isPending}
                    className="flex-1"
                  >
                    {submitPickMutation.isPending 
                      ? "Submitting..." 
                      : currentPick 
                      ? "Update Pick" 
                      : "Submit Pick"
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Previous Picks */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your Previous Picks</CardTitle>
                <CardDescription>
                  Teams you've already used in this game
                </CardDescription>
              </CardHeader>
              <CardContent>
                {previousPicks && previousPicks.length > 0 ? (
                  <div className="space-y-2">
                    {previousPicks.map((pick: any) => (
                      <div key={pick.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <div className="font-medium text-sm">{pick.teams?.name}</div>
                          <div className="text-xs text-muted-foreground">GW {pick.gameweek}</div>
                        </div>
                        <Badge 
                          variant={
                            pick.result === "win" ? "default" :
                            pick.result === "lose" ? "destructive" :
                            pick.result === "draw" ? "secondary" :
                            "outline"
                          }
                          className="text-xs"
                        >
                          {pick.result || "pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No previous picks in this game.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Quick Rules</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <div>• Pick one team per gameweek</div>
                <div>• Team must WIN to advance</div>
                <div>• Can't pick same team twice</div>
                <div>• Draws count as elimination</div>
                <div>• GW1 failures can rebuy once</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MakePick;