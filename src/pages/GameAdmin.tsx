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
import RemovePlayerDialog from "@/components/RemovePlayerDialog";
import CupFixtureUpload from "@/components/CupFixtureUpload";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Settings, Target, Users, TrendingUp, UserPlus, Calendar, 
  Trophy, Clock, CheckCircle, XCircle, Plus, Edit, Lock, Unlock, Trash2 
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
  const [adminFee, setAdminFee] = useState("");
  const [selectedSplitWinners, setSelectedSplitWinners] = useState<string[]>([]);

  // State for remove player dialog
  const [removePlayerDialog, setRemovePlayerDialog] = useState<{
    isOpen: boolean;
    playerId: string | null;
    playerName: string;
    userId: string | null;
  }>({
    isOpen: false,
    playerId: null,
    playerName: "",
    userId: null,
  });

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
    queryFn: async (): Promise<Array<{
      id: string;
      game_id: string;
      user_id: string;
      joined_at: string;
      is_eliminated: boolean;
      eliminated_gameweek: number | null;
      profiles?: { user_id: string; display_name: string };
    }>> => {
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
      
      return data || [];
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

  // Fetch game gameweek status
  const { data: gameGameweek } = useQuery({
    queryKey: ["game-gameweek", gameId, game?.current_gameweek],
    queryFn: async () => {
      if (!game?.current_gameweek) return null;
      const { data, error } = await supabase
        .from("game_gameweeks")
        .select("*")
        .eq("game_id", gameId)
        .eq("gameweek_number", game.current_gameweek)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!game?.current_gameweek,
  });

  const { data: prizePot } = useQuery({
    queryKey: ['prizePot', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('calculate_prize_pot', { p_game_id: gameId });
      if (error) throw error;
      return data as number;
    },
    enabled: !!gameId,
  });

  // Mutations
  const createTestUsersMutation = useMutation({
    mutationFn: async () => {
      const testUsers = [
        { email: "user_a@test.com", password: "password_a", display_name: "User A", id: "74ca49f4-c848-4e87-9d7f-2861713e9139" },
        { email: "user_b@test.com", password: "password_b", display_name: "User B", id: "d5acf5c0-2170-437d-afb9-da3f72b5fd13" },
        { email: "user_c@test.com", password: "password_c", display_name: "User C", id: "610e271a-cd40-4b70-b9b6-b4eb4fe07c0d" },
      ];

      console.log("Starting test user addition to game...");
      
      // Since the users already exist, we'll just use their known IDs and add them to the game
      // The admin (currently signed in) should be able to add any user to their game
      let addedCount = 0;
      
      for (const testUser of testUsers) {
        console.log(`Checking if user ${testUser.id} (${testUser.display_name}) is already in game ${gameId}`);
        
        // Check if user is already in the game
        const { data: existingPlayer, error: checkError } = await supabase
          .from("game_players")
          .select("id")
          .eq("game_id", gameId)
          .eq("user_id", testUser.id)
          .maybeSingle();

        console.log(`Existing player check for ${testUser.display_name}:`, { existingPlayer, checkError });

        // Only add if not already in the game
        if (!existingPlayer) {
          console.log(`Adding user ${testUser.id} (${testUser.display_name}) to game ${gameId} as admin`);
          const { error } = await supabase
            .from("game_players")
            .insert({
              game_id: gameId,
              user_id: testUser.id
            });
          
          if (!error) {
            addedCount++;
            console.log(`Successfully added ${testUser.display_name} to game`);
          } else {
            console.log(`Error adding ${testUser.display_name} to game:`, error);
          }
        } else {
          console.log(`${testUser.display_name} is already in the game`);
        }
      }

      console.log(`Final result: ${addedCount} users added out of ${testUsers.length} total users`);
      return { totalUsers: testUsers.length, addedCount };
    },
    onSuccess: ({ totalUsers, addedCount }) => {
      toast({
        title: "Test users processed successfully",
        description: `Found ${totalUsers} test users, added ${addedCount} new players to the game`,
      });
      // Refresh the players list
      queryClient.invalidateQueries({ queryKey: ["game-players", gameId] });
    },
    onError: (error) => {
      console.error("Test user creation error:", error);
      toast({
        title: "Error processing test users",
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
        const result = pickedTeamScore > opponentScore ? 'win' : pickedTeamScore < opponentScore ? 'loss' : 'draw';

        // Update pick result
        const { error: updateError } = await supabase
          .from("picks")
          .update({ result })
          .eq("id", pick.id);
        if (updateError) throw updateError;

        // Handle eliminations if pick failed
        if (result === 'loss' || result === 'draw') {
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
      const currentGw = game?.current_gameweek || 1;
      const nextGw = currentGw + 1;

      // Mark current gameweek as finished
      const { error: finishError } = await supabase
        .from("game_gameweeks")
        .update({ 
          status: 'finished',
          picks_visible: true
        })
        .eq("game_id", gameId)
        .eq("gameweek_number", currentGw);

      if (finishError) throw finishError;

      // Set next gameweek to open (so users can make picks)
      const { error: openError } = await supabase
        .from("game_gameweeks")
        .update({ 
          status: 'open',
          picks_visible: false
        })
        .eq("game_id", gameId)
        .eq("gameweek_number", nextGw);

      if (openError) throw openError;

      // Update game's current gameweek
      const { error } = await supabase
        .from("games")
        .update({ current_gameweek: nextGw })
        .eq("id", gameId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Gameweek progressed",
        description: `Advanced to gameweek ${(game?.current_gameweek || 1) + 1}`,
      });
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      queryClient.invalidateQueries({ queryKey: ["game-gameweek", gameId] });
    },
    onError: (error) => {
      toast({
        title: "Error progressing gameweek",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to open gameweek (from upcoming to open - allows picks)
  const openGameweekMutation = useMutation({
    mutationFn: async () => {
      if (!gameGameweek) throw new Error("Game gameweek not found");
      
      const { error } = await supabase
        .from("game_gameweeks")
        .update({ 
          status: 'open',
          picks_visible: false
        })
        .eq("id", gameGameweek.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Gameweek opened",
        description: "Users can now make picks for this gameweek",
      });
      queryClient.invalidateQueries({ queryKey: ["game-gameweek", gameId, game?.current_gameweek] });
    },
    onError: (error) => {
      toast({
        title: "Error opening gameweek",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to activate gameweek manually (from open to active - locks picks and makes visible)
  const activateGameweekMutation = useMutation({
    mutationFn: async () => {
      if (!gameGameweek) throw new Error("Game gameweek not found");
      
      const { error } = await supabase
        .from("game_gameweeks")
        .update({ 
          status: 'active',
          picks_visible: true
        })
        .eq("id", gameGameweek.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Gameweek activated",
        description: "Picks are now visible for the current gameweek",
      });
      queryClient.invalidateQueries({ queryKey: ["game-gameweek", gameId, game?.current_gameweek] });
    },
    onError: (error) => {
      toast({
        title: "Error activating gameweek",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // New mutation to remove player
  const removePlayerMutation = useMutation({
    mutationFn: async ({ playerId, userId }: { playerId: string; userId: string }) => {
      // First, remove all picks for this user in this game
      const { error: picksError } = await supabase
        .from("picks")
        .delete()
        .eq("game_id", gameId)
        .eq("user_id", userId);

      if (picksError) throw picksError;

      // Then remove the player from the game
      const { error: playerError } = await supabase
        .from("game_players")
        .delete()
        .eq("id", playerId);

      if (playerError) throw playerError;
    },
    onSuccess: () => {
      toast({
        title: "Player removed",
        description: "Player has been successfully removed from the game",
      });
      queryClient.invalidateQueries({ queryKey: ["game-players", gameId] });
      setRemovePlayerDialog({ isOpen: false, playerId: null, playerName: "", userId: null });
    },
    onError: (error) => {
      toast({
        title: "Error removing player",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemovePlayer = (playerId: string, playerName: string, userId: string) => {
    setRemovePlayerDialog({
      isOpen: true,
      playerId,
      playerName,
      userId,
    });
  };

  const confirmRemovePlayer = () => {
    if (removePlayerDialog.playerId && removePlayerDialog.userId) {
      removePlayerMutation.mutate({
        playerId: removePlayerDialog.playerId,
        userId: removePlayerDialog.userId,
      });
    }
  };

  // Mutation to end game as split with selected winners
  const endGameAsSplitMutation = useMutation({
    mutationFn: async ({ adminFeeAmount, winnerUserIds }: { adminFeeAmount: number; winnerUserIds: string[] }) => {
      if (winnerUserIds.length === 0) {
        throw new Error("At least one winner must be selected");
      }

      // Calculate prize pot
      const prizePot = await supabase.rpc('calculate_prize_pot', { p_game_id: gameId });
      if (prizePot.error) throw prizePot.error;

      const remainingAmount = (prizePot.data as number) - adminFeeAmount;
      if (remainingAmount < 0) {
        throw new Error("Admin fee cannot exceed prize pot");
      }

      const splitAmount = remainingAmount / winnerUserIds.length;

      // Update game status
      const { error: gameError } = await supabase
        .from("games")
        .update({ 
          status: 'finished',
          admin_fee: adminFeeAmount,
          updated_at: new Date().toISOString()
        })
        .eq("id", gameId);
      
      if (gameError) throw gameError;

      // Insert winners for each selected player
      for (const winnerId of winnerUserIds) {
        const { error: winnerError } = await supabase
          .from("game_winners")
          .insert({
            game_id: gameId,
            user_id: winnerId,
            payout_amount: splitAmount,
            is_split: true
          });
        if (winnerError) throw winnerError;
      }
    },
    onSuccess: () => {
      toast({
        title: "Game ended as split",
        description: `Prize pot has been split among ${selectedSplitWinners.length} selected winners`,
      });
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      queryClient.invalidateQueries({ queryKey: ["game-players", gameId] });
      setAdminFee("");
      setSelectedSplitWinners([]);
    },
    onError: (error) => {
      toast({
        title: "Error ending game",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEndGameAsSplit = () => {
    const fee = parseFloat(adminFee) || 0;
    if (fee < 0) {
      toast({
        title: "Invalid admin fee",
        description: "Admin fee cannot be negative",
        variant: "destructive",
      });
      return;
    }
    if (selectedSplitWinners.length === 0) {
      toast({
        title: "No winners selected",
        description: "Please select at least one player to receive the split",
        variant: "destructive",
      });
      return;
    }
    endGameAsSplitMutation.mutate({ adminFeeAmount: fee, winnerUserIds: selectedSplitWinners });
  };

  const toggleSplitWinner = (userId: string) => {
    setSelectedSplitWinners(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

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

                  <Separator />

                  <div>
                    <Label>End Game as Split</Label>
                    <p className="text-sm text-muted-foreground mt-1 mb-3">
                      Select winners to split the prize pot
                    </p>
                    <div className="space-y-3">
                      {/* Player selection */}
                      <div>
                        <Label className="mb-2 block">Select Winners ({selectedSplitWinners.length} selected)</Label>
                        <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2">
                          {players?.map(player => (
                            <div 
                              key={player.id} 
                              className={`flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer ${
                                player.is_eliminated ? 'opacity-50' : ''
                              }`}
                              onClick={() => toggleSplitWinner(player.user_id)}
                            >
                              <Checkbox 
                                checked={selectedSplitWinners.includes(player.user_id)}
                                onCheckedChange={() => toggleSplitWinner(player.user_id)}
                              />
                              <span className="flex-1">
                                {player.profiles?.display_name || 'Unknown'}
                              </span>
                              {player.is_eliminated && (
                                <Badge variant="destructive" className="text-xs">Eliminated</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="adminFee">Admin Fee (£)</Label>
                        <Input
                          id="adminFee"
                          type="number"
                          step="0.01"
                          min="0"
                          value={adminFee}
                          onChange={(e) => setAdminFee(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Prize Pot:</span>
                          <span className="font-semibold">£{prizePot?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Admin Fee:</span>
                          <span className="font-semibold">-£{adminFee || "0.00"}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Winners:</span>
                          <span className="font-semibold">{selectedSplitWinners.length}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Split per winner:</span>
                          <span className="font-bold text-green-600">
                            £{
                              selectedSplitWinners.length > 0 && prizePot
                                ? ((prizePot - (parseFloat(adminFee) || 0)) / selectedSplitWinners.length).toFixed(2)
                                : "0.00"
                            }
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={handleEndGameAsSplit}
                        disabled={endGameAsSplitMutation.isPending || game.status === "finished" || selectedSplitWinners.length === 0}
                        className="w-full"
                        variant="destructive"
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        {endGameAsSplitMutation.isPending ? "Ending Game..." : `End Game - Split to ${selectedSplitWinners.length} Winner${selectedSplitWinners.length !== 1 ? 's' : ''}`}
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
                    <div className="flex items-center gap-4 mb-2">
                      <Label>Current Gameweek: {game.current_gameweek}</Label>
                      {gameGameweek && (
                        <Badge variant={
                          gameGameweek.status === 'open' ? 'secondary' : 
                          gameGameweek.status === 'active' ? 'default' : 
                          'outline'
                        }>
                          {gameGameweek.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={processPickResults}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Process Results
                      </Button>
                      {gameGameweek?.status === 'upcoming' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openGameweekMutation.mutate()}
                          disabled={openGameweekMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Unlock className="h-4 w-4" />
                          {openGameweekMutation.isPending ? "Opening..." : "Open for Picks"}
                        </Button>
                      )}
                      {gameGameweek?.status === 'open' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => activateGameweekMutation.mutate()}
                          disabled={activateGameweekMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Lock className="h-4 w-4" />
                          {activateGameweekMutation.isPending ? "Activating..." : "Activate Gameweek"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => progressGameweekMutation.mutate()}
                        disabled={progressGameweekMutation.isPending}
                      >
                        {progressGameweekMutation.isPending ? "Progressing..." : "Progress to Next GW"}
                      </Button>
                    </div>
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
            {/* Cup Fixtures Upload - only for Cup mode */}
            {game.game_mode === 'cup' && (
              <CupFixtureUpload gameId={gameId!} />
            )}

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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemovePlayer(
                            player.id, 
                            (player as any).profiles?.display_name || "Unknown",
                            player.user_id
                          )}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <RemovePlayerDialog
          isOpen={removePlayerDialog.isOpen}
          onOpenChange={(open) => setRemovePlayerDialog(prev => ({ ...prev, isOpen: open }))}
          onConfirm={confirmRemovePlayer}
          playerName={removePlayerDialog.playerName}
          isLoading={removePlayerMutation.isPending}
        />
      </div>
    </div>
  );
};

export default GameAdmin;
