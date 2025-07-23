import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock } from "lucide-react";

export default function MakePick() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedFixture, setSelectedFixture] = useState<string>("");
  const [selectedSide, setSelectedSide] = useState<"home" | "away" | "">("");
  const [timeRemaining, setTimeRemaining] = useState<string>("");

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

  // Fetch fixtures for current gameweek
  const { data: fixtures } = useQuery({
    queryKey: ["fixtures", game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return [];
      const { data, error } = await supabase
        .from("fixtures")
        .select(`
          *,
          home_team:teams!fixtures_home_team_id_fkey (
            id,
            name,
            short_name
          ),
          away_team:teams!fixtures_away_team_id_fkey (
            id,
            name,
            short_name
          )
        `)
        .eq("gameweek", game.current_gameweek)
        .order("kickoff_time");
      if (error) throw error;
      return data;
    },
    enabled: !!game?.current_gameweek,
  });

  // Fetch user's previous picks for this game
  const { data: previousPicks } = useQuery({
    queryKey: ["previous-picks", gameId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("picks")
        .select(`
          *,
          teams (
            name
          ),
          fixtures (
            home_team:teams!fixtures_home_team_id_fkey (name),
            away_team:teams!fixtures_away_team_id_fkey (name)
          )
        `)
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .order("gameweek");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch current pick for this gameweek
  const { data: currentPick } = useQuery({
    queryKey: ["current-pick", gameId, game?.current_gameweek, user?.id],
    queryFn: async () => {
      if (!user?.id || !game?.current_gameweek) return null;
      const { data, error } = await supabase
        .from("picks")
        .select("*")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .eq("gameweek", game.current_gameweek)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!game?.current_gameweek,
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

  // Set initial selected fixture and side if there's a current pick
  useEffect(() => {
    if (currentPick?.fixture_id && currentPick?.picked_side) {
      setSelectedFixture(currentPick.fixture_id);
      setSelectedSide(currentPick.picked_side as "home" | "away");
    }
  }, [currentPick]);

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

  const submitPickMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedFixture || !selectedSide || !game) {
        throw new Error("Missing required data");
      }

      const selectedFixtureData = fixtures?.find(f => f.id === selectedFixture);
      if (!selectedFixtureData) {
        throw new Error("Invalid fixture selected");
      }

      const teamId = selectedSide === "home" 
        ? selectedFixtureData.home_team_id 
        : selectedFixtureData.away_team_id;

      const pickData = {
        game_id: gameId,
        user_id: user.id,
        team_id: teamId,
        fixture_id: selectedFixture,
        picked_side: selectedSide,
        gameweek: game.current_gameweek,
      };

      if (currentPick) {
        // Update existing pick
        const { error } = await supabase
          .from("picks")
          .update(pickData)
          .eq("id", currentPick.id);
        if (error) throw error;
      } else {
        // Create new pick
        const { error } = await supabase
          .from("picks")
          .insert(pickData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const selectedFixtureData = fixtures?.find(f => f.id === selectedFixture);
      const teamName = selectedSide === "home" 
        ? selectedFixtureData?.home_team?.name 
        : selectedFixtureData?.away_team?.name;
      
      toast({
        title: "Pick submitted successfully!",
        description: `You have picked ${teamName} for gameweek ${game?.current_gameweek}`,
      });
      queryClient.invalidateQueries({ queryKey: ["current-pick"] });
      navigate(`/games/${gameId}`);
    },
    onError: (error) => {
      console.error("Error submitting pick:", error);
      toast({
        title: "Error submitting pick",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  if (!game || !fixtures) {
    return <div>Loading...</div>;
  }

  // Filter out teams that have already been picked
  const previouslyPickedTeamIds = previousPicks?.map(pick => pick.team_id) || [];
  const availableFixtures = fixtures.filter(fixture => 
    !previouslyPickedTeamIds.includes(fixture.home_team_id) && 
    !previouslyPickedTeamIds.includes(fixture.away_team_id)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/games/${gameId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Game
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Make Your Pick</h1>
          <p className="text-muted-foreground">Gameweek {game.current_gameweek} • {game.name}</p>
          {timeRemaining && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-600">{timeRemaining}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Your Pick for Gameweek {game.current_gameweek}</CardTitle>
              <CardDescription>
                Choose a team from the available fixtures. You must pick a different team each gameweek.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                submitPickMutation.mutate();
              }}>
                <div className="space-y-4">
                  <div>
                    {availableFixtures.length > 0 ? (
                      <div className="grid gap-4">
                        {availableFixtures.map((fixture) => (
                          <div key={fixture.id} className="border rounded-lg p-4">
                            <div className="text-center mb-3">
                              <span className="text-sm text-muted-foreground">
                                {new Date(fixture.kickoff_time).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <label
                                className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedFixture === fixture.id && selectedSide === "home"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : currentPick?.fixture_id === fixture.id && currentPick?.picked_side === "home"
                                    ? "bg-green-100 border-green-500 text-green-800"
                                    : "hover:bg-muted"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="pick"
                                  value={`${fixture.id}-home`}
                                  checked={selectedFixture === fixture.id && selectedSide === "home"}
                                  onChange={() => {
                                    setSelectedFixture(fixture.id);
                                    setSelectedSide("home");
                                  }}
                                  className="mb-2"
                                />
                                <span className="font-medium text-center">{fixture.home_team?.name}</span>
                                <span className="text-xs text-muted-foreground mt-1">(Home)</span>
                                {currentPick?.fixture_id === fixture.id && currentPick?.picked_side === "home" && (
                                  <span className="text-xs mt-1">Current Pick</span>
                                )}
                              </label>

                              <label
                                className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedFixture === fixture.id && selectedSide === "away"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : currentPick?.fixture_id === fixture.id && currentPick?.picked_side === "away"
                                    ? "bg-green-100 border-green-500 text-green-800"
                                    : "hover:bg-muted"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="pick"
                                  value={`${fixture.id}-away`}
                                  checked={selectedFixture === fixture.id && selectedSide === "away"}
                                  onChange={() => {
                                    setSelectedFixture(fixture.id);
                                    setSelectedSide("away");
                                  }}
                                  className="mb-2"
                                />
                                <span className="font-medium text-center">{fixture.away_team?.name}</span>
                                <span className="text-xs text-muted-foreground mt-1">(Away)</span>
                                {currentPick?.fixture_id === fixture.id && currentPick?.picked_side === "away" && (
                                  <span className="text-xs mt-1">Current Pick</span>
                                )}
                              </label>
                            </div>
                            
                            <div className="text-center mt-2">
                              <span className="text-sm font-medium">
                                {fixture.home_team?.short_name} vs {fixture.away_team?.short_name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No fixtures available to pick from.</p>
                        <p className="text-sm mt-2">You may have already picked teams from all available fixtures.</p>
                      </div>
                    )}
                  </div>

                  {availableFixtures.length > 0 && (
                    <Button 
                      type="submit" 
                      disabled={!selectedFixture || !selectedSide || submitPickMutation.isPending}
                      className="w-full"
                    >
                      {submitPickMutation.isPending 
                        ? "Submitting..." 
                        : currentPick 
                        ? "Update Pick" 
                        : "Submit Pick"
                      }
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Your Previous Picks</CardTitle>
              <CardDescription>Teams you've picked in previous gameweeks</CardDescription>
            </CardHeader>
            <CardContent>
              {previousPicks && previousPicks.length > 0 ? (
                <ul className="space-y-2">
                  {previousPicks.map((pick) => (
                    <li key={pick.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div className="flex flex-col">
                        <span>GW{pick.gameweek}: {pick.teams?.name}</span>
                        {pick.fixtures && (
                          <span className="text-xs text-muted-foreground">
                            vs {pick.picked_side === 'home' 
                              ? pick.fixtures.away_team?.name 
                              : pick.fixtures.home_team?.name
                            } ({pick.picked_side})
                          </span>
                        )}
                      </div>
                      <span className={`text-sm px-2 py-1 rounded ${
                        pick.result === 'success' ? 'bg-green-100 text-green-800' :
                        pick.result === 'failure' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {pick.result || 'pending'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No previous picks yet.</p>
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
              <div>• First week failures don't eliminate</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}