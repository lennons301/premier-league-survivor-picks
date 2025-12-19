import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ArrowUpDown, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerProgressTable from "@/components/PlayerProgressTable";
import TurboLeaderboard from "@/components/TurboLeaderboard";
import EscalatingLeaderboard from "@/components/EscalatingLeaderboard";

interface Pick {
  id: string;
  gameweek: number;
  user_id: string;
  picked_side: string;
  result: string | null;
  multiplier?: number;
  preference_order?: number | null;
  predicted_result?: string | null;
  goals_scored?: number | null;
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
  game_mode?: string;
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
    if (!gameGameweeks || !gamePlayers) return [];
    
    // Only show gameweeks up to current active week
    const gameweekNumbers = gameGameweeks
      .filter(gg => gg.gameweek_number <= currentGameweek)
      .map(gg => gg.gameweek_number)
      .sort((a, b) => a - b);
    
    // Include ALL game players, not just those who have made picks
    const uniqueUsers = gamePlayers.map(player => player.user_id);
    
    console.log('PickHistory Debug:', {
      gameGameweeks: gameGameweeks?.map(g => ({ gw: g.gameweek_number, status: g.status })),
      currentGameweek,
      gameweekNumbers,
      uniqueUsers,
      gamePlayers: gamePlayers.map(p => ({ userId: p.user_id, eliminated: p.is_eliminated }))
    });
    
    return uniqueUsers.map(userId => {
      const userProfile = players.find(p => p.user_id === userId);
      const gamePlayer = gamePlayers.find(p => p.user_id === userId);
      const userPicks = allPicks.filter(pick => pick.user_id === userId);
      
      const gameweekData: Record<number, any> = {};
      gameweekNumbers.forEach(gw => {
        const pick = userPicks.find(p => p.gameweek === gw);
        const gameweekInfo = gameGameweeks?.find(gg => gg.gameweek_number === gw);
        
        if (pick) {
          const opponentTeam = pick.picked_side === 'home' 
            ? pick.fixtures?.away_team?.short_name 
            : pick.fixtures?.home_team?.short_name;
          gameweekData[gw] = {
            ...pick,
            opponent: opponentTeam
          };
        } else if (gameweekInfo?.status === 'open' && !gamePlayer?.is_eliminated) {
          // Add a pending entry for open gameweeks where no pick has been made
          console.log('Adding pending entry for:', { userId, gw, status: gameweekInfo?.status, eliminated: gamePlayer?.is_eliminated });
          gameweekData[gw] = {
            isPending: true,
            gameweek: gw,
            user_id: userId
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


  // Check if there are any gameweeks to show (either with picks or pending picks)
  const hasAnyGameweeks = gameweeks.length > 0 || (gameGameweeks && gameGameweeks.length > 0 && gamePlayers && gamePlayers.length > 0);

  if (!hasAnyGameweeks) {
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

  // Determine which leaderboard to show based on game mode
  const gameMode = game?.game_mode || 'classic';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="pivot" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pivot">
                {gameMode === 'turbo' ? 'Turbo Leaderboard' : 
                 gameMode === 'escalating' ? 'Escalating Leaderboard' : 
                 'Player Progress'}
              </TabsTrigger>
              <TabsTrigger value="overview">GW History</TabsTrigger>
            </TabsList>

            <TabsContent value="pivot" className="space-y-4">
              {gameMode === 'turbo' ? (
                <TurboLeaderboard
                  allPicks={allPicks}
                  gamePlayers={gamePlayers}
                  currentGameweek={currentGameweek}
                />
              ) : gameMode === 'escalating' ? (
                <EscalatingLeaderboard
                  allPicks={allPicks}
                  gamePlayers={gamePlayers}
                  gameGameweeks={gameGameweeks || []}
                  startingGameweek={game?.starting_gameweek || 1}
                  currentGameweek={currentGameweek}
                />
              ) : (
                <PlayerProgressTable 
                  pivotData={pivotData}
                  gameGameweeks={gameGameweeks || []}
                  currentGameweek={currentGameweek}
                  gameGameweek={gameGameweek}
                  allPicks={allPicks}
                />
              )}
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
                  // Show all gameweeks (open, active, finished)
                  const gameweekInfo = gameGameweeks?.find(gg => gg.gameweek_number === gameweek);
                  
                  const gameweekPicks = sortedAllPicks.filter(pick => pick.gameweek === gameweek);
                  
                  // For open gameweeks, also show pending picks (players who haven't picked yet)
                  const pendingPicks = [];
                  if (gameweekInfo?.status === 'open') {
                    const playersWithPicks = new Set(gameweekPicks.map(p => p.user_id));
                    const activePlayers = gamePlayers.filter(gp => !gp.is_eliminated);
                    
                    activePlayers.forEach(player => {
                      if (!playersWithPicks.has(player.user_id)) {
                        const playerProfile = players.find(p => p.user_id === player.user_id);
                        pendingPicks.push({
                          id: `pending-${player.user_id}-${gameweek}`,
                          gameweek,
                          user_id: player.user_id,
                          picked_side: null,
                          result: null,
                          fixtures: null,
                          profiles: playerProfile?.profiles || { display_name: playerProfile?.display_name || 'Unknown' },
                          goals: 0,
                          isPending: true
                        });
                      }
                    });
                  }
                  
                  const allGameweekEntries = [...gameweekPicks, ...pendingPicks];
                  if (allGameweekEntries.length === 0) return null;

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
                            {gameweekInfo?.status === 'open' && pendingPicks.length > 0 && (
                              <Badge variant="secondary">
                                {pendingPicks.length} pending
                              </Badge>
                            )}
                            {gameweekInfo && (
                              <Badge variant={
                                gameweekInfo.status === 'open' ? 'secondary' : 
                                gameweekInfo.status === 'active' ? 'default' : 
                                'outline'
                              }>
                                {gameweekInfo.status}
                              </Badge>
                            )}
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
                        <CardContent className="p-2 sm:p-6">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead 
                                    className="cursor-pointer hover:bg-muted/50 p-2 text-xs sm:text-sm"
                                    onClick={() => handleSort('player')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Player
                                      {sortBy === 'player' && (
                                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                      )}
                                    </div>
                                  </TableHead>
                                  <TableHead 
                                    className="cursor-pointer hover:bg-muted/50 p-2 text-xs sm:text-sm"
                                    onClick={() => handleSort('result')}
                                  >
                                    <div className="flex items-center gap-1">
                                      Pick & Result
                                      {sortBy === 'result' && (
                                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                      )}
                                    </div>
                                  </TableHead>
                                  <TableHead 
                                    className="cursor-pointer hover:bg-muted/50 text-right p-2 text-xs sm:text-sm"
                                    onClick={() => handleSort('goals')}
                                  >
                                    <div className="flex items-center justify-end gap-1">
                                      Goals
                                      {sortBy === 'goals' && (
                                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                      )}
                                    </div>
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allGameweekEntries.map((pick) => (
                                  <TableRow key={pick.id} className={pick.isPending ? "opacity-60" : ""}>
                                    <TableCell className="font-medium p-2 text-xs sm:text-sm">
                                      {pick.profiles?.display_name || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="p-2">
                                      {pick.isPending ? (
                                        <div className="text-xs text-muted-foreground">Pick pending</div>
                                      ) : gameweekInfo?.status === 'open' ? (
                                        <div className="text-xs text-muted-foreground">Pick hidden</div>
                                      ) : (
                                        <div className="space-y-1">
                                          <div className="text-xs text-muted-foreground">
                                            {pick.fixtures ? 
                                              `${pick.fixtures.home_team.short_name} vs ${pick.fixtures.away_team.short_name}` : 
                                              'No fixture'
                                            }
                                          </div>
                                          <div className="flex items-center gap-1 flex-wrap">
                                            {pick.picked_side && (
                                              <Badge 
                                                className={`text-xs px-1 py-0 ${
                                                  pick.result === 'win' ? 'bg-green-500/20 text-green-700 border-green-300 dark:bg-green-500/30 dark:text-green-300 dark:border-green-500' :
                                                  pick.result === 'lose' ? 'bg-red-500/20 text-red-700 border-red-300 dark:bg-red-500/30 dark:text-red-300 dark:border-red-500' :
                                                  pick.result === 'draw' ? 'bg-orange-500/20 text-orange-700 border-orange-300 dark:bg-orange-500/30 dark:text-orange-300 dark:border-orange-500' :
                                                  pick.fixtures?.is_completed ? 'bg-yellow-500/20 text-yellow-700 border-yellow-300 dark:bg-yellow-500/30 dark:text-yellow-300 dark:border-yellow-500' :
                                                  'bg-gray-500/20 text-gray-700 border-gray-300 dark:bg-gray-500/30 dark:text-gray-300 dark:border-gray-500'
                                                }`}
                                              >
                                                {pick.picked_side === 'home' 
                                                  ? pick.fixtures?.home_team.short_name 
                                                  : pick.fixtures?.away_team.short_name
                                                }
                                              </Badge>
                                            )}
                                            {pick.multiplier && pick.multiplier > 1 && (
                                              <Badge variant="outline" className="text-xs px-1 py-0">
                                                {pick.multiplier}x
                                              </Badge>
                                            )}
                                            {pick.result && (
                                              <span className={`text-xs font-medium ${
                                                pick.result === 'win' ? 'text-green-600 dark:text-green-400' :
                                                pick.result === 'lose' ? 'text-red-600 dark:text-red-400' :
                                                pick.result === 'draw' ? 'text-orange-600 dark:text-orange-400' :
                                                'text-muted-foreground'
                                              }`}>
                                                {pick.result}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium p-2 text-xs sm:text-sm">
                                      {pick.isPending ? '-' : (pick.goals || 0)}
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