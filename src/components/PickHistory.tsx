import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

interface Pick {
  id: string;
  gameweek: number;
  user_id: string;
  picked_side: string;
  result: string | null;
  fixtures: {
    home_team: { name: string; short_name: string };
    away_team: { name: string; short_name: string };
    home_score: number | null;
    away_score: number | null;
    is_completed: boolean;
  } | null;
  profiles: { display_name: string } | null;
}

interface Player {
  user_id: string;
  profiles: { display_name: string } | null;
}

interface GameGameweek {
  gameweek_number: number;
  status: string;
  picks_visible: boolean;
}

interface PickHistoryProps {
  allPicks: Pick[];
  players: Player[];
  currentGameweek: number;
  gameGameweeks?: GameGameweek[];
}

export default function PickHistory({ allPicks, players, currentGameweek, gameGameweeks }: PickHistoryProps) {
  // Group picks by gameweek
  const picksByGameweek = allPicks.reduce((acc, pick) => {
    if (!acc[pick.gameweek]) acc[pick.gameweek] = [];
    acc[pick.gameweek].push(pick);
    return acc;
  }, {} as Record<number, Pick[]>);

  // Get all gameweeks and sort them in descending order
  const gameweeks = Object.keys(picksByGameweek)
    .map(Number)
    .sort((a, b) => b - a);

  if (gameweeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pick History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No picks have been made yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick History by Gameweek</CardTitle>
        <p className="text-sm text-muted-foreground">
          Historical picks for all completed and active gameweeks
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {gameweeks.map((gameweek) => {
          const gameweekPicks = picksByGameweek[gameweek];
          const isCurrentGameweek = gameweek === currentGameweek;
          const gameGameweek = gameGameweeks?.find(gg => gg.gameweek_number === gameweek);
          const shouldShowPickDetails = (gameGameweek?.status === 'active' || gameGameweek?.status === 'finished') && gameGameweek?.status !== 'open';
          
          return (
            <div key={gameweek} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Gameweek {gameweek}</h3>
                {isCurrentGameweek && (
                  <Badge variant="default">Current</Badge>
                )}
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Fixture</TableHead>
                    <TableHead>Pick</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Goals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gameweekPicks.map((pick) => (
                    <TableRow key={pick.id}>
                      <TableCell className="font-medium">
                        {pick.profiles?.display_name}
                      </TableCell>
                      <TableCell>
                        {pick.fixtures ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              {pick.fixtures.home_team.short_name} vs {pick.fixtures.away_team.short_name}
                            </div>
                            {pick.fixtures.is_completed && (
                              <div className="text-xs text-muted-foreground">
                                {pick.fixtures.home_score} - {pick.fixtures.away_score}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No fixture data</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {shouldShowPickDetails ? (
                          <div className="text-sm">
                            <span className="font-medium">
                              {pick.picked_side === 'home' 
                                ? pick.fixtures?.home_team.short_name 
                                : pick.fixtures?.away_team.short_name}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              ({pick.picked_side})
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Pick hidden</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {shouldShowPickDetails ? (
                          pick.result ? (
                            <Badge 
                              variant={
                                pick.result === 'win' ? 'default' : 
                                pick.result === 'draw' ? 'secondary' : 
                                'destructive'
                              }
                              className={
                                pick.result === 'win' ? 'bg-green-100 text-green-800' : ''
                              }
                            >
                              {pick.result === 'win' ? 'Win' : 
                               pick.result === 'draw' ? 'Draw' : 
                               'Loss'}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )
                        ) : (
                          <Badge variant="outline">Hidden</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {shouldShowPickDetails && pick.result === 'win' && pick.fixtures?.is_completed ? (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-primary">
                              {pick.picked_side === 'home' 
                                ? pick.fixtures.home_score 
                                : pick.fixtures.away_score}
                            </span>
                            <Target className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}