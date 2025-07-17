import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Target, Calendar } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
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
            <Button size="lg" variant="secondary">
              Join Game
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              View Standings
            </Button>
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
            <p className="text-muted-foreground">Gameweek 15 • 8 Players Remaining</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">8</CardTitle>
                <CardDescription>Players Remaining</CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">12</CardTitle>
                <CardDescription>Players Eliminated</CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">15</CardTitle>
                <CardDescription>Current Gameweek</CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-sm">Dec 21</CardTitle>
                <CardDescription>Next Deadline</CardDescription>
              </CardHeader>
            </Card>
          </div>
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
