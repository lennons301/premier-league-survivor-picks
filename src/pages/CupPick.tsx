import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Award, GripVertical, ChevronUp, ChevronDown, AlertCircle, Heart, Home, Plane } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CupFixture {
  id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  tier_difference: number;
  home_goals: number | null;
  away_goals: number | null;
  fixture_order: number;
}

interface FixturePrediction {
  fixtureId: string;
  pickedTeam: "home" | "away";
  preferenceOrder: number;
}

export default function CupPick() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [predictions, setPredictions] = useState<FixturePrediction[]>([]);
  const [fixtureOrder, setFixtureOrder] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

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

  // Fetch cup fixtures for this game
  const { data: fixtures } = useQuery({
    queryKey: ["cup-fixtures", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cup_fixtures")
        .select("*")
        .eq("game_id", gameId)
        .order("fixture_order");
      if (error) throw error;
      return data as CupFixture[];
    },
    enabled: !!gameId,
  });

  // Fetch existing cup picks
  const { data: existingPicks } = useQuery({
    queryKey: ["cup-picks", gameId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("cup_picks")
        .select("*")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .order("preference_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!gameId,
  });

  // Fetch current deadline
  const { data: currentDeadline } = useQuery({
    queryKey: ["cup-deadline", gameId, game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return null;
      
      const { data: gameDeadline } = await supabase
        .from("gameweek_deadlines")
        .select("*")
        .eq("game_id", gameId)
        .eq("gameweek", game.current_gameweek)
        .single();
      
      return gameDeadline;
    },
    enabled: !!game?.current_gameweek,
  });

  // Initialize fixture order and predictions
  useEffect(() => {
    if (!fixtures?.length) return;

    if (existingPicks?.length) {
      const orderedIds = existingPicks
        .sort((a, b) => (a.preference_order || 0) - (b.preference_order || 0))
        .map(p => p.fixture_id)
        .filter(Boolean) as string[];
      
      const remainingIds = fixtures
        .filter(f => !orderedIds.includes(f.id))
        .map(f => f.id);
      
      setFixtureOrder([...orderedIds, ...remainingIds]);
      
      setPredictions(existingPicks.map(p => ({
        fixtureId: p.fixture_id!,
        pickedTeam: p.picked_team as "home" | "away",
        preferenceOrder: p.preference_order || 0,
      })));
    } else {
      setFixtureOrder(fixtures.map(f => f.id));
      setPredictions([]);
    }
  }, [fixtures, existingPicks]);

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

  const updatePrediction = useCallback((fixtureId: string, pickedTeam: "home" | "away") => {
    setPredictions(prev => {
      const existing = prev.find(p => p.fixtureId === fixtureId);
      if (existing) {
        return prev.map(p => p.fixtureId === fixtureId ? { ...p, pickedTeam } : p);
      }
      return [...prev, { fixtureId, pickedTeam, preferenceOrder: fixtureOrder.indexOf(fixtureId) + 1 }];
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
  };

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
  }, []);

  // Check if a pick is valid (can't pick team >1 tier below opponent)
  const isPickValid = (fixture: CupFixture, pickedTeam: "home" | "away"): { valid: boolean; warning?: string } => {
    // tier_difference is from home team perspective
    // positive = home is higher tier, negative = home is lower tier
    const tierDiffFromPicked = pickedTeam === "home" ? fixture.tier_difference : -fixture.tier_difference;
    
    // Can't pick a team playing >1 level below (tier_diff > 1 means picked team is much higher)
    if (tierDiffFromPicked > 1) {
      return { 
        valid: false, 
        warning: `Cannot pick - opponent is ${tierDiffFromPicked} tiers below` 
      };
    }
    
    // Warning for no goals if picking against team 1 tier below
    if (tierDiffFromPicked === 1) {
      return { 
        valid: true, 
        warning: "No tiebreaker goals from this pick" 
      };
    }
    
    // Lives available if picking against higher tier
    if (tierDiffFromPicked < 0) {
      const potentialLives = Math.abs(tierDiffFromPicked);
      return { 
        valid: true, 
        warning: `Win = +${potentialLives} ${potentialLives === 1 ? 'life' : 'lives'}. Draw also qualifies!` 
      };
    }
    
    return { valid: true };
  };

  const submitPicksMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !game || !fixtures?.length) {
        throw new Error("Missing required data");
      }

      // Delete existing picks
      await supabase
        .from("cup_picks")
        .delete()
        .eq("game_id", gameId)
        .eq("user_id", user.id);

      // Get first 10 fixtures in order with valid picks
      const picksToInsert = fixtureOrder
        .slice(0, 10)
        .map((fixtureId, index) => {
          const prediction = predictions.find(p => p.fixtureId === fixtureId);
          if (!prediction) return null;
          
          return {
            game_id: gameId,
            user_id: user.id,
            fixture_id: fixtureId,
            picked_team: prediction.pickedTeam,
            preference_order: index + 1,
          };
        })
        .filter(Boolean);

      if (picksToInsert.length < 10) {
        throw new Error(`You must make 10 picks. Currently have ${picksToInsert.length}.`);
      }

      const { error } = await supabase.from("cup_picks").insert(picksToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Cup picks submitted!",
        description: "Your 10 predictions have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["cup-picks"] });
      navigate(`/games/${gameId}`);
    },
    onError: (error) => {
      console.error("Error submitting picks:", error);
      toast({
        title: "Error submitting picks",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!game || !fixtures) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (fixtures.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate(`/games/${gameId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Game
        </Button>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No fixtures available yet. The game admin needs to upload fixtures first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isDeadlinePassed = currentDeadline?.deadline && new Date(currentDeadline.deadline) <= new Date();
  const first10Fixtures = fixtureOrder.slice(0, 10);
  const allPredictionsMade = first10Fixtures.every(id => 
    predictions.some(p => p.fixtureId === id && p.pickedTeam)
  );
  
  // Check all predictions are valid
  const allPicksValid = first10Fixtures.every(id => {
    const fixture = fixtures.find(f => f.id === id);
    const prediction = predictions.find(p => p.fixtureId === id);
    if (!fixture || !prediction) return false;
    return isPickValid(fixture, prediction.pickedTeam).valid;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/games/${gameId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Game
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-7 w-7 text-purple-500" />
            FA Cup Mode
          </h1>
          <p className="text-muted-foreground">{game.name}</p>
          {timeRemaining && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-600">{timeRemaining}</span>
            </div>
          )}
        </div>
      </div>

      {/* Rules summary */}
      <Alert>
        <Heart className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Cup Rules:</strong> Rank your top 10 fixtures. Win against a higher-tier team = earn lives. 
          Lives save you from elimination on subsequent losses. Draw against higher tier also qualifies!
        </AlertDescription>
      </Alert>

      {/* Selection Summary */}
      {(() => {
        // Calculate stats for top 10 picks
        const stats = first10Fixtures.reduce((acc, fixtureId) => {
          const fixture = fixtures.find(f => f.id === fixtureId);
          const prediction = predictions.find(p => p.fixtureId === fixtureId);
          
          if (!fixture || !prediction) return acc;
          
          // Calculate lives from this pick
          const tierDiffFromPicked = prediction.pickedTeam === "home" 
            ? fixture.tier_difference 
            : -fixture.tier_difference;
          
          if (tierDiffFromPicked < 0) {
            acc.possibleLives += Math.abs(tierDiffFromPicked);
          }
          
          // Count superior team picks (picking underdog against higher tier)
          if (tierDiffFromPicked < 0) {
            acc.superiorTeamsPicked++;
          }
          
          // Count home/away picks
          if (prediction.pickedTeam === "home") {
            acc.homePicks++;
          } else {
            acc.awayPicks++;
          }
          
          return acc;
        }, { possibleLives: 0, superiorTeamsPicked: 0, homePicks: 0, awayPicks: 0 });
        
        const totalPicks = predictions.filter(p => first10Fixtures.includes(p.fixtureId)).length;
        
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Selection Summary</CardTitle>
              <CardDescription>Overview of your top 10 picks</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-green-600" />
                      Possible Lives
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {stats.possibleLives}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-purple-600" />
                      Superior Teams Picked
                    </TableCell>
                    <TableCell className="text-right font-semibold text-purple-600">
                      {stats.superiorTeamsPicked}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-blue-600" />
                      Home Wins Picked
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-600">
                      {stats.homePicks}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-orange-600" />
                      Away Wins Picked
                    </TableCell>
                    <TableCell className="text-right font-semibold text-orange-600">
                      {stats.awayPicks}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {totalPicks < 10 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {10 - totalPicks} pick{10 - totalPicks !== 1 ? 's' : ''} remaining
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle>Rank Your Picks</CardTitle>
          <CardDescription>
            Select your top 10 fixtures in order of preference. First 10 ranked are your active picks.
            Cannot pick teams playing &gt;1 tier below their opponent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fixtureOrder.map((fixtureId, index) => {
              const fixture = fixtures.find(f => f.id === fixtureId);
              if (!fixture) return null;
              
              const prediction = predictions.find(p => p.fixtureId === fixtureId);
              const isActive = index < 10;
              const isFirst = index === 0;
              const isLast = index === fixtureOrder.length - 1;
              
              const homeValid = isPickValid(fixture, "home");
              const awayValid = isPickValid(fixture, "away");
              const currentPickValid = prediction ? isPickValid(fixture, prediction.pickedTeam) : null;

              // Determine life/warning info for non-selected fixtures
              const getFixtureInfo = () => {
                const homeInfo = isPickValid(fixture, "home");
                const awayInfo = isPickValid(fixture, "away");
                
                // Check if any pick gives lives
                const homeLives = fixture.tier_difference < 0 ? Math.abs(fixture.tier_difference) : 0;
                const awayLives = fixture.tier_difference > 0 ? fixture.tier_difference : 0;
                
                // Check if invalid pick exists
                const hasInvalidOption = !homeInfo.valid || !awayInfo.valid;
                
                return { homeInfo, awayInfo, homeLives, awayLives, hasInvalidOption };
              };
              
              const fixtureInfo = getFixtureInfo();

              return (
                <div
                  key={fixtureId}
                  draggable={!isDeadlinePassed}
                  onDragStart={() => handleDragStart(fixtureId)}
                  onDragOver={(e) => handleDragOver(e, fixtureId)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-lg p-4 transition-all ${
                    draggedItem === fixtureId ? "opacity-50 scale-95" : ""
                  } ${isActive 
                    ? "border bg-card" 
                    : "border-2 border-dashed border-muted-foreground/30 bg-muted/10"
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Reorder controls */}
                    <div className="flex flex-col items-center gap-1">
                      {!isDeadlinePassed && (
                        <>
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
                            <Badge 
                              variant={isActive ? "default" : "secondary"} 
                              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                            >
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
                          <div className="hidden sm:flex items-center gap-2 cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <Badge 
                              variant={isActive ? "default" : "secondary"} 
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                            >
                              {index + 1}
                            </Badge>
                          </div>
                        </>
                      )}
                      {isDeadlinePassed && (
                        <Badge 
                          variant={isActive ? "default" : "secondary"} 
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                        >
                          {index + 1}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Teams */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-medium text-sm sm:text-base">{fixture.home_team}</span>
                        <span className="text-muted-foreground text-sm">vs</span>
                        <span className="font-medium text-sm sm:text-base">{fixture.away_team}</span>
                        {fixture.tier_difference !== 0 && (
                          <Badge variant="outline" className="text-xs">
                            {fixture.tier_difference > 0 
                              ? `Home +${fixture.tier_difference} tier${fixture.tier_difference > 1 ? 's' : ''}` 
                              : `Away +${Math.abs(fixture.tier_difference)} tier${Math.abs(fixture.tier_difference) > 1 ? 's' : ''}`
                            }
                          </Badge>
                        )}
                      </div>
                      
                      {/* Info badges for all fixtures */}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {/* Life opportunity badges */}
                        {fixtureInfo.awayLives > 0 && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                            <Heart className="h-3 w-3 mr-1" />
                            {fixture.away_team}: +{fixtureInfo.awayLives} {fixtureInfo.awayLives === 1 ? 'life' : 'lives'}
                          </Badge>
                        )}
                        {fixtureInfo.homeLives > 0 && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                            <Heart className="h-3 w-3 mr-1" />
                            {fixture.home_team}: +{fixtureInfo.homeLives} {fixtureInfo.homeLives === 1 ? 'life' : 'lives'}
                          </Badge>
                        )}
                        {/* Invalid pick warnings */}
                        {!fixtureInfo.homeInfo.valid && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-300">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {fixture.home_team}: Invalid
                          </Badge>
                        )}
                        {!fixtureInfo.awayInfo.valid && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-300">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {fixture.away_team}: Invalid
                          </Badge>
                        )}
                        {/* No goals warning */}
                        {fixtureInfo.homeInfo.valid && fixture.tier_difference === 1 && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                            {fixture.home_team}: No goals
                          </Badge>
                        )}
                        {fixtureInfo.awayInfo.valid && fixture.tier_difference === -1 && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                            {fixture.away_team}: No goals
                          </Badge>
                        )}
                      </div>
                      
                      {/* Pick selection - show for active picks when deadline not passed */}
                      {isActive && !isDeadlinePassed && (
                        <RadioGroup
                          value={prediction?.pickedTeam || ""}
                          onValueChange={(value) => updatePrediction(fixtureId, value as "home" | "away")}
                          className="flex flex-wrap gap-4 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem 
                              value="home" 
                              id={`${fixtureId}-home`}
                              disabled={!homeValid.valid}
                            />
                            <Label 
                              htmlFor={`${fixtureId}-home`} 
                              className={`cursor-pointer text-sm ${!homeValid.valid ? 'text-muted-foreground line-through' : ''}`}
                            >
                              {fixture.home_team} Win
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem 
                              value="away" 
                              id={`${fixtureId}-away`}
                              disabled={!awayValid.valid}
                            />
                            <Label 
                              htmlFor={`${fixtureId}-away`} 
                              className={`cursor-pointer text-sm ${!awayValid.valid ? 'text-muted-foreground line-through' : ''}`}
                            >
                              {fixture.away_team} Win
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                      
                      {/* Warning/info message for active picks */}
                      {isActive && currentPickValid?.warning && (
                        <p className={`text-xs mt-1 ${currentPickValid.valid ? 'text-amber-600' : 'text-destructive'}`}>
                          {currentPickValid.warning}
                        </p>
                      )}
                      
                      {/* Show selected pick when deadline passed */}
                      {isActive && isDeadlinePassed && prediction && (
                        <Badge variant="secondary" className="text-xs">
                          Picked: {prediction.pickedTeam === "home" ? fixture.home_team : fixture.away_team}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => submitPicksMutation.mutate()}
              disabled={isDeadlinePassed || !allPredictionsMade || !allPicksValid || submitPicksMutation.isPending}
              className="gap-2"
            >
              <Award className="h-4 w-4" />
              {submitPicksMutation.isPending ? "Saving..." : "Save Cup Picks"}
            </Button>
          </div>
          
          {!allPredictionsMade && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Select a winner for all 10 active picks to submit
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}