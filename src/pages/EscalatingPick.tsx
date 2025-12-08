import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFPLSync } from "@/hooks/useFPLSync";
import { ArrowLeft, Clock, TrendingUp, Check, X } from "lucide-react";

interface SelectedPick {
  fixtureId: string;
  side: "home" | "away";
  teamId: string;
  teamName: string;
}

export default function EscalatingPick() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { syncFPLData } = useFPLSync();

  const [selectedPicks, setSelectedPicks] = useState<SelectedPick[]>([]);
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

  // Calculate required picks for current gameweek
  const requiredPicks = game ? (game.current_gameweek - game.starting_gameweek + 1) : 1;

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
            short_name,
            code
          ),
          away_team:teams!fixtures_away_team_id_fkey (
            id,
            name,
            short_name,
            code
          )
        `)
        .eq("gameweek", game.current_gameweek)
        .order("kickoff_time");
      if (error) throw error;
      return data;
    },
    enabled: !!game?.current_gameweek,
  });

  // Fetch user's previous picks for this game (all gameweeks)
  const { data: previousPicks } = useQuery({
    queryKey: ["previous-picks", gameId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("picks")
        .select(`*, teams (name)`)
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .order("gameweek");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch current gameweek picks
  const { data: currentPicks } = useQuery({
    queryKey: ["escalating-picks", gameId, game?.current_gameweek, user?.id],
    queryFn: async () => {
      if (!user?.id || !game?.current_gameweek) return [];
      const { data, error } = await supabase
        .from("picks")
        .select("*")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .eq("gameweek", game.current_gameweek);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!game?.current_gameweek,
  });

  // Fetch current deadline
  const { data: currentDeadline } = useQuery({
    queryKey: ["current-deadline", gameId, game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return null;
      
      const { data: gameDeadline } = await supabase
        .from("gameweek_deadlines")
        .select("*")
        .eq("game_id", gameId)
        .eq("gameweek", game.current_gameweek)
        .single();
      
      if (gameDeadline) return gameDeadline;
      
      const { data: globalDeadline } = await supabase
        .from("gameweeks")
        .select("*")
        .eq("gameweek_number", game.current_gameweek)
        .single();
      
      return globalDeadline ? { deadline: globalDeadline.deadline } : null;
    },
    enabled: !!game?.current_gameweek,
  });

  // Initialize from existing picks
  useEffect(() => {
    if (currentPicks?.length && fixtures?.length) {
      const restored = currentPicks.map(pick => {
        const fixture = fixtures.find(f => f.id === pick.fixture_id);
        return {
          fixtureId: pick.fixture_id!,
          side: pick.picked_side as "home" | "away",
          teamId: pick.team_id,
          teamName: pick.picked_side === "home" 
            ? fixture?.home_team?.name || ""
            : fixture?.away_team?.name || "",
        };
      });
      setSelectedPicks(restored);
    }
  }, [currentPicks, fixtures]);

  useEffect(() => {
    syncFPLData();
  }, [syncFPLData]);

  // Countdown timer
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

  // Get previously picked team IDs (from other gameweeks)
  const previouslyPickedTeamIds = previousPicks
    ?.filter(p => p.gameweek !== game?.current_gameweek)
    .map(p => p.team_id) || [];

  // Currently selected team IDs in this session
  const currentSelectedTeamIds = selectedPicks.map(p => p.teamId);

  const togglePick = (fixtureId: string, side: "home" | "away", teamId: string, teamName: string) => {
    const existing = selectedPicks.find(p => p.fixtureId === fixtureId && p.side === side);
    
    if (existing) {
      // Deselect
      setSelectedPicks(prev => prev.filter(p => !(p.fixtureId === fixtureId && p.side === side)));
    } else {
      // Check if we've reached the limit
      if (selectedPicks.length >= requiredPicks) {
        toast({
          title: "Pick limit reached",
          description: `You can only select ${requiredPicks} pick(s) this gameweek.`,
          variant: "destructive",
        });
        return;
      }
      
      // Remove any existing pick for this fixture (switch sides)
      const filtered = selectedPicks.filter(p => p.fixtureId !== fixtureId);
      setSelectedPicks([...filtered, { fixtureId, side, teamId, teamName }]);
    }
  };

  const submitPicksMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !game || selectedPicks.length !== requiredPicks) {
        throw new Error("Select exactly " + requiredPicks + " pick(s)");
      }

      // Delete existing picks for this gameweek
      await supabase
        .from("picks")
        .delete()
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .eq("gameweek", game.current_gameweek);

      // Insert new picks
      const picksToInsert = selectedPicks.map(pick => ({
        game_id: gameId,
        user_id: user.id,
        fixture_id: pick.fixtureId,
        team_id: pick.teamId,
        picked_side: pick.side,
        gameweek: game.current_gameweek,
      }));

      const { error } = await supabase.from("picks").insert(picksToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Picks submitted!",
        description: `Your ${requiredPicks} pick(s) for GW${game?.current_gameweek} have been saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["escalating-picks"] });
      navigate(`/games/${gameId}`);
    },
    onError: (error) => {
      console.error("Error submitting picks:", error);
      toast({
        title: "Error submitting picks",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  if (!game || !fixtures) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  const isDeadlinePassed = currentDeadline?.deadline && new Date(currentDeadline.deadline) <= new Date();
  const canSubmit = selectedPicks.length === requiredPicks && !isDeadlinePassed;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/games/${gameId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Game
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-amber-500" />
            Escalating Mode
          </h1>
          <p className="text-muted-foreground">Gameweek {game.current_gameweek} • {game.name}</p>
          {timeRemaining && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-600">{timeRemaining}</span>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select {requiredPicks} Pick{requiredPicks > 1 ? "s" : ""}</CardTitle>
              <CardDescription>
                Gameweek {game.current_gameweek - game.starting_gameweek + 1} of your escalating challenge. 
                Any wrong pick eliminates you.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {selectedPicks.length} / {requiredPicks}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {fixtures.map((fixture) => {
              const isHomeTeamPreviouslyPicked = previouslyPickedTeamIds.includes(fixture.home_team_id);
              const isAwayTeamPreviouslyPicked = previouslyPickedTeamIds.includes(fixture.away_team_id);
              const isHomeTeamSelectedNow = currentSelectedTeamIds.includes(fixture.home_team_id);
              const isAwayTeamSelectedNow = currentSelectedTeamIds.includes(fixture.away_team_id);
              const homeSelected = selectedPicks.some(p => p.fixtureId === fixture.id && p.side === "home");
              const awaySelected = selectedPicks.some(p => p.fixtureId === fixture.id && p.side === "away");

              return (
                <div key={fixture.id} className="border rounded-lg p-4">
                  <div className="text-center mb-4">
                    <div className="text-sm text-muted-foreground">
                      {new Date(fixture.kickoff_time).toLocaleDateString("en-GB", {
                        weekday: "short",
                        month: "short",
                        day: "numeric"
                      })} • {new Date(fixture.kickoff_time).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Home Team */}
                    <button
                      type="button"
                      disabled={isHomeTeamPreviouslyPicked || isHomeTeamSelectedNow && !homeSelected || isDeadlinePassed}
                      onClick={() => togglePick(fixture.id, "home", fixture.home_team_id, fixture.home_team?.name || "")}
                      className={`flex flex-col items-center p-4 border rounded-lg transition-all ${
                        isHomeTeamPreviouslyPicked
                          ? "opacity-40 cursor-not-allowed bg-muted"
                          : homeSelected
                          ? "bg-green-100 border-green-500 ring-2 ring-green-500/40"
                          : isHomeTeamSelectedNow
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-muted cursor-pointer"
                      }`}
                    >
                      <div className="w-12 h-12 mb-2 rounded-full overflow-hidden bg-white flex items-center justify-center border">
                        {fixture.home_team?.code ? (
                          <img 
                            src={`https://resources.premierleague.com/premierleague/badges/70/t${fixture.home_team.code}.png`}
                            alt={fixture.home_team.name}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <span className="font-bold text-sm">{fixture.home_team?.short_name}</span>
                        )}
                      </div>
                      <span className="font-medium text-sm">{fixture.home_team?.name}</span>
                      <span className="text-xs text-muted-foreground">(Home)</span>
                      {isHomeTeamPreviouslyPicked && (
                        <Badge variant="destructive" className="mt-1 text-xs">Already picked</Badge>
                      )}
                      {homeSelected && (
                        <Check className="h-5 w-5 text-green-600 mt-1" />
                      )}
                    </button>

                    {/* Away Team */}
                    <button
                      type="button"
                      disabled={isAwayTeamPreviouslyPicked || isAwayTeamSelectedNow && !awaySelected || isDeadlinePassed}
                      onClick={() => togglePick(fixture.id, "away", fixture.away_team_id, fixture.away_team?.name || "")}
                      className={`flex flex-col items-center p-4 border rounded-lg transition-all ${
                        isAwayTeamPreviouslyPicked
                          ? "opacity-40 cursor-not-allowed bg-muted"
                          : awaySelected
                          ? "bg-green-100 border-green-500 ring-2 ring-green-500/40"
                          : isAwayTeamSelectedNow
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-muted cursor-pointer"
                      }`}
                    >
                      <div className="w-12 h-12 mb-2 rounded-full overflow-hidden bg-white flex items-center justify-center border">
                        {fixture.away_team?.code ? (
                          <img 
                            src={`https://resources.premierleague.com/premierleague/badges/70/t${fixture.away_team.code}.png`}
                            alt={fixture.away_team.name}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <span className="font-bold text-sm">{fixture.away_team?.short_name}</span>
                        )}
                      </div>
                      <span className="font-medium text-sm">{fixture.away_team?.name}</span>
                      <span className="text-xs text-muted-foreground">(Away)</span>
                      {isAwayTeamPreviouslyPicked && (
                        <Badge variant="destructive" className="mt-1 text-xs">Already picked</Badge>
                      )}
                      {awaySelected && (
                        <Check className="h-5 w-5 text-green-600 mt-1" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Picks Summary */}
          {selectedPicks.length > 0 && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Your Selections:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedPicks.map((pick, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {pick.teamName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => submitPicksMutation.mutate()}
              disabled={!canSubmit || submitPicksMutation.isPending}
              size="lg"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {submitPicksMutation.isPending 
                ? "Saving..." 
                : `Submit ${requiredPicks} Pick${requiredPicks > 1 ? "s" : ""}`
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}