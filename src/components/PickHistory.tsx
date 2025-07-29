import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Pick {
  id: string;
  gameweek: number;
  user_id: string;
  picked_side: string;
  result: string | null;
  multiplier?: number;
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
  display_name?: string;
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
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'pivot'>('overview');

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

  // Flatten all picks for comprehensive view with goals calculation
  const allPicksFlattened = useMemo(() => {
    return allPicks.map(pick => ({
      ...pick,
      goals: pick.result === 'win' && pick.fixtures?.is_completed 
        ? ((pick.picked_side === 'home' ? pick.fixtures.home_score : pick.fixtures.away_score) || 0) * (pick.multiplier || 1)
        : 0
    }));
  }, [allPicks]);

  // Filter and sort all picks based on current criteria
  const sortedAllPicks = useMemo(() => {
    const filtered = selectedPlayer === 'all' 
      ? allPicksFlattened 
      : allPicksFlattened.filter(pick => pick.user_id === selectedPlayer);
    
    const sorted = [...filtered].sort((a, b) => {
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
  }, [allPicksFlattened, sortBy, sortOrder, selectedPlayer]);

  // Create pivot table data - gameweeks as columns, users as rows
  const pivotData = useMemo(() => {
    if (!gameGameweeks || !allPicks || !players) return [];
    
    // Only show gameweeks up to current active week
    const gameweekNumbers = gameGameweeks
      .filter(gg => gg.gameweek_number <= currentGameweek)
      .map(gg => gg.gameweek_number)
      .sort((a, b) => a - b);
    
    const uniqueUsers = [...new Set(allPicks.map(pick => pick.user_id))];
    
    return uniqueUsers.map(userId => {
      const userProfile = players.find(p => p.user_id === userId);
      const userPicks = allPicks.filter(pick => pick.user_id === userId);
      
      const gameweekData: Record<number, any> = {};
      gameweekNumbers.forEach(gw => {
        const pick = userPicks.find(p => p.gameweek === gw);
        gameweekData[gw] = pick;
      });
      
      return {
        userId,
        displayName: userProfile?.profiles?.display_name || userProfile?.display_name || 'Unknown',
        gameweekData,
        totalGoals: userPicks.reduce((sum, pick) => {
          if (pick.result === 'win' && pick.fixtures?.is_completed) {
            const goals = pick.picked_side === 'home' 
              ? pick.fixtures.home_score || 0
              : pick.fixtures.away_score || 0;
            return sum + (goals * (pick.multiplier || 1));
          }
          return sum;
        }, 0)
      };
    });
  }, [gameGameweeks, allPicks, players]);

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
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Picks History
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'overview' 
                  ? 'Complete pick history with sortable columns - see what teams each player has already used'
                  : 'Pivot view showing all picks by gameweek with results colored by outcome'
                }
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'overview' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('overview')}
              >
                Overview
              </Button>
              <Button
                variant={viewMode === 'pivot' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('pivot')}
              >
                Pivot Table
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'overview' ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by player" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Players</SelectItem>
                     {players.map(player => (
                       <SelectItem key={player.user_id} value={player.user_id}>
                         {player.profiles?.display_name || player.display_name}
                       </SelectItem>
                     ))}
                  </SelectContent>
                </Select>
                {selectedPlayer !== 'all' && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedPlayer('all')}>
                    Clear Filter
                  </Button>
                )}
              </div>
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
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Pivot view showing all picks by gameweek. Results are color-coded: green (win), yellow (draw), red (loss), gray (pending).
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background min-w-32">Player</TableHead>
                      <TableHead className="sticky left-32 bg-background min-w-24 cursor-pointer hover:bg-muted/50">Total Goals</TableHead>
                      {gameGameweeks?.filter(gg => gg.gameweek_number <= currentGameweek).sort((a, b) => a.gameweek_number - b.gameweek_number).map(gg => (
                        <TableHead key={gg.gameweek_number} className="text-center min-w-32">
                          GW {gg.gameweek_number}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pivotData.sort((a, b) => b.totalGoals - a.totalGoals).map(userData => (
                      <TableRow key={userData.userId}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          {userData.displayName}
                        </TableCell>
                        <TableCell className="sticky left-32 bg-background font-semibold text-green-600">
                          {userData.totalGoals}
                        </TableCell>
                        {gameGameweeks?.filter(gg => gg.gameweek_number <= currentGameweek).sort((a, b) => a.gameweek_number - b.gameweek_number).map(gg => {
                          const pick = userData.gameweekData[gg.gameweek_number];
                          const gameGameweek = gameGameweeks.find(g => g.gameweek_number === gg.gameweek_number);
                          const shouldShowPickDetails = gameGameweek?.status === 'active' || gameGameweek?.status === 'finished';
                          
                          return (
                            <TableCell key={gg.gameweek_number} className="text-center">
                              {pick ? (
                                <div className={`p-2 rounded text-xs ${
                                  !shouldShowPickDetails ? 'bg-gray-100 text-gray-600' :
                                  pick.result === 'win' ? 'bg-green-100 text-green-800' :
                                  pick.result === 'loss' ? 'bg-red-100 text-red-800' :
                                  pick.result === 'draw' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  <div className="font-medium">
                                    {shouldShowPickDetails ? (
                                      pick.picked_side === 'home' 
                                        ? pick.fixtures?.home_team?.short_name 
                                        : pick.fixtures?.away_team?.short_name
                                    ) : (
                                      'Hidden'
                                    )}
                                  </div>
                                  {shouldShowPickDetails && pick.result === 'win' && pick.fixtures?.is_completed && (
                                    <div className="font-bold">
                                      {(pick.picked_side === 'home' ? pick.fixtures.home_score : pick.fixtures.away_score) * (pick.multiplier || 1)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
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
                                   {((pick.picked_side === 'home' 
                                     ? pick.fixtures.home_score 
                                     : pick.fixtures.away_score) || 0) * (pick.multiplier || 1)}
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