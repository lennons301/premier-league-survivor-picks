import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, Download, Loader2 } from "lucide-react";
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
  gameweekStatus?: 'open' | 'active' | 'finished' | 'upcoming';
}

interface PlayerTurboStats {
  userId: string;
  displayName: string;
  consecutiveCorrect: number;
  goalsInCorrectPicks: number;
  picks: (Pick | null)[];
}

export default function TurboLeaderboard({ 
  allPicks, 
  gamePlayers, 
  currentGameweek,
  gameweekStatus = 'open'
}: TurboLeaderboardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Picks should be visible only when gameweek is active or finished
  const picksAreVisible = gameweekStatus === 'active' || gameweekStatus === 'finished';

  const leaderboardData = useMemo(() => {
    const playerStats: PlayerTurboStats[] = gamePlayers.map(player => {
      const userPicks = allPicks
        .filter(p => p.user_id === player.user_id && p.gameweek === currentGameweek)
        .sort((a, b) => (a.preference_order || 0) - (b.preference_order || 0));

      // Calculate consecutive correct picks using the result field from database
      let consecutiveCorrect = 0;
      let goalsInCorrectPicks = 0;
      
      for (const pick of userPicks) {
        if (pick.result === 'win') {
          consecutiveCorrect++;
          goalsInCorrectPicks += pick.goals_scored || 0;
        } else if (pick.result === 'loss') {
          // In turbo mode, 'loss' means prediction != actual result
          // Note: draw predictions that match get result='win', not 'draw'
          break;
        } else {
          // No result yet (pending) - stop counting
          break;
        }
      }

      // Create array of 10 picks (filled with actual picks or null)
      const picks: (Pick | null)[] = Array.from({ length: 10 }, (_, i) => {
        return userPicks.find(p => (p.preference_order || 0) === i + 1) || null;
      });

      return {
        userId: player.user_id,
        displayName: player.profiles?.display_name || 'Unknown',
        consecutiveCorrect,
        goalsInCorrectPicks,
        picks
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

  if (leaderboardData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No players in this game yet.
      </div>
    );
  }

  const getPickCellContent = (pick: Pick | null, isVisible: boolean) => {
    // If picks aren't visible yet (deadline not passed), show "?"
    if (!isVisible) {
      return { label: '?', className: 'bg-muted/50 text-muted-foreground' };
    }
    
    if (!pick) {
      return { label: '-', className: 'bg-muted/30 text-muted-foreground' };
    }
    
    // Get team short name based on pick type
    let teamShort: string | undefined;
    if (pick.predicted_result === 'draw') {
      const homeShort = pick.fixtures?.home_team?.short_name || '?';
      teamShort = `${homeShort} - D`;
    } else {
      teamShort = pick.picked_side === 'home' 
        ? pick.fixtures?.home_team?.short_name 
        : pick.fixtures?.away_team?.short_name;
    }
    
    if (pick.result === 'win') {
      return { label: teamShort || '?', className: 'bg-green-600 text-white font-semibold' };
    } else if (pick.result === 'loss') {
      // In turbo mode, 'loss' = prediction didn't match actual result
      return { label: teamShort || '?', className: 'bg-red-600 text-white font-semibold' };
    } else {
      // Pending - fixture not complete
      return { label: teamShort || '?', className: 'bg-muted text-foreground' };
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <h3 className="text-base font-semibold">Turbo Leaderboard</h3>
          <Badge variant="outline" className="text-xs">GW{currentGameweek}</Badge>
          {gameweekStatus === 'open' && (
            <Badge variant="secondary" className="text-xs">Picks Hidden</Badge>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExportPng}
          disabled={isExporting}
          className="gap-1.5 h-8 text-xs"
        >
          {isExporting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          PNG
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Ranked by consecutive correct predictions. Goals as tiebreaker.
      </p>

      {/* Scrollable Grid - optimized for mobile */}
      <div 
        ref={gridRef} 
        className="rounded-lg border bg-card overflow-x-auto"
      >
        <div className="min-w-max">
          {/* Header row */}
          <div className="flex border-b bg-muted/30">
            <div className="w-20 sm:w-28 shrink-0 px-2 py-1.5 font-medium text-xs border-r">
              Player
            </div>
            <div className="w-8 sm:w-10 shrink-0 px-1 py-1.5 text-center font-medium text-xs border-r" title="Streak">
              🔥
            </div>
            <div className="w-8 sm:w-10 shrink-0 px-1 py-1.5 text-center font-medium text-xs border-r" title="Goals">
              ⚽
            </div>
            {Array.from({ length: 10 }, (_, i) => (
              <div 
                key={i} 
                className="w-9 sm:w-11 shrink-0 px-1 py-1.5 text-center font-medium text-xs"
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Player rows */}
          {leaderboardData.map((player, index) => (
            <div 
              key={player.userId} 
              className={`flex border-b last:border-b-0 ${index === 0 ? 'bg-yellow-500/10' : index % 2 === 0 ? 'bg-muted/5' : ''}`}
            >
              {/* Player name with rank */}
              <div className="w-20 sm:w-28 shrink-0 px-2 py-1 border-r flex items-center gap-1">
                {index === 0 ? (
                  <Trophy className="h-3 w-3 text-yellow-500 shrink-0" />
                ) : (
                  <span className="w-3 text-center text-[10px] text-muted-foreground shrink-0">{index + 1}</span>
                )}
                <span className="truncate text-xs font-medium">{player.displayName}</span>
              </div>
              
              {/* Streak count */}
              <div className="w-8 sm:w-10 shrink-0 px-1 py-1 text-center border-r flex items-center justify-center">
                <span className={`text-xs font-bold ${player.consecutiveCorrect >= 5 ? "text-green-500" : player.consecutiveCorrect > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {player.consecutiveCorrect}
                </span>
              </div>
              
              {/* Goals tiebreaker */}
              <div className="w-8 sm:w-10 shrink-0 px-1 py-1 text-center text-xs text-muted-foreground border-r flex items-center justify-center">
                {player.goalsInCorrectPicks}
              </div>

              {/* Pick cells 1-10 */}
              {player.picks.map((pick, i) => {
                const { label, className } = getPickCellContent(pick, picksAreVisible);
                
                return (
                  <div 
                    key={i} 
                    className="w-9 sm:w-11 shrink-0 p-0.5 flex items-center justify-center"
                  >
                    <div 
                      className={`w-full h-6 sm:h-7 flex items-center justify-center text-[10px] sm:text-xs rounded ${className}`}
                      title={pick?.fixtures ? `${pick.fixtures.home_team.short_name} vs ${pick.fixtures.away_team.short_name}` : undefined}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-2 py-2 border-t text-[10px] text-muted-foreground bg-muted/20">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-600"></div>
            <span>✓</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-600"></div>
            <span>✗</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted"></div>
            <span>Pending</span>
          </div>
          {!picksAreVisible && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted/50 text-center text-[8px]">?</div>
              <span>Hidden</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
