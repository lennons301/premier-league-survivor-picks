import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFPLSync } from "@/hooks/useFPLSync";
import { ArrowLeft, Clock, Zap, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface FixturePrediction {
  fixtureId: string;
  prediction: "home_win" | "away_win" | "draw";
  preferenceOrder: number;
}

export default function TurboPick() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { syncFPLData } = useFPLSync();

  const [predictions, setPredictions] = useState<FixturePrediction[]>([]);
  const [fixtureOrder, setFixtureOrder] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  
  // Touch drag state
  const touchStartY = useRef<number>(0);
  const touchedItemRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Fetch existing picks for turbo mode
  const { data: existingPicks } = useQuery({
    queryKey: ["turbo-picks", gameId, game?.current_gameweek, user?.id],
    queryFn: async () => {
      if (!user?.id || !game?.current_gameweek) return [];
      const { data, error } = await supabase
        .from("picks")
        .select("*")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .eq("gameweek", game.current_gameweek)
        .order("preference_order", { ascending: true });
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

  // Initialize fixture order and predictions from existing picks or fixtures
  useEffect(() => {
    if (!fixtures?.length) return;

    if (existingPicks?.length) {
      // Restore from existing picks
      const orderedIds = existingPicks
        .sort((a, b) => (a.preference_order || 0) - (b.preference_order || 0))
        .map(p => p.fixture_id)
        .filter(Boolean) as string[];
      
      // Add any fixtures not in picks
      const remainingIds = fixtures
        .filter(f => !orderedIds.includes(f.id))
        .map(f => f.id);
      
      setFixtureOrder([...orderedIds, ...remainingIds]);
      
      setPredictions(existingPicks.map(p => ({
        fixtureId: p.fixture_id!,
        prediction: (p.predicted_result as "home_win" | "away_win" | "draw") || "home_win",
        preferenceOrder: p.preference_order || 0,
      })));
    } else {
      // Initialize with default order
      setFixtureOrder(fixtures.map(f => f.id));
      setPredictions(fixtures.map((f, index) => ({
        fixtureId: f.id,
        prediction: "home_win",
        preferenceOrder: index + 1,
      })));
    }
  }, [fixtures, existingPicks]);

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

  const updatePrediction = useCallback((fixtureId: string, prediction: "home_win" | "away_win" | "draw") => {
    setPredictions(prev => {
      const existing = prev.find(p => p.fixtureId === fixtureId);
      if (existing) {
        return prev.map(p => p.fixtureId === fixtureId ? { ...p, prediction } : p);
      }
      return [...prev, { fixtureId, prediction, preferenceOrder: fixtureOrder.indexOf(fixtureId) + 1 }];
    });
  }, [fixtureOrder]);

  const handleDragStart = (fixtureId: string) => {
    setDraggedItem(fixtureId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;
    
    setFixtureOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedItem);
      const targetIndex = newOrder.indexOf(targetId);
      
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      
      return newOrder;
    });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    // Update preference orders
    setPredictions(prev => 
      prev.map(p => ({
        ...p,
        preferenceOrder: fixtureOrder.indexOf(p.fixtureId) + 1
      }))
    );
  };

  // Move fixture up or down in order (for mobile/accessibility)
  const moveFixture = useCallback((fixtureId: string, direction: "up" | "down") => {
    setFixtureOrder(prev => {
      const newOrder = [...prev];
      const currentIndex = newOrder.indexOf(fixtureId);
      
      if (direction === "up" && currentIndex > 0) {
        [newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]];
      } else if (direction === "down" && currentIndex < newOrder.length - 1) {
        [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      }
      
      return newOrder;
    });
    
    // Update preference orders after move
    setPredictions(prev => 
      prev.map(p => ({
        ...p,
        preferenceOrder: fixtureOrder.indexOf(p.fixtureId) + 1
      }))
    );
  }, [fixtureOrder]);

  const submitPicksMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !game || !fixtures?.length) {
        throw new Error("Missing required data");
      }

      // Delete existing picks for this gameweek
      await supabase
        .from("picks")
        .delete()
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .eq("gameweek", game.current_gameweek);

      // Insert all predictions with preference order
      const picksToInsert = fixtureOrder.map((fixtureId, index) => {
        const fixture = fixtures.find(f => f.id === fixtureId);
        const prediction = predictions.find(p => p.fixtureId === fixtureId);
        
        // Determine team_id and picked_side based on prediction
        let teamId: string;
        let pickedSide: string;
        
        if (prediction?.prediction === "home_win") {
          teamId = fixture?.home_team_id || "";
          pickedSide = "home";
        } else if (prediction?.prediction === "away_win") {
          teamId = fixture?.away_team_id || "";
          pickedSide = "away";
        } else {
          // For draw, we still need to pick a team for the record
          teamId = fixture?.home_team_id || "";
          pickedSide = "draw";
        }

        return {
          game_id: gameId,
          user_id: user.id,
          fixture_id: fixtureId,
          team_id: teamId,
          picked_side: pickedSide,
          predicted_result: prediction?.prediction || "home_win",
          preference_order: index + 1,
          gameweek: game.current_gameweek,
        };
      });

      const { error } = await supabase.from("picks").insert(picksToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Turbo picks submitted!",
        description: `Your ${fixtureOrder.length} predictions have been saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["turbo-picks"] });
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
  const allPredictionsMade = fixtureOrder.every(id => 
    predictions.some(p => p.fixtureId === id && p.prediction)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/games/${gameId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Game
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-7 w-7 text-yellow-500" />
            Turbo Mode
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
          <CardTitle>Rank Your Predictions</CardTitle>
          <CardDescription>
            Drag fixtures to reorder by confidence (top = most confident). 
            Predict the result for each match. Most consecutive correct predictions from your #1 pick wins!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" ref={containerRef}>
            {fixtureOrder.map((fixtureId, index) => {
              const fixture = fixtures.find(f => f.id === fixtureId);
              if (!fixture) return null;
              
              const prediction = predictions.find(p => p.fixtureId === fixtureId);
              const isFirst = index === 0;
              const isLast = index === fixtureOrder.length - 1;

              return (
                <div
                  key={fixtureId}
                  draggable={!isDeadlinePassed}
                  onDragStart={() => handleDragStart(fixtureId)}
                  onDragOver={(e) => handleDragOver(e, fixtureId)}
                  onDragEnd={handleDragEnd}
                  className={`border rounded-lg p-4 transition-all bg-card ${
                    draggedItem === fixtureId ? "opacity-50 scale-95" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Reorder controls - visible buttons for mobile, drag handle for desktop */}
                    <div className="flex flex-col items-center gap-1">
                      {!isDeadlinePassed && (
                        <>
                          {/* Mobile reorder buttons */}
                          <div className="flex flex-col sm:hidden">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => moveFixture(fixtureId, "up")}
                              disabled={isFirst}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Badge variant="outline" className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs">
                              {index + 1}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => moveFixture(fixtureId, "down")}
                              disabled={isLast}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                          {/* Desktop drag handle */}
                          <div className="hidden sm:flex items-center gap-2 cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </Badge>
                          </div>
                        </>
                      )}
                      {isDeadlinePassed && (
                        <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-white flex items-center justify-center border flex-shrink-0">
                            {fixture.home_team?.code ? (
                              <img 
                                src={`https://resources.premierleague.com/premierleague/badges/70/t${fixture.home_team.code}.png`}
                                alt={fixture.home_team.name}
                                className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                              />
                            ) : (
                              <span className="text-xs font-bold">{fixture.home_team?.short_name}</span>
                            )}
                          </div>
                          <span className="font-medium text-sm sm:text-base">{fixture.home_team?.short_name}</span>
                          <span className="text-muted-foreground text-sm">vs</span>
                          <span className="font-medium text-sm sm:text-base">{fixture.away_team?.short_name}</span>
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-white flex items-center justify-center border flex-shrink-0">
                            {fixture.away_team?.code ? (
                              <img 
                                src={`https://resources.premierleague.com/premierleague/badges/70/t${fixture.away_team.code}.png`}
                                alt={fixture.away_team.name}
                                className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                              />
                            ) : (
                              <span className="text-xs font-bold">{fixture.away_team?.short_name}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {new Date(fixture.kickoff_time).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short"
                          })}
                        </span>
                      </div>
                      
                      <RadioGroup
                        value={prediction?.prediction || ""}
                        onValueChange={(value) => updatePrediction(fixtureId, value as "home_win" | "away_win" | "draw")}
                        disabled={isDeadlinePassed}
                        className="flex flex-wrap gap-2 sm:gap-4"
                      >
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <RadioGroupItem value="home_win" id={`${fixtureId}-home`} />
                          <Label htmlFor={`${fixtureId}-home`} className="cursor-pointer text-xs sm:text-sm">
                            {fixture.home_team?.short_name} Win
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <RadioGroupItem value="draw" id={`${fixtureId}-draw`} />
                          <Label htmlFor={`${fixtureId}-draw`} className="cursor-pointer text-xs sm:text-sm">
                            Draw
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <RadioGroupItem value="away_win" id={`${fixtureId}-away`} />
                          <Label htmlFor={`${fixtureId}-away`} className="cursor-pointer text-xs sm:text-sm">
                            {fixture.away_team?.short_name} Win
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => submitPicksMutation.mutate()}
              disabled={isDeadlinePassed || !allPredictionsMade || submitPicksMutation.isPending}
              size="lg"
            >
              <Zap className="h-4 w-4 mr-2" />
              {submitPicksMutation.isPending ? "Saving..." : "Save Turbo Picks"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}