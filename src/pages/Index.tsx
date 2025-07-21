import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Target, Calendar, Shield, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const { user, loading } = useAuth();

  // Fetch active games for stats
  const { data: gameStats } = useQuery({
    queryKey: ['game-stats'],
    queryFn: async () => {
      const { data: games } = await supabase
        .from('games')
        .select(`
          *,
          game_players!inner(*)
        `)
        .eq('status', 'active');

      if (!games || games.length === 0) return null;

      // Calculate stats from the first active game
      const game = games[0];
      const totalPlayers = game.game_players.length;
      const remainingPlayers = game.game_players.filter((p: any) => !p.is_eliminated).length;
      const eliminatedPlayers = totalPlayers - remainingPlayers;

      return {
        currentGameweek: game.current_gameweek,
        remainingPlayers,
        eliminatedPlayers,
        gameId: game.id
      };
    },
    enabled: !!user
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Hero Section */}
      <section className="relative bg-primary text-primary-foreground py-20 px-6">
        <div className="container mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Trophy className="h-16 w-16 text-accent" />
          </div>
          <h1 className="text-5xl font-bold mb-6">Last Man Standing</h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            The ultimate Premier League survival game. Pick a team each week - if they win, you advance. If they lose, you're out!
          </p>
          <div className="flex gap-4 justify-center">
            {user ? (
              <>
                <Link to="/games/create">
                  <Button size="lg" variant="secondary" className="flex items-center gap-2">
                    <Plus size={20} />
                    Create New Game
                  </Button>
                </Link>
                <Link to="/games">
                  <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                    View My Games
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/auth">
                <Button size="lg" variant="secondary">
                  Sign In to Play
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <Users className="h-12 w-12 text-primary" />
                </div>
                <CardTitle>Join the Game</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Sign up and join a Last Man Standing competition with up to 20 participants.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <Target className="h-12 w-12 text-primary" />
                </div>
                <CardTitle>Pick Your Team</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Each gameweek, select one Premier League team to win their fixture. Choose wisely - you can only pick each team once!
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <Trophy className="h-12 w-12 text-primary" />
                </div>
                <CardTitle>Survive & Win</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  If your team wins, you advance to the next round. Lose and you're eliminated. Last player standing wins!
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Current Game Status */}
      <section className="bg-muted py-16 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Current Game</h2>
            {gameStats ? (
              <p className="text-muted-foreground">
                Gameweek {gameStats.currentGameweek} • {gameStats.remainingPlayers} Players Remaining
              </p>
            ) : user ? (
              <p className="text-muted-foreground">No active games</p>
            ) : (
              <p className="text-muted-foreground">Sign in to see current games</p>
            )}
          </div>
          
          {gameStats ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{gameStats.remainingPlayers}</CardTitle>
                  <CardDescription>Players Remaining</CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{gameStats.eliminatedPlayers}</CardTitle>
                  <CardDescription>Players Eliminated</CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{gameStats.currentGameweek}</CardTitle>
                  <CardDescription>Current Gameweek</CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-2">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-sm">
                    <Link to={`/games/${gameStats.gameId}`} className="hover:underline">
                      View Game
                    </Link>
                  </CardTitle>
                  <CardDescription>Game Details</CardDescription>
                </CardHeader>
              </Card>
            </div>
          ) : user ? (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No active games found</p>
              <Link to="/games/create">
                <Button>Create a Game</Button>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* Rules */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Game Rules</h2>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Selection</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Pick one Premier League team each gameweek</li>
                  <li>• Your team must WIN their fixture for you to advance</li>
                  <li>• Draws count as elimination</li>
                  <li>• You can only pick each team ONCE during the entire competition</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Elimination</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• If your team loses or draws, you're eliminated</li>
                  <li>• Postponed matches will be rescheduled</li>
                  <li>• Failed to pick counts as elimination</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Winning</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Last player standing wins the competition</li>
                  <li>• If all remaining players are eliminated in the same gameweek, it's a tiebreak</li>
                  <li>• Tiebreak goes to the player who lasted longest without using "Big 6" teams</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
