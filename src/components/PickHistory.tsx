import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp, ArrowUpDown, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface GamePlayer {
  user_id: string;
  is_eliminated: boolean;
  eliminated_gameweek?: number;
  profiles: { display_name: string } | null;
}

interface GameGameweek {
  gameweek_number: number;
  status: string;
  picks_visible: boolean;
}

interface Game {
  starting_gameweek?: number;
}

interface PickHistoryProps {
  allPicks: Pick[];
  players: Player[];
  currentGameweek: number;
  gameGameweeks?: GameGameweek[];
  gamePlayers: GamePlayer[];
  game: Game;
  gameGameweek?: GameGameweek;
}

export default function PickHistory({ allPicks, players, currentGameweek, gameGameweeks, gamePlayers, game, gameGameweek }: PickHistoryProps) {
  const [sortBy, setSortBy] = useState<'player' | 'fixture' | 'pick' | 'result' | 'goals' | 'gameweek'>('gameweek');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedGameweeks, setExpandedGameweeks] = useState<Set<number>>(new Set());
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [pivotSortBy, setPivotSortBy] = useState<'name' | 'total' | number>('total');
  const [pivotSortOrder, setPivotSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'eliminated'>('all');

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
    return allPicks.map(pick => {
      const goals = pick.fixtures?.is_completed && pick.fixtures.home_score !== null && pick.fixtures.away_score !== null
        ? (() => {
            // Check if this pick resulted in elimination (lose after starting gameweek)
            const isEliminating = pick.result === 'lose' && pick.gameweek > 1; // Assuming starting gameweek is 1
            if (isEliminating) return 0;
            
            return ((pick.picked_side === 'home' ? pick.fixtures.home_score : pick.fixtures.away_score) || 0) * (pick.multiplier || 1);
          })()
        : 0;
      
      return {
        ...pick,
        goals
      };
    });
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
    if (!gameGameweeks || !allPicks || !gamePlayers) return [];
    
    // Only show gameweeks up to current active week
    const gameweekNumbers = gameGameweeks
      .filter(gg => gg.gameweek_number <= currentGameweek)
      .map(gg => gg.gameweek_number)
      .sort((a, b) => a - b);
    
    const uniqueUsers = [...new Set(allPicks.map(pick => pick.user_id))];
    
    return uniqueUsers.map(userId => {
      const userProfile = players.find(p => p.user_id === userId);
      const gamePlayer = gamePlayers.find(p => p.user_id === userId);
      const userPicks = allPicks.filter(pick => pick.user_id === userId);
      
      const gameweekData: Record<number, any> = {};
      gameweekNumbers.forEach(gw => {
        const pick = userPicks.find(p => p.gameweek === gw);
        if (pick) {
          const opponentTeam = pick.picked_side === 'home' 
            ? pick.fixtures?.away_team?.short_name 
            : pick.fixtures?.home_team?.short_name;
          gameweekData[gw] = {
            ...pick,
            opponent: opponentTeam
          };
        }
      });
      
      return {
        userId,
        displayName: userProfile?.profiles?.display_name || userProfile?.display_name || 'Unknown',
        isEliminated: gamePlayer?.is_eliminated || false,
        eliminatedGameweek: gamePlayer?.eliminated_gameweek,
        gameweekData,
        totalGoals: userPicks.reduce((sum, pick) => {
          if (pick.fixtures?.is_completed && pick.fixtures.home_score !== null && pick.fixtures.away_score !== null) {
            // Skip counting goals for eliminating losses
            if (pick.result === 'lose' && pick.gameweek > (game?.starting_gameweek || 1)) {
              return sum;
            }
            const goals = pick.picked_side === 'home' 
              ? pick.fixtures.home_score || 0
              : pick.fixtures.away_score || 0;
            return sum + (goals * (pick.multiplier || 1));
          }
          return sum;
        }, 0)
      };
    });
  }, [gameGameweeks, allPicks, gamePlayers, players, currentGameweek, game?.starting_gameweek]);

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

  const handlePivotSort = (column: 'name' | 'total' | number) => {
    if (pivotSortBy === column) {
      setPivotSortOrder(pivotSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPivotSortBy(column);
      setPivotSortOrder(column === 'name' ? 'asc' : 'desc');
    }
  };

  // Filter and sort pivot data
  const filteredAndSortedPivotData = useMemo(() => {
    let filtered = pivotData;
    
    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(user => !user.isEliminated);
    } else if (statusFilter === 'eliminated') {
      filtered = filtered.filter(user => user.isEliminated);
    }
    
    // Sort the filtered data
    return [...filtered].sort((a, b) => {
      let compareValue = 0;
      
      if (pivotSortBy === 'name') {
        compareValue = a.displayName.localeCompare(b.displayName);
      } else if (pivotSortBy === 'total') {
        compareValue = a.totalGoals - b.totalGoals;
      } else if (typeof pivotSortBy === 'number') {
        // Sort by specific gameweek team name
        const aPick = a.gameweekData[pivotSortBy];
        const bPick = b.gameweekData[pivotSortBy];
        const aTeam = aPick 
          ? (aPick.picked_side === 'home' ? aPick.fixtures?.home_team?.short_name : aPick.fixtures?.away_team?.short_name) || ''
          : '';
        const bTeam = bPick 
          ? (bPick.picked_side === 'home' ? bPick.fixtures?.home_team?.short_name : bPick.fixtures?.away_team?.short_name) || ''
          : '';
        compareValue = aTeam.localeCompare(bTeam);
      }
      
      return pivotSortOrder === 'asc' ? compareValue : -compareValue;
    });
  }, [pivotData, pivotSortBy, pivotSortOrder, statusFilter]);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Pick History
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete pick history and player standings
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pivot" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pivot">Player Progress & Standings</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="pivot" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Player Progress & Standings</h3>
                  <p className="text-sm text-muted-foreground">
                    Cumulative goals are used as tiebreakers when all players are eliminated
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'eliminated') => setStatusFilter(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Players</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="eliminated">Eliminated Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click headers to sort
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="sticky left-0 bg-background cursor-pointer hover:bg-muted/50 z-10"
                        onClick={() => handlePivotSort('name')}
                      >
                        <div className="flex items-center gap-2">
                          Player
                          {pivotSortBy === 'name' && (
                            pivotSortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="sticky left-20 bg-background z-10">
                        Status
                      </TableHead>
                      <TableHead 
                        className="sticky left-32 bg-background cursor-pointer hover:bg-muted/50 z-10 text-right"
                        onClick={() => handlePivotSort('total')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Total Goals
                          {pivotSortBy === 'total' && (
                            pivotSortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      {gameGameweeks?.filter(gg => gg.gameweek_number <= currentGameweek).map(gw => (
                        <TableHead 
                          key={gw.gameweek_number} 
                          className="text-center min-w-20 cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePivotSort(gw.gameweek_number)}
                        >
                          <div className="flex items-center justify-center gap-2">
                            GW{gw.gameweek_number}
                            {pivotSortBy === gw.gameweek_number && (
                              pivotSortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedPivotData.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="sticky left-0 bg-background font-medium z-10">
                          {user.displayName}
                        </TableCell>
                        <TableCell className="sticky left-20 bg-background z-10">
                          <Badge
                            variant={user.isEliminated ? "destructive" : "secondary"}
                            className={user.isEliminated ? "" : "bg-green-100 text-green-800"}
                          >
                            {user.isEliminated 
                              ? `Eliminated (GW${user.eliminatedGameweek})`
                              : "Active"
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="sticky left-32 bg-background text-right z-10">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-lg font-bold text-primary">
                              {user.totalGoals}
                            </span>
                            <Target className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                        {gameGameweeks?.filter(gg => gg.gameweek_number <= currentGameweek).map(gw => {
                          const pick = user.gameweekData[gw.gameweek_number];
                          const isCurrentGameweek = gw.gameweek_number === currentGameweek;
                          const shouldShowPick = !isCurrentGameweek || gameGameweek?.picks_visible;
                          
                          return (
                            <TableCell key={gw.gameweek_number} className="text-center min-w-20">
                              {pick && shouldShowPick ? (
                                <div
                                  className={`
                                    w-16 h-12 rounded flex flex-col items-center justify-center text-xs font-bold mx-auto p-1
                                    ${pick.result === 'win' ? 'bg-green-500 text-white' :
                                      pick.result === 'lose' ? 'bg-red-500 text-white' :
                                      'bg-yellow-500 text-white'
                                    }
                                  `}
                                  title={`${pick.picked_side === 'home' ? pick.fixtures?.home_team?.short_name : pick.fixtures?.away_team?.short_name} vs ${pick.opponent} - ${pick.result}`}
                                >
                                  <div className="font-semibold leading-tight">
                                    {pick.picked_side === 'home' ? pick.fixtures?.home_team?.short_name : pick.fixtures?.away_team?.short_name}
                                  </div>
                                  <div className="text-[10px] opacity-75 leading-tight">vs {pick.opponent}</div>
                                  <div className="font-bold leading-tight">
                                    {pick.fixtures?.is_completed 
                                      ? (pick.picked_side === 'home' ? pick.fixtures.home_score : pick.fixtures.away_score) 
                                      : '-'
                                    }
                                  </div>
                                </div>
                              ) : pick && !shouldShowPick ? (
                                <div className="w-16 h-12 rounded bg-gray-200 flex items-center justify-center text-xs font-bold mx-auto">
                                  Hidden
                                </div>
                              ) : (
                                <div className="w-16 h-12 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-xs mx-auto">
                                  -
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="overview" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Complete Pick History</h3>
                  <p className="text-sm text-muted-foreground">
                    Detailed view of all picks across all gameweeks
                  </p>
                </div>
                <div className="flex items-center gap-4">
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
                  <p className="text-sm text-muted-foreground">
                    {sortedAllPicks.length} picks
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {gameweeks.map(gameweek => {
                  const gameweekPicks = sortedAllPicks.filter(pick => pick.gameweek === gameweek);
                  if (gameweekPicks.length === 0) return null;

                  const isExpanded = expandedGameweeks.has(gameweek);

                  return (
                    <Card key={gameweek} className="border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-lg">Gameweek {gameweek}</CardTitle>
                            <Badge variant="outline">
                              {gameweekPicks.length} picks
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleGameweekExpansion(gameweek)}
                            className="flex items-center gap-2"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Collapse
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Expand
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      {isExpanded && (
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
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
                                    className="cursor-pointer hover:bg-muted/50 text-right"
                                    onClick={() => handleSort('goals')}
                                  >
                                    <div className="flex items-center justify-end gap-2">
                                      Goals
                                      {sortBy === 'goals' && (
                                        sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                      )}
                                    </div>
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {gameweekPicks.map((pick) => (
                                  <TableRow key={pick.id}>
                                    <TableCell className="font-medium">
                                      {pick.profiles?.display_name || 'Unknown'}
                                    </TableCell>
                                    <TableCell>
                                      {pick.fixtures ? (
                                        <span className="text-sm">
                                          {pick.fixtures.home_team.short_name} vs {pick.fixtures.away_team.short_name}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">No fixture data</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant={pick.picked_side === 'home' ? 'default' : 'secondary'}
                                          className="text-xs"
                                        >
                                          {pick.picked_side === 'home' 
                                            ? pick.fixtures?.home_team.short_name 
                                            : pick.fixtures?.away_team.short_name
                                          }
                                        </Badge>
                                        {pick.multiplier && pick.multiplier > 1 && (
                                          <Badge variant="outline" className="text-xs">
                                            {pick.multiplier}x
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={
                                          pick.result === 'win' ? 'default' :
                                          pick.result === 'lose' ? 'destructive' :
                                          pick.result === 'draw' ? 'secondary' : 'outline'
                                        }
                                        className="capitalize"
                                      >
                                        {pick.result || 'Pending'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="font-semibold">
                                          {pick.goals}
                                        </span>
                                        <Target className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}