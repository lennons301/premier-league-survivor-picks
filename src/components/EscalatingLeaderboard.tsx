import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Check, X } from "lucide-react";
import { useMemo } from "react";

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

interface EscalatingLeaderboardProps {
  allPicks: Pick[];
  gamePlayers: GamePlayer[];
  gameGameweeks: GameGameweek[];
  startingGameweek: number;
  currentGameweek: number;
}

interface PlayerEscalatingStats {
  userId: string;
  displayName: string;
  isEliminated: boolean;
  eliminatedGameweek?: number;
  totalWins: number;
  totalLosses: number;
  totalGoals: number;
  gameweekStats: Record<number, { wins: number; losses: number; draws: number; required: number; goals: number }>;
}

export default function EscalatingLeaderboard({ 
  allPicks, 
  gamePlayers, 
  gameGameweeks,
  startingGameweek,
  currentGameweek 
}: EscalatingLeaderboardProps) {
  
  // Get gameweeks in order
  const orderedGameweeks = useMemo(() => {
    return gameGameweeks
      .filter(gw => gw.gameweek_number >= startingGameweek && gw.gameweek_number <= currentGameweek)
      .sort((a, b) => a.gameweek_number - b.gameweek_number);
  }, [gameGameweeks, startingGameweek, currentGameweek]);

  const leaderboardData = useMemo(() => {
    const playerStats: PlayerEscalatingStats[] = gamePlayers.map(player => {
      const userPicks = allPicks.filter(p => p.user_id === player.user_id);
      
      let totalWins = 0;
      let totalLosses = 0;
      let totalGoals = 0;
      const gameweekStats: Record<number, { wins: number; losses: number; draws: number; required: number; goals: number }> = {};

      orderedGameweeks.forEach((gw, index) => {
        const requiredPicks = index + 1; // GW1 = 1 pick, GW2 = 2 picks, etc.
        const gwPicks = userPicks.filter(p => p.gameweek === gw.gameweek_number);
        
        let wins = 0;
        let losses = 0;
        let draws = 0;
        let goals = 0;

        gwPicks.forEach(pick => {
          if (pick.result === 'win') {
            wins++;
            totalWins++;
            // Add goals from winning picks
            if (pick.fixtures?.is_completed) {
              const homeScore = pick.fixtures.home_score ?? 0;
              const awayScore = pick.fixtures.away_score ?? 0;
              goals += pick.picked_side === 'home' ? homeScore : awayScore;
            }
          } else if (pick.result === 'loss') {
            losses++;
            totalLosses++;
          } else if (pick.result === 'draw') {
            draws++;
            // Draws count as losses for elimination, but track separately
          }
        });

        totalGoals += goals;
        gameweekStats[gw.gameweek_number] = { wins, losses, draws, required: requiredPicks, goals };
      });

      return {
        userId: player.user_id,
        displayName: player.profiles?.display_name || 'Unknown',
        isEliminated: player.is_eliminated,
        eliminatedGameweek: player.eliminated_gameweek,
        totalWins,
        totalLosses,
        totalGoals,
        gameweekStats
      };
    });

    // Sort: active players first, then by total wins (desc), then by total goals (desc)
    return playerStats.sort((a, b) => {
      // Active players first
      if (a.isEliminated !== b.isEliminated) {
        return a.isEliminated ? 1 : -1;
      }
      // Then by total wins
      if (b.totalWins !== a.totalWins) {
        return b.totalWins - a.totalWins;
      }
      // Then by total goals (tiebreaker)
      return b.totalGoals - a.totalGoals;
    });
  }, [allPicks, gamePlayers, orderedGameweeks]);

  if (leaderboardData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No players in this game yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Escalating Leaderboard</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Required picks increase each gameweek (1, 2, 3...). Any wrong pick eliminates. Goals in winning picks used as tiebreaker.
      </p>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Wins</span>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <X className="h-4 w-4 text-red-500" />
                  <span>Losses</span>
                </div>
              </TableHead>
              <TableHead className="text-center">Goals (TB)</TableHead>
              {orderedGameweeks.map((gw, index) => (
                <TableHead key={gw.gameweek_number} className="text-center min-w-[80px]">
                  <div className="flex flex-col items-center">
                    <span className="text-xs">GW{gw.gameweek_number}</span>
                    <span className="text-[10px] text-muted-foreground">({index + 1} req)</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboardData.map((player, index) => (
              <TableRow 
                key={player.userId}
                className={
                  player.isEliminated 
                    ? "bg-red-500/5 text-muted-foreground" 
                    : index === 0 ? "bg-yellow-500/10" : ""
                }
              >
                <TableCell className="text-center font-medium">
                  {!player.isEliminated && index === 0 ? (
                    <Trophy className="h-5 w-5 text-yellow-500 mx-auto" />
                  ) : (
                    index + 1
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {player.displayName}
                  {player.isEliminated && player.eliminatedGameweek && (
                    <span className="text-xs text-red-500 ml-1">(Elim GW{player.eliminatedGameweek})</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={player.isEliminated ? "destructive" : "default"}>
                    {player.isEliminated ? "Eliminated" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-semibold text-green-600">
                  {player.totalWins}
                </TableCell>
                <TableCell className="text-center font-semibold text-red-600">
                  {player.totalLosses}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {player.totalGoals}
                </TableCell>
                {orderedGameweeks.map((gw) => {
                  const stats = player.gameweekStats[gw.gameweek_number];
                  if (!stats) {
                    return (
                      <TableCell key={gw.gameweek_number} className="text-center text-muted-foreground">
                        -
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={gw.gameweek_number} className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-xs font-medium ${
                          stats.wins === stats.required ? 'text-green-600' : 
                          stats.losses > 0 || stats.draws > 0 ? 'text-red-600' : ''
                        }`}>
                          {stats.wins}/{stats.required}
                        </span>
                        {stats.draws > 0 && (
                          <span className="text-[10px] text-orange-500">
                            ({stats.draws} draw)
                          </span>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
