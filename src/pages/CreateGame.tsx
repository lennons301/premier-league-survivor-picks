import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Navbar from "@/components/Navbar";
import { Trophy, Settings, Zap, TrendingUp, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(1, "Game name is required"),
  max_players: z.number().min(2, "At least 2 players required").optional(),
  starting_gameweek: z.number().min(1, "Starting gameweek must be at least 1").max(38, "Starting gameweek cannot exceed 38"),
  deadline: z.string().min(1, "Pick deadline is required"),
  game_mode: z.enum(["classic", "escalating", "turbo"]),
  allow_rebuys: z.boolean(),
});

const CreateGame = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch next available gameweek (one after current, with deadline in the future)
  const { data: nextGameweek } = useQuery({
    queryKey: ["next-gameweek-for-new-game"],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      // Get the first gameweek with a deadline in the future, ordered by gameweek number
      const { data: futureGameweeks, error } = await supabase
        .from("gameweeks")
        .select("*")
        .gt("deadline", now)
        .order("gameweek_number", { ascending: true })
        .limit(2);
      
      if (error || !futureGameweeks || futureGameweeks.length === 0) {
        // Fallback: get current gameweek + 1
        const { data: currentData } = await supabase
          .from("gameweeks")
          .select("*")
          .eq("is_current", true)
          .maybeSingle();
        
        if (currentData) {
          return {
            gameweek_number: currentData.gameweek_number + 1,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          };
        }
        
        return {
          gameweek_number: 1,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
      }
      
      // If the first future gameweek is the current one (is_current = true), use the next one
      // This ensures we default to the gameweek AFTER the current active one
      if (futureGameweeks[0].is_current && futureGameweeks.length > 1) {
        return futureGameweeks[1];
      }
      
      return futureGameweeks[0];
    },
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      max_players: undefined,
      starting_gameweek: nextGameweek?.gameweek_number || 1,
      deadline: nextGameweek?.deadline?.slice(0, 16) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      game_mode: "classic",
      allow_rebuys: true,
    },
  });

  const selectedGameMode = form.watch("game_mode");

  // Update form values when nextGameweek data loads
  useEffect(() => {
    if (nextGameweek) {
      form.setValue("starting_gameweek", nextGameweek.gameweek_number);
      form.setValue("deadline", nextGameweek.deadline?.slice(0, 16) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    }
  }, [nextGameweek, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    try {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .insert({
          name: values.name,
          max_players: values.max_players,
          starting_gameweek: values.starting_gameweek,
          current_gameweek: values.starting_gameweek,
          created_by: user.id,
          status: 'active',
          game_mode: values.game_mode,
          allow_rebuys: values.game_mode === "turbo" ? false : values.allow_rebuys,
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // Create deadline for the starting gameweek
      const { error: deadlineError } = await supabase
        .from("gameweek_deadlines")
        .insert({
          game_id: gameData.id,
          gameweek: values.starting_gameweek,
          deadline: new Date(values.deadline).toISOString(),
        });

      if (deadlineError) throw deadlineError;

      // Auto-join the creator to the game
      const { error: joinError } = await supabase
        .from("game_players")
        .insert({
          game_id: gameData.id,
          user_id: user.id
        });

      if (joinError) throw joinError;

      toast({
        title: "Success",
        description: "Game created successfully!",
      });

      navigate(`/games/${gameData.id}`);
    } catch (error) {
      console.error("Error creating game:", error);
      toast({
        title: "Error",
        description: "Failed to create game. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-6 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Create New Game
          </h1>
          <p className="text-muted-foreground">Set up a new Last Person Standing (LPS) competition</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Game Settings
            </CardTitle>
            <CardDescription>
              Configure your Last Person Standing (LPS) game. You can modify these settings later as the admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Game Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Premier League LPS 2024/25" {...field} />
                      </FormControl>
                      <FormDescription>
                        Choose a descriptive name for your competition
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="max_players"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Players (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Leave empty for unlimited"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === "" ? undefined : parseInt(value));
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Set a limit on how many players can join this game
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="starting_gameweek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting Gameweek</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="38"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Which gameweek should this game start from?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pick Deadline for Starting Gameweek</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        When should picks be due for the starting gameweek?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Game Mode Selection */}
                <FormField
                  control={form.control}
                  name="game_mode"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Game Mode</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid gap-3"
                        >
                          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="classic" id="classic" className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor="classic" className="flex items-center gap-2 cursor-pointer">
                                <Shield className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">Classic</span>
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Pick one team per gameweek. Last player standing wins.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="escalating" id="escalating" className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor="escalating" className="flex items-center gap-2 cursor-pointer">
                                <TrendingUp className="h-4 w-4 text-amber-500" />
                                <span className="font-medium">Escalating</span>
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                1 pick in GW1, 2 picks in GW2, etc. Any wrong pick eliminates. Tiebreaker: most correct picks, then goals scored.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="turbo" id="turbo" className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor="turbo" className="flex items-center gap-2 cursor-pointer">
                                <Zap className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium">Turbo</span>
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Single gameweek showdown. Rank all fixtures by confidence. Most consecutive correct predictions wins. No rebuys.
                              </p>
                            </div>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Allow Rebuys Toggle (only for classic and escalating) */}
                {selectedGameMode !== "turbo" && (
                  <FormField
                    control={form.control}
                    name="allow_rebuys"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Allow Rebuys</FormLabel>
                          <FormDescription>
                            Players can re-enter after elimination in the first gameweek
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Admin Features</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Manage gameweek deadlines and progress</li>
                    <li>• Create fixtures and enter match results</li>
                    <li>• Make picks on behalf of players</li>
                    <li>• Control game status and settings</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/games")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                    {form.formState.isSubmitting ? "Creating..." : "Create Game"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateGame;
