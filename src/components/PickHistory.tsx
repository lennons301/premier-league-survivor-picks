import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

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
  const [sortBy, setSortBy] = useState<'player' | 'fixture' | 'pick' | 'result' | 'goals' | 'gameweek'>('gameweek');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedGameweeks, setExpandedGameweeks] = useState<Set<number>>(new Set());

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

  // Flatten all picks for comprehensive view
  const allPicksFlattened = useMemo(() => {
    return allPicks.map(pick => ({
      ...pick,
      goals: pick.result === 'win' && pick.fixtures?.is_completed 
        ? (pick.picked_side === 'home' ? pick.fixtures.home_score : pick.fixtures.away_score) || 0
        : 0
    }));
  }, [allPicks]);

  // Sort all picks based on current sort criteria
  const sortedAllPicks = useMemo(() => {
    const sorted = [...allPicksFlattened].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'player':
          compareValue = (a.profiles?.display_name || '').localeCompare(b.profiles?.display_name || '');
          break;
        case 'fixture':
          const aFixture = `${a.fixtures?.home_team?.short_name} vs ${a.fixtures?.away_team?.short_name}`;
          const bFixture = `${b.fixtures?.home_team?.short_name} vs ${b.fixtures?.away_team?.short_name}`;
          compareValue = aFixture.localeCompare(bFixture);
          break;
        case 'pick':
          const aPick = a.picked_side === 'home' ? a.fixtures?.home_team?.short_name : a.fixtures?.away_team?.short_name;
          const bPick = b.picked_side === 'home' ? b.fixtures?.home_team?.short_name : b.fixtures?.away_team?.short_name;
          compareValue = (aPick || '').localeCompare(bPick || '');
          break;
        case 'result':
          const resultOrder = { 'win': 3, 'draw': 2, 'loss': 1, null: 0 };
          compareValue = (resultOrder[a.result as keyof typeof resultOrder] || 0) - (resultOrder[b.result as keyof typeof resultOrder] || 0);
          break;
        case 'goals':
          compareValue = a.goals - b.goals;
          break;
        case 'gameweek':
          compareValue = a.gameweek - b.gameweek;
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    return sorted;
  }, [allPicksFlattened, sortBy, sortOrder]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'goals' || column === 'gameweek' ? 'desc' : 'asc');
    }
  };

  const toggleGameweekExpansion = (gameweek: number) => {
    const newExpanded = new Set(expandedGameweeks);
    if (newExpanded.has(gameweek)) {
      newExpanded.delete(gameweek);
    } else {
      newExpanded.add(gameweek);
    }
    setExpandedGameweeks(newExpanded);
  };

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
    <div className="space-y-6">
      {/* Comprehensive All Picks View */}
      <Card>
        <CardHeader>
          <CardTitle>All Picks Overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete pick history with sortable columns - see what teams each player has already used
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('gameweek')}
                >
                  <div className="flex items-center gap-2">
                    Gameweek
                    {sortBy === 'gameweek' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('player')}
                >
                  <div className="flex items-center gap-2">
                    Player
                    {sortBy === 'player' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('fixture')}
                >
                  <div className="flex items-center gap-2">
                    Fixture
                    {sortBy === 'fixture' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('pick')}
                >
                  <div className="flex items-center gap-2">
                    Pick
                    {sortBy === 'pick' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('result')}
                >
                  <div className="flex items-center gap-2">
                    Result
                    {sortBy === 'result' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('goals')}
                >
                  <div className="flex items-center gap-2">
                    Goals
                    {sortBy === 'goals' && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAllPicks.map((pick) => {
                const gameGameweek = gameGameweeks?.find(gg => gg.gameweek_number === pick.gameweek);
                const shouldShowPickDetails = gameGameweek?.status === 'active' || gameGameweek?.status === 'finished';
                
                return (
                  <TableRow key={pick.id}>
                    <TableCell>
                      <Badge variant="outline">GW{pick.gameweek}</Badge>
                    </TableCell>
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
                            {pick.goals}
                          </span>
                          <Target className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gameweek by Gameweek View */}
      <Card>
        <CardHeader>
          <CardTitle>Pick History by Gameweek</CardTitle>
          <p className="text-sm text-muted-foreground">
            Historical picks organized by gameweek - click to expand/collapse
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {gameweeks.map((gameweek) => {
            const gameweekPicks = picksByGameweek[gameweek];
            const isCurrentGameweek = gameweek === currentGameweek;
            const gameGameweek = gameGameweeks?.find(gg => gg.gameweek_number === gameweek);
            const shouldShowPickDetails = gameGameweek?.status === 'active' || gameGameweek?.status === 'finished';
            const isExpanded = expandedGameweeks.has(gameweek);
            
            return (
              <div key={gameweek} className="space-y-3">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                  onClick={() => toggleGameweekExpansion(gameweek)}
                >
                  <h3 className="text-lg font-semibold">Gameweek {gameweek}</h3>
                  {isCurrentGameweek && (
                    <Badge variant="default">Current</Badge>
                  )}
                  <Badge variant="outline">{gameweekPicks.length} picks</Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                
                {isExpanded && (
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
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}