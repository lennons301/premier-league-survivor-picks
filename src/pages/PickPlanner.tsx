import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { ArrowLeft, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Team {
  id: string;
  name: string;
  short_name: string;
  code: number;
  strength_overall_home: number;
  strength_overall_away: number;
}

interface Fixture {
  id: string;
  gameweek: number;
  kickoff_time: string;
  home_team_id: string;
  away_team_id: string;
  home_team: Team;
  away_team: Team;
}

const PickPlanner = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [plannedPicks, setPlannedPicks] = useState<Record<number, string>>({});

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

  // Fetch all teams
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch upcoming fixtures (from current gameweek onwards)
  const { data: fixtures } = useQuery({
    queryKey: ["upcoming-fixtures", game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return [];
      const { data, error } = await supabase
        .from("fixtures")
        .select(`
          *,
          home_team:teams!fixtures_home_team_id_fkey (*),
          away_team:teams!fixtures_away_team_id_fkey (*)
        `)
        .gte("gameweek", game.current_gameweek)
        .order("gameweek")
        .order("kickoff_time");
      if (error) throw error;
      return data as Fixture[];
    },
    enabled: !!game?.current_gameweek,
  });

  // Fetch user's previous picks
  const { data: previousPicks } = useQuery({
    queryKey: ["previous-picks", gameId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("picks")
        .select("team_id, gameweek")
        .eq("game_id", gameId)
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get list of already picked team IDs
  const pickedTeamIds = useMemo(() => {
    return new Set(previousPicks?.map(p => p.team_id) || []);
  }, [previousPicks]);

  // Group fixtures by gameweek
  const fixturesByGameweek = useMemo(() => {
    if (!fixtures) return {};
    return fixtures.reduce((acc, fixture) => {
      if (!acc[fixture.gameweek]) {
        acc[fixture.gameweek] = [];
      }
      acc[fixture.gameweek].push(fixture);
      return acc;
    }, {} as Record<number, Fixture[]>);
  }, [fixtures]);

  // Get fixtures for a specific team
  const getTeamFixtures = (teamId: string) => {
    if (!fixtures) return [];
    return fixtures.filter(
      f => f.home_team_id === teamId || f.away_team_id === teamId
    );
  };

  // Calculate difficulty color based on opponent strength
  const getDifficultyColor = (isHome: boolean, opponentStrength: number) => {
    // Lower opponent strength = easier fixture (green)
    // Higher opponent strength = harder fixture (red)
    const threshold1 = 1200; // Very easy
    const threshold2 = 1300; // Easy
    const threshold3 = 1400; // Medium
    const threshold4 = 1500; // Hard
    
    if (opponentStrength < threshold1) return "bg-green-600 text-white";
    if (opponentStrength < threshold2) return "bg-green-500 text-white";
    if (opponentStrength < threshold3) return "bg-yellow-500 text-white";
    if (opponentStrength < threshold4) return "bg-orange-500 text-white";
    return "bg-red-600 text-white";
  };

  const togglePlannedPick = (gameweek: number, teamId: string) => {
    setPlannedPicks(prev => {
      if (prev[gameweek] === teamId) {
        const { [gameweek]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [gameweek]: teamId };
    });
  };

  if (!game || !teams || !fixtures) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-6">
          <div className="text-center">Loading pick planner...</div>
        </div>
      </div>
    );
  }

  const gameweeks = Object.keys(fixturesByGameweek).map(Number).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate(`/games/${gameId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Game
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="h-8 w-8 text-primary" />
              Pick Planner
            </h1>
            <p className="text-muted-foreground">{game.name}</p>
          </div>
        </div>

        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Difficulty Legend
              </CardTitle>
              <CardDescription>
                Fixtures are color-coded based on opponent strength
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-600 text-white">Very Easy</Badge>
                <Badge className="bg-green-500 text-white">Easy</Badge>
                <Badge className="bg-yellow-500 text-white">Medium</Badge>
                <Badge className="bg-orange-500 text-white">Hard</Badge>
                <Badge className="bg-red-600 text-white">Very Hard</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="by-team" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="by-team">By Team</TabsTrigger>
            <TabsTrigger value="by-gameweek">By Gameweek</TabsTrigger>
          </TabsList>

          <TabsContent value="by-team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Team Fixture Analysis</CardTitle>
                <CardDescription>
                  View upcoming fixtures for each team. Click a team to see their full schedule.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {teams.map((team) => {
                    const teamFixtures = getTeamFixtures(team.id);
                    const isAlreadyPicked = pickedTeamIds.has(team.id);
                    const isExpanded = selectedTeamId === team.id;

                    return (
                      <div
                        key={team.id}
                        className={`border rounded-lg p-4 transition-all ${
                          isAlreadyPicked ? "opacity-50" : ""
                        }`}
                      >
                        <button
                          onClick={() => setSelectedTeamId(isExpanded ? null : team.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={`https://resources.premierleague.com/premierleague/badges/70/t${team.code}.png`}
                                alt={team.name}
                                className="w-8 h-8 object-contain"
                              />
                              <div>
                                <h3 className="font-semibold">{team.name}</h3>
                                {isAlreadyPicked && (
                                  <Badge variant="destructive" className="text-xs">
                                    Already Picked
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <TrendingUp className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                          {!isExpanded && (
                            <div className="flex flex-wrap gap-1">
                              {teamFixtures.slice(0, 5).map((fixture) => {
                                const isHome = fixture.home_team_id === team.id;
                                const opponent = isHome ? fixture.away_team : fixture.home_team;
                                const opponentStrength = isHome
                                  ? opponent.strength_overall_away
                                  : opponent.strength_overall_home;
                                const difficultyColor = getDifficultyColor(isHome, opponentStrength);

                                return (
                                  <Badge
                                    key={fixture.id}
                                    className={`${difficultyColor} text-xs`}
                                  >
                                    {opponent.short_name} ({isHome ? "H" : "A"})
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-4 space-y-2">
                            {teamFixtures.map((fixture) => {
                              const isHome = fixture.home_team_id === team.id;
                              const opponent = isHome ? fixture.away_team : fixture.home_team;
                              const opponentStrength = isHome
                                ? opponent.strength_overall_away
                                : opponent.strength_overall_home;
                              const difficultyColor = getDifficultyColor(isHome, opponentStrength);

                              return (
                                <div
                                  key={fixture.id}
                                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">GW{fixture.gameweek}</Badge>
                                    <img
                                      src={`https://resources.premierleague.com/premierleague/badges/70/t${opponent.code}.png`}
                                      alt={opponent.name}
                                      className="w-6 h-6 object-contain"
                                    />
                                    <span className="font-medium">
                                      {opponent.short_name} {isHome ? "(H)" : "(A)"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={difficultyColor}>
                                      Difficulty: {opponentStrength}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                      {new Date(fixture.kickoff_time).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-gameweek" className="space-y-4">
            {gameweeks.map((gw) => (
              <Card key={gw}>
                <CardHeader>
                  <CardTitle>Gameweek {gw}</CardTitle>
                  <CardDescription>
                    {fixturesByGameweek[gw]?.length || 0} fixtures
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {fixturesByGameweek[gw]?.map((fixture) => {
                      const homeStrength = fixture.away_team.strength_overall_away;
                      const awayStrength = fixture.home_team.strength_overall_home;
                      const homeDifficultyColor = getDifficultyColor(true, homeStrength);
                      const awayDifficultyColor = getDifficultyColor(false, awayStrength);

                      return (
                        <div
                          key={fixture.id}
                          className="border rounded-lg p-4"
                        >
                          <div className="text-center text-sm text-muted-foreground mb-3">
                            {new Date(fixture.kickoff_time).toLocaleString()}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center">
                              <img
                                src={`https://resources.premierleague.com/premierleague/badges/70/t${fixture.home_team.code}.png`}
                                alt={fixture.home_team.name}
                                className="w-12 h-12 object-contain mb-2"
                              />
                              <span className="font-medium text-center text-sm">
                                {fixture.home_team.name}
                              </span>
                              <Badge className={`${homeDifficultyColor} text-xs mt-2`}>
                                vs {fixture.away_team.short_name}
                              </Badge>
                            </div>
                            <div className="flex flex-col items-center">
                              <img
                                src={`https://resources.premierleague.com/premierleague/badges/70/t${fixture.away_team.code}.png`}
                                alt={fixture.away_team.name}
                                className="w-12 h-12 object-contain mb-2"
                              />
                              <span className="font-medium text-center text-sm">
                                {fixture.away_team.name}
                              </span>
                              <Badge className={`${awayDifficultyColor} text-xs mt-2`}>
                                @ {fixture.home_team.short_name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PickPlanner;
