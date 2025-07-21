import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { 
  Settings, Target, Users, TrendingUp, UserPlus, Calendar, 
  Trophy, Clock, CheckCircle, XCircle, Plus, Edit 
} from "lucide-react";

const GameAdmin = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State for forms
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [selectedSide, setSelectedSide] = useState("");
  const [gameweekToUpdate, setGameweekToUpdate] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  // Fetch data
  const { data: game, isLoading } = useQuery({
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

  const { data: players } = useQuery({
    queryKey: ["game-players", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_players")
        .select(`
          *
        `)
        .eq("game_id", gameId);
      if (error) throw error;
      
      // Fetch profiles separately to avoid relation issues
      if (data && data.length > 0) {
        const userIds = data.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        
        // Merge the data
        return data.map(player => ({
          ...player,
          profiles: profiles?.find(p => p.user_id === player.user_id)
        }));
      }
      
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: fixtures } = useQuery({
    queryKey: ["fixtures", game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return [];
      const { data, error } = await supabase
        .from("fixtures")
        .select(`
          *,
          home_team:teams!fixtures_home_team_id_fkey(name, short_name),
          away_team:teams!fixtures_away_team_id_fkey(name, short_name)
        `)
        .eq("gameweek", game.current_gameweek);
      if (error) throw error;
      return data;
    },
    enabled: !!game?.current_gameweek,
  });

  const { data: gameweekDeadlines } = useQuery({
    queryKey: ["gameweek-deadlines", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gameweek_deadlines")
        .select("*")
        .eq("game_id", gameId)
        .order("gameweek");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const createTestUsersMutation = useMutation({
    mutationFn: async () => {
      const testUsers = [
        { email: "user_a@test.com", password: "password_a", display_name: "User A" },
        { email: "user_b@test.com", password: "password_b", display_name: "User B" },
        { email: "user_c@test.com", password: "password_c", display_name: "User C" },
      ];

      for (const testUser of testUsers) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: testUser.email,
            password: testUser.password,
            options: {
              data: { display_name: testUser.display_name }
            }
          });
          
          if (error && !error.message.includes("already registered")) {
            throw error;
          }
        } catch (error: any) {
          if (!error.message.includes("already registered")) {
            throw error;
          }
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Test users created",
        description: "Test users have been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating test users",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createPickMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !selectedFixtureId || !selectedSide || !gameweekToUpdate) {
        throw new Error("All fields are required");
      }

      // Get the team_id based on fixture and picked side
      const selectedFixture = fixtures?.find(f => f.id === selectedFixtureId);
      if (!selectedFixture) throw new Error("Fixture not found");
      
      const teamId = selectedSide === 'home' ? selectedFixture.home_team_id : selectedFixture.away_team_id;

      const { error } = await supabase
        .from("picks")
        .insert({
          user_id: selectedUserId,
          game_id: gameId,
          team_id: teamId,
          fixture_id: selectedFixtureId,
          picked_side: selectedSide,
          gameweek: parseInt(gameweekToUpdate),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Pick created",
        description: "Pick has been created successfully",
      });
      setSelectedUserId("");
      setSelectedFixtureId("");
      setSelectedSide("");
      setGameweekToUpdate("");
    },
    onError: (error) => {
      toast({
        title: "Error creating pick",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGameStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("games")
        .update({ status: newStatus })
        .eq("id", gameId);
      
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      toast({
        title: "Game status updated",
        description: `Game status changed to "${newStatus}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => {
      toast({
        title: "Error updating game status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createGameweekDeadlineMutation = useMutation({
    mutationFn: async () => {
      if (!gameweekToUpdate || !newDeadline) {
        throw new Error("Gameweek and deadline are required");
      }

      const { error } = await supabase
        .from("gameweek_deadlines")
        .upsert({
          game_id: gameId,
          gameweek: parseInt(gameweekToUpdate),
          deadline: new Date(newDeadline).toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Deadline set",
        description: "Gameweek deadline has been set successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["gameweek-deadlines", gameId] });
      setGameweekToUpdate("");
      setNewDeadline("");
    },
    onError: (error) => {
      toast({
        title: "Error setting deadline",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFixtureResultMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFixtureId || homeScore === "" || awayScore === "") {
        throw new Error("Fixture and scores are required");
      }

      // Update fixture result
      const { error: fixtureError } = await supabase
        .from("fixtures")
        .update({
          home_score: parseInt(homeScore),
          away_score: parseInt(awayScore),
          team_h_score: parseInt(homeScore),
          team_a_score: parseInt(awayScore),
          is_completed: true,
          finished: true,
        })
        .eq("id", selectedFixtureId);

      if (fixtureError) throw fixtureError;

      // Get all picks for this fixture
      const { data: picks, error: picksError } = await supabase
        .from("picks")
        .select("*")
        .eq("fixture_id", selectedFixtureId);
      if (picksError) throw picksError;

      // Process each pick to determine success/failure
      for (const pick of picks) {
        const pickedTeamScore = pick.picked_side === 'home' ? parseInt(homeScore) : parseInt(awayScore);
        const opponentScore = pick.picked_side === 'home' ? parseInt(awayScore) : parseInt(homeScore);
        const result = pickedTeamScore > opponentScore ? 'win' : pickedTeamScore < opponentScore ? 'lose' : 'draw';

        // Update pick result
        const { error: updateError } = await supabase
          .from("picks")
          .update({ result })
          .eq("id", pick.id);
        if (updateError) throw updateError;

        // Handle eliminations if pick failed
        if (result === 'lose' || result === 'draw') {
          // Check if this is the first gameweek of the game
          const { data: gameData, error: gameError } = await supabase
            .from("games")
            .select("starting_gameweek")
            .eq("id", pick.game_id)
            .single();
          if (gameError) throw gameError;

          // Only eliminate if it's NOT the first gameweek (unless admin override is implemented later)
          if (pick.gameweek > gameData.starting_gameweek) {
            const { error: eliminationError } = await supabase
              .from("game_players")
              .update({ 
                is_eliminated: true, 
                eliminated_gameweek: pick.gameweek 
              })
              .eq("game_id", pick.game_id)
              .eq("user_id", pick.user_id);
            if (eliminationError) throw eliminationError;
          }
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Fixture result updated successfully!",
        description: "Pick results and eliminations have been processed",
      });
      queryClient.invalidateQueries({ queryKey: ["fixtures", game?.current_gameweek] });
      queryClient.invalidateQueries({ queryKey: ["game-players"] });
      setSelectedFixtureId("");
      setHomeScore("");
      setAwayScore("");
    },
    onError: (error) => {
      toast({
        title: "Error updating fixture result",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processPickResults = async () => {
    if (!gameId || !game) return;

    try {
      // Get all picks for current gameweek
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select(`
          *,
          fixtures!inner(home_score, away_score, is_completed, home_team_id, away_team_id)
        `)
        .eq('game_id', gameId)
        .eq('gameweek', game.current_gameweek);

      if (picksError) throw picksError;

      // Process results for completed fixtures
      for (const pick of picks || []) {
        const fixture = pick.fixtures;
        if (!fixture.is_completed) continue;

        let result = 'pending';
        const homeScore = fixture.home_score;
        const awayScore = fixture.away_score;

        if (homeScore !== null && awayScore !== null) {
          if (pick.picked_side === 'home') {
            if (homeScore > awayScore) result = 'win';
            else if (homeScore < awayScore) result = 'loss';
            else result = 'draw';
          } else {
            if (awayScore > homeScore) result = 'win';
            else if (awayScore < homeScore) result = 'loss';
            else result = 'draw';
          }
        }

        // Update pick result
        await supabase
          .from('picks')
          .update({ result })
          .eq('id', pick.id);

        // If loss or draw, eliminate player
        if (result === 'loss' || result === 'draw') {
          await supabase
            .from('game_players')
            .update({
              is_eliminated: true,
              eliminated_gameweek: game.current_gameweek
            })
            .eq('game_id', gameId)
            .eq('user_id', pick.user_id);
        }
      }

      toast({
        title: "Pick results processed",
        description: "Player eliminations have been updated based on fixture results",
      });
      
      queryClient.invalidateQueries({ queryKey: ["game-players", gameId] });
    } catch (error: any) {
      toast({
        title: "Error processing results",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const progressGameweekMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("games")
        .update({ current_gameweek: (game?.current_gameweek || 1) + 1 })
        .eq("id", gameId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Gameweek progressed",
        description: `Advanced to gameweek ${(game?.current_gameweek || 1) + 1}`,
      });
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => {
      toast({
        title: "Error progressing gameweek",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if user is admin
  if (!user || !game || game.created_by !== user.id) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-6">
          <Card>
            <CardContent className="text-center py-8">
              <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
              <p className="text-muted-foreground">You don't have permission to access this admin panel.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Manage {game.name}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/games/${gameId}`)}>
            Back to Game
          </Button>
        </div>

        <Tabs defaultValue="game-management" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="game-management">Game</TabsTrigger>
            <TabsTrigger value="gameweeks">Gameweeks</TabsTrigger>
            <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
            <TabsTrigger value="picks">Picks</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
          </TabsList>

          <TabsContent value="game-management" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Game Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Game Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Current Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-blue-500 text-white">{game.status}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateGameStatusMutation.mutate("open")}
                      disabled={game.status === "open"}
                    >
                      Set Open
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateGameStatusMutation.mutate("active")}
                      disabled={game.status === "active"}
                    >
                      Set Active
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateGameStatusMutation.mutate("finished")}
                      disabled={game.status === "finished"}
                    >
                      Set Finished
                    </Button>
                  </div>

                  <Separator />

                  <div>
                    <Label>Quick Actions</Label>
                    <div className="flex flex-col gap-2 mt-2">
                      <Button
                        variant="outline"
                        onClick={() => createTestUsersMutation.mutate()}
                        disabled={createTestUsersMutation.isPending}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {createTestUsersMutation.isPending ? "Creating..." : "Create Test Users"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Game Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Game Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{players?.length || 0}</div>
                      <div className="text-sm text-muted-foreground">Total Players</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {players?.filter(p => !p.is_eliminated).length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {players?.filter(p => p.is_eliminated).length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Eliminated</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{game.current_gameweek}</div>
                      <div className="text-sm text-muted-foreground">Current GW</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="gameweeks" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Gameweek Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Gameweek Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Current Gameweek: {game.current_gameweek}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => progressGameweekMutation.mutate()}
                      disabled={progressGameweekMutation.isPending}
                      className="ml-2"
                    >
                      {progressGameweekMutation.isPending ? "Progressing..." : "Progress to Next GW"}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Set Deadline for Gameweek</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Gameweek"
                        value={gameweekToUpdate}
                        onChange={(e) => setGameweekToUpdate(e.target.value)}
                        min="1"
                        className="w-24"
                      />
                      <Input
                        type="datetime-local"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => createGameweekDeadlineMutation.mutate()}
                        disabled={createGameweekDeadlineMutation.isPending || !gameweekToUpdate || !newDeadline}
                      >
                        Set
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Deadlines */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Existing Deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {gameweekDeadlines?.map((deadline) => (
                      <div key={deadline.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="font-medium">GW {deadline.gameweek}</span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(deadline.deadline).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fixtures" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Update Fixture Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Update Fixture Results
                  </CardTitle>
                  <CardDescription>
                    Enter match results for gameweek {game.current_gameweek}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Select Fixture</Label>
                    <Select value={selectedFixtureId} onValueChange={setSelectedFixtureId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a fixture..." />
                      </SelectTrigger>
                      <SelectContent>
                        {fixtures?.map((fixture) => (
                          <SelectItem key={fixture.id} value={fixture.id}>
                            {fixture.home_team?.name} vs {fixture.away_team?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Home Score</Label>
                      <Input
                        type="number"
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div>
                      <Label>Away Score</Label>
                      <Input
                        type="number"
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        min="0"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => updateFixtureResultMutation.mutate()}
                    disabled={updateFixtureResultMutation.isPending || !selectedFixtureId || homeScore === "" || awayScore === ""}
                    className="w-full"
                  >
                    {updateFixtureResultMutation.isPending ? "Updating..." : "Update Result"}
                  </Button>
                </CardContent>
              </Card>

              {/* Current Fixtures */}
              <Card>
                <CardHeader>
                  <CardTitle>GW {game.current_gameweek} Fixtures</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {fixtures?.map((fixture) => (
                      <div key={fixture.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">
                            {fixture.home_team?.name} vs {fixture.away_team?.name}
                          </div>
                          {fixture.is_completed && (
                            <div className="text-sm text-muted-foreground">
                              {fixture.home_score} - {fixture.away_score}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {fixture.is_completed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="picks" className="space-y-6">
            {/* Create Pick for User */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Create Pick for User
                </CardTitle>
                <CardDescription>
                  Admin can create picks on behalf of any user
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Gameweek</Label>
                    <Input
                      type="number"
                      value={gameweekToUpdate}
                      onChange={(e) => setGameweekToUpdate(e.target.value)}
                      placeholder="Enter gameweek number"
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Select Fixture</Label>
                  <Select value={selectedFixtureId} onValueChange={setSelectedFixtureId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a fixture..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fixtures?.map((fixture) => (
                        <SelectItem key={fixture.id} value={fixture.id}>
                          {fixture.home_team?.name} vs {fixture.away_team?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Pick Side</Label>
                  <Select value={selectedSide} onValueChange={setSelectedSide}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose home or away..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home Team</SelectItem>
                      <SelectItem value="away">Away Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => createPickMutation.mutate()}
                  disabled={createPickMutation.isPending || !selectedUserId || !selectedFixtureId || !selectedSide || !gameweekToUpdate}
                  className="w-full"
                >
                  {createPickMutation.isPending ? "Creating Pick..." : "Create Pick"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            {/* Player Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Player Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {players?.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <span className="font-medium">{(player as any).profiles?.display_name || "Unknown"}</span>
                      <div className="flex items-center gap-2">
                        {player.is_eliminated ? (
                          <Badge variant="destructive">Eliminated GW{player.eliminated_gameweek}</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GameAdmin;
