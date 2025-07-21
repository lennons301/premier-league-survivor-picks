import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Settings, Users, UserPlus, Target, Clock, TrendingUp } from "lucide-react";

const GameAdmin = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [gameweekToUpdate, setGameweekToUpdate] = useState("");

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

  // Fetch all users (for admin pick creation)
  const { data: users } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("display_name");
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
      return data;
    },
  });

  // Fetch game players
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
      
      // Get profiles separately
      const playersWithProfiles = await Promise.all(
        data.map(async (player: any) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", player.user_id)
            .single();
          
          return { ...player, profiles: profileData };
        })
      );
      
      return playersWithProfiles;
    },
  });

  // Create test users mutation
  const createTestUsersMutation = useMutation({
    mutationFn: async () => {
      const testUsers = [
        { email: "user_a@test.com", password: "password_a", display_name: "Test User A" },
        { email: "user_b@test.com", password: "password_b", display_name: "Test User B" },
        { email: "user_c@test.com", password: "password_c", display_name: "Test User C" },
        { email: "user_d@test.com", password: "password_d", display_name: "Test User D" },
      ];

      const results = [];
      const errors = [];
      
      for (const testUser of testUsers) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: testUser.email,
            password: testUser.password,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
              data: {
                display_name: testUser.display_name
              }
            }
          });
          
          if (error) {
            errors.push(`${testUser.email}: ${error.message}`);
          } else if (data.user) {
            results.push({ user: data.user, display_name: testUser.display_name });
          }
        } catch (err: any) {
          errors.push(`${testUser.email}: ${err.message}`);
        }
      }
      
      return { results, errors };
    },
    onSuccess: (data) => {
      const { results, errors } = data;
      if (results.length > 0) {
        toast({
          title: "Test users created",
          description: `${results.length} test users created successfully`,
        });
      }
      if (errors.length > 0) {
        toast({
          title: "Some errors occurred",
          description: `${errors.length} users failed to create`,
          variant: "destructive",
        });
        console.log("Test user creation errors:", errors);
      }
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (error) => {
      toast({
        title: "Error creating test users",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create pick for user mutation
  const createPickMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !selectedTeamId || !gameweekToUpdate) {
        throw new Error("Please select a user, team, and gameweek");
      }

      const { error } = await supabase
        .from("picks")
        .insert({
          user_id: selectedUserId,
          game_id: gameId,
          team_id: selectedTeamId,
          gameweek: parseInt(gameweekToUpdate),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Pick created",
        description: "Successfully created pick for the selected user",
      });
      setSelectedUserId("");
      setSelectedTeamId("");
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

  // Update game status mutation
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
                <Label>Select Team</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
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

              <Button
                onClick={() => createPickMutation.mutate()}
                disabled={createPickMutation.isPending || !selectedUserId || !selectedTeamId || !gameweekToUpdate}
                className="w-full"
              >
                {createPickMutation.isPending ? "Creating Pick..." : "Create Pick"}
              </Button>
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
                    <span className="font-medium">{player.profiles?.display_name}</span>
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
        </div>
      </div>
    </div>
  );
};

export default GameAdmin;