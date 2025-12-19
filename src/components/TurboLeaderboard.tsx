import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap, Target } from "lucide-react";
import { useMemo } from "react";

interface Pick {
  id: string;
  gameweek: number;
  user_id: string;
  picked_side: string;
  result: string | null;
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

interface GamePlayer {
  user_id: string;
  is_eliminated: boolean;
  eliminated_gameweek?: number;
  profiles: { display_name: string } | null;
}

interface TurboLeaderboardProps {
  allPicks: Pick[];
  gamePlayers: GamePlayer[];
  currentGameweek: number;
}

interface PlayerTurboStats {
  userId: string;
  displayName: string;
  consecutiveCorrect: number;
  totalCorrect: number;
  totalPicks: number;
  goalsInCorrectPicks: number;
  picks: Pick[];
}

export default function TurboLeaderboard({ allPicks, gamePlayers, currentGameweek }: TurboLeaderboardProps) {
  const leaderboardData = useMemo(() => {
    const playerStats: PlayerTurboStats[] = gamePlayers.map(player => {
      const userPicks = allPicks
        .filter(p => p.user_id === player.user_id && p.gameweek === currentGameweek)
        .sort((a, b) => (a.preference_order || 0) - (b.preference_order || 0));

      // Calculate consecutive correct picks from first preference
      let consecutiveCorrect = 0;
      let goalsInCorrectPicks = 0;
      
      for (const pick of userPicks) {
        if (!pick.fixtures?.is_completed) break;
        
        const homeScore = pick.fixtures.home_score ?? 0;
        const awayScore = pick.fixtures.away_score ?? 0;
        
        // Determine actual result
        let actualResult: 'home_win' | 'away_win' | 'draw';
        if (homeScore > awayScore) actualResult = 'home_win';
        else if (awayScore > homeScore) actualResult = 'away_win';
        else actualResult = 'draw';
        
        // Check if prediction matches
        const predictedResult = pick.predicted_result;
        const isCorrect = predictedResult === actualResult;
        
        if (isCorrect) {
          consecutiveCorrect++;
          // Add goals from the team they picked
          if (pick.picked_side === 'home') {
            goalsInCorrectPicks += homeScore;
          } else {
            goalsInCorrectPicks += awayScore;
          }
        } else {
          break; // Stop counting at first wrong prediction
        }
      }

      const totalCorrect = userPicks.filter(pick => {
        if (!pick.fixtures?.is_completed) return false;
        const homeScore = pick.fixtures.home_score ?? 0;
        const awayScore = pick.fixtures.away_score ?? 0;
        let actualResult: string;
        if (homeScore > awayScore) actualResult = 'home_win';
        else if (awayScore > homeScore) actualResult = 'away_win';
        else actualResult = 'draw';
        return pick.predicted_result === actualResult;
      }).length;

      return {
        userId: player.user_id,
        displayName: player.profiles?.display_name || 'Unknown',
        consecutiveCorrect,
        totalCorrect,
        totalPicks: userPicks.length,
        goalsInCorrectPicks,
        picks: userPicks
      };
    });

    // Sort by consecutive correct (desc), then goals in correct picks (desc)
    return playerStats.sort((a, b) => {
      if (b.consecutiveCorrect !== a.consecutiveCorrect) {
        return b.consecutiveCorrect - a.consecutiveCorrect;
      }
      return b.goalsInCorrectPicks - a.goalsInCorrectPicks;
    });
  }, [allPicks, gamePlayers, currentGameweek]);

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
        <Zap className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold">Turbo Leaderboard</h3>
        <Badge variant="outline" className="ml-2">GW{currentGameweek}</Badge>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Ranked by consecutive correct predictions (by preference order), then goals scored in correct picks as tiebreaker.
      </p>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Target className="h-4 w-4" />
                  <span>Streak</span>
                </div>
              </TableHead>
              <TableHead className="text-center">Total Correct</TableHead>
              <TableHead className="text-center">Goals (TB)</TableHead>
              <TableHead className="text-center">Picks Made</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboardData.map((player, index) => (
              <TableRow 
                key={player.userId}
                className={index === 0 ? "bg-yellow-500/10" : ""}
              >
                <TableCell className="text-center font-medium">
                  {index === 0 ? (
                    <Trophy className="h-5 w-5 text-yellow-500 mx-auto" />
                  ) : (
                    index + 1
                  )}
                </TableCell>
                <TableCell className="font-medium">{player.displayName}</TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={player.consecutiveCorrect > 0 ? "default" : "secondary"}
                    className={player.consecutiveCorrect >= 5 ? "bg-green-500" : ""}
                  >
                    {player.consecutiveCorrect}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{player.totalCorrect}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {player.goalsInCorrectPicks}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {player.totalPicks}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
