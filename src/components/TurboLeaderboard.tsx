import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, Target, Download, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

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
  goalsInCorrectPicks: number;
  picks: Pick[];
}

export default function TurboLeaderboard({ allPicks, gamePlayers, currentGameweek }: TurboLeaderboardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const leaderboardData = useMemo(() => {
    const playerStats: PlayerTurboStats[] = gamePlayers.map(player => {
      const userPicks = allPicks
        .filter(p => p.user_id === player.user_id && p.gameweek === currentGameweek)
        .sort((a, b) => (a.preference_order || 0) - (b.preference_order || 0));

      // Calculate consecutive correct picks using the result field from database
      let consecutiveCorrect = 0;
      let goalsInCorrectPicks = 0;
      
      for (const pick of userPicks) {
        // Use the result field directly - 'win' means correct prediction
        if (pick.result === 'win') {
          consecutiveCorrect++;
          // Add goals - for draws, goals_scored already includes both teams' goals
          goalsInCorrectPicks += pick.goals_scored || 0;
        } else if (pick.result === 'loss' || pick.result === 'draw') {
          // Streak broken
          break;
        } else {
          // Result is null - fixture not completed yet, stop counting
          break;
        }
      }

      // Count total correct picks using result field
      const totalCorrect = userPicks.filter(pick => pick.result === 'win').length;

      return {
        userId: player.user_id,
        displayName: player.profiles?.display_name || 'Unknown',
        consecutiveCorrect,
        totalCorrect,
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

  const handleExportPng = async () => {
    if (!gridRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(gridRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
      });
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `turbo-leaderboard-gw${currentGameweek}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          toast.success("Leaderboard exported!");
        }
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export leaderboard");
    } finally {
      setIsExporting(false);
    }
  };

  // Get the max number of picks any player has made (up to 10)
  const maxPicks = Math.min(10, Math.max(...leaderboardData.map(p => p.picks.length), 1));

  if (leaderboardData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No players in this game yet.
      </div>
    );
  }

  const getPickCellContent = (pick: Pick | undefined) => {
    if (!pick) return { label: '-', className: 'bg-muted/30 text-muted-foreground' };
    
    const teamShort = pick.picked_side === 'home' 
      ? pick.fixtures?.home_team?.short_name 
      : pick.fixtures?.away_team?.short_name;
    
    if (pick.result === 'win') {
      return { label: teamShort || '?', className: 'bg-green-500/80 text-white font-semibold' };
    } else if (pick.result === 'loss' || pick.result === 'draw') {
      return { label: teamShort || '?', className: 'bg-red-500/80 text-white font-semibold' };
    } else {
      // Pending - fixture not complete
      return { label: teamShort || '?', className: 'bg-muted text-muted-foreground' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Turbo Leaderboard</h3>
          <Badge variant="outline" className="ml-2">GW{currentGameweek}</Badge>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportPng}
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export PNG
        </Button>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Ranked by consecutive correct predictions. Goals scored as tiebreaker.
      </p>

      {/* Exportable Grid */}
      <div 
        ref={gridRef} 
        className="rounded-lg border bg-card p-3 overflow-x-auto"
      >
        {/* Header with pick numbers */}
        <div className="flex min-w-max">
          <div className="w-24 sm:w-32 shrink-0 p-2 font-semibold text-xs sm:text-sm border-b border-r">
            Player
          </div>
          <div className="w-14 shrink-0 p-2 text-center font-semibold text-xs sm:text-sm border-b border-r">
            <Target className="h-3 w-3 sm:h-4 sm:w-4 mx-auto" />
          </div>
          <div className="w-12 shrink-0 p-2 text-center font-semibold text-xs sm:text-sm border-b border-r" title="Goals">
            ⚽
          </div>
          {Array.from({ length: maxPicks }, (_, i) => (
            <div 
              key={i} 
              className="w-12 sm:w-14 shrink-0 p-2 text-center font-semibold text-xs sm:text-sm border-b"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Player rows */}
        {leaderboardData.map((player, index) => (
          <div key={player.userId} className="flex min-w-max">
            {/* Player name with rank */}
            <div className={`w-24 sm:w-32 shrink-0 p-2 border-r flex items-center gap-1 text-xs sm:text-sm ${index === 0 ? 'bg-yellow-500/10' : ''}`}>
              {index === 0 ? (
                <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 shrink-0" />
              ) : (
                <span className="w-3 sm:w-4 text-center text-muted-foreground shrink-0">{index + 1}</span>
              )}
              <span className="truncate font-medium">{player.displayName}</span>
            </div>
            
            {/* Streak count */}
            <div className={`w-14 shrink-0 p-2 text-center border-r ${index === 0 ? 'bg-yellow-500/10' : ''}`}>
              <Badge 
                variant={player.consecutiveCorrect > 0 ? "default" : "secondary"}
                className={`text-xs ${player.consecutiveCorrect >= 5 ? "bg-green-500" : ""}`}
              >
                {player.consecutiveCorrect}
              </Badge>
            </div>
            
            {/* Goals tiebreaker */}
            <div className={`w-12 shrink-0 p-2 text-center text-xs sm:text-sm text-muted-foreground border-r ${index === 0 ? 'bg-yellow-500/10' : ''}`}>
              {player.goalsInCorrectPicks}
            </div>

            {/* Pick cells */}
            {Array.from({ length: maxPicks }, (_, i) => {
              const pick = player.picks[i];
              const { label, className } = getPickCellContent(pick);
              
              return (
                <div 
                  key={i} 
                  className={`w-12 sm:w-14 shrink-0 p-1 sm:p-2 text-center text-xs sm:text-sm rounded-sm m-0.5 ${className} ${index === 0 && !pick?.result ? 'bg-yellow-500/10' : ''}`}
                  title={pick?.fixtures ? `${pick.fixtures.home_team.short_name} vs ${pick.fixtures.away_team.short_name}` : undefined}
                >
                  {label}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-500/80"></div>
            <span>Correct</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-500/80"></div>
            <span>Wrong</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-muted"></div>
            <span>Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}