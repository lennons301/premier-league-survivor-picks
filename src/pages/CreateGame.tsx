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
import { Trophy, Settings } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Game name is required"),
  max_players: z.number().min(2, "At least 2 players required").optional(),
  starting_gameweek: z.number().min(1, "Starting gameweek must be at least 1").max(38, "Starting gameweek cannot exceed 38"),
  deadline: z.string().min(1, "Pick deadline is required"),
});

const CreateGame = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      max_players: undefined,
      starting_gameweek: 1,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    },
  });

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
          <p className="text-muted-foreground">Set up a new Last Man Standing competition</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Game Settings
            </CardTitle>
            <CardDescription>
              Configure your Last Man Standing game. You can modify these settings later as the admin.
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
                        <Input placeholder="e.g., Premier League LMS 2024/25" {...field} />
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