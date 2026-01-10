import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Award, Copy, Loader2, Heart } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface CupPick {
  id: string;
  user_id: string;
  fixture_id: string;
  picked_team: string;
  preference_order: number;
  result: string | null;
  goals_counted: number;
  life_gained: number;
  life_spent: boolean;
  cup_fixtures: {
    home_team: string;
    away_team: string;
    tier_difference: number;
    home_goals: number | null;
    away_goals: number | null;
  } | null;
}

interface GamePlayer {
  user_id: string;
  is_eliminated: boolean;
  eliminated_gameweek?: number;
  lives: number;
  profiles: { display_name: string } | null;
}

interface CupLeaderboardProps {
  allPicks: CupPick[];
  gamePlayers: GamePlayer[];
  gameStatus?: 'active' | 'finished' | 'pending';
}

interface PlayerCupStats {
  userId: string;
  displayName: string;
  streak: number;
  lives: number;
  goalsScored: number;
  picks: (CupPick | null)[];
  hasMadePicks: boolean;
}

export default function CupLeaderboard({ 
  allPicks, 
  gamePlayers, 
  gameStatus = 'active'
}: CupLeaderboardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const picksAreVisible = gameStatus === 'active' || gameStatus === 'finished';

  const leaderboardData = useMemo(() => {
    const playerStats: PlayerCupStats[] = gamePlayers.map(player => {
      const userPicks = allPicks
        .filter(p => p.user_id === player.user_id)
        .sort((a, b) => (a.preference_order || 0) - (b.preference_order || 0));

      // Calculate streak (consecutive successful picks)
      let streak = 0;
      let goalsScored = 0;
      
      for (const pick of userPicks) {
        const isSuccess = pick.result === 'win' || pick.result === 'draw_success' || pick.result === 'saved_by_life';
        if (isSuccess) {
          streak++;
          goalsScored += pick.goals_counted || 0;
        } else if (pick.result === 'loss') {
          break;
        } else {
          // Pending - stop counting
          break;
        }
      }

      // Create array of 10 picks - for pending status, show empty placeholders
      const picks: (CupPick | null)[] = Array.from({ length: 10 }, (_, i) => {
        return userPicks.find(p => p.preference_order === i + 1) || null;
      });

      return {
        userId: player.user_id,
        displayName: player.profiles?.display_name || 'Unknown',
        streak,
        lives: player.lives || 0,
        goalsScored,
        picks,
        hasMadePicks: userPicks.length > 0
      };
    });

    // Sort by: streak (desc), then lives (desc), then goals (desc)
    return playerStats.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (b.lives !== a.lives) return b.lives - a.lives;
      return b.goalsScored - a.goalsScored;
    });
  }, [allPicks, gamePlayers]);

  const handleCopyToClipboard = async () => {
    if (!gridRef.current) return;
    
    setIsExporting(true);
    try {
      const innerGrid = gridRef.current.querySelector('.min-w-max') as HTMLElement;
      const targetElement = innerGrid || gridRef.current;
      
      const canvas = await html2canvas(targetElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        windowWidth: targetElement.scrollWidth,
        windowHeight: targetElement.scrollHeight,
      });
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            toast.success("Leaderboard copied to clipboard!");
          } catch {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `cup-leaderboard.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("Leaderboard downloaded");
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to copy leaderboard");
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

  // Calculate the actual status of each pick considering life order
  // Lives can only save if gained BEFORE the loss
  const getPickCellContent = (
    pick: CupPick | null, 
    isVisible: boolean, 
    hasMadePicks: boolean,
    livesAvailableAtThisPick: number
  ) => {
    // If picks are not visible yet (before deadline)
    if (!isVisible) {
      // Show 'pending' for players who have made picks, '-' for those who haven't
      if (hasMadePicks) {
        return { label: 'pending', style: { backgroundColor: '#e5e7eb', color: '#6b7280', fontSize: '9px' } };
      }
      return { label: '-', style: { backgroundColor: '#f3f4f6', color: '#9ca3af' } };
    }
    
    if (!pick) {
      return { label: '-', style: { backgroundColor: '#f3f4f6', color: '#6b7280' } };
    }
    
    const teamName = pick.picked_team === 'home' 
      ? pick.cup_fixtures?.home_team?.substring(0, 3).toUpperCase()
      : pick.cup_fixtures?.away_team?.substring(0, 3).toUpperCase();
    
    // Check if this pick could gain lives (underdog pick)
    // tier_difference is from home team's perspective
    // Positive = home team is higher tier, Negative = away team is higher tier
    const tierDiff = pick.cup_fixtures?.tier_difference || 0;
    const couldGainLife = pick.picked_team === 'home' 
      ? tierDiff < 0  // Home team is lower tier (underdog)
      : tierDiff > 0; // Away team is lower tier (underdog)
    
    if (pick.result === 'win' || pick.result === 'draw_success') {
      const lifeIndicator = pick.life_gained > 0 ? ` +${pick.life_gained}❤️` : '';
      return { 
        label: `${teamName || '?'}${lifeIndicator}`, 
        style: { backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 600 } 
      };
    } else if (pick.result === 'saved_by_life') {
      // Only show as saved if there was actually a life available at this point
      if (livesAvailableAtThisPick > 0) {
        return { 
          label: `${teamName || '?'} 🛡️`, 
          style: { backgroundColor: '#eab308', color: '#000000', fontWeight: 600 } 
        };
      } else {
        // No life was available - this should be shown as a loss (elimination)
        return { 
          label: teamName || '?', 
          style: { backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 600 } 
        };
      }
    } else if (pick.result === 'loss') {
      return { 
        label: teamName || '?', 
        style: { backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 600 } 
      };
    } else {
      // Pending result (after deadline but before results processed)
      // Highlight underdog picks that could gain lives
      if (couldGainLife) {
        return { 
          label: `${teamName || '?'} ❤️`, 
          style: { backgroundColor: '#fce7f3', color: '#be185d', fontWeight: 600, border: '2px solid #ec4899' } 
        };
      }
      return { label: teamName || '?', style: { backgroundColor: '#e5e7eb', color: '#374151' } };
    }
  };

  // Calculate lives available at each pick position for a player
  const calculateLivesAtEachPick = (picks: (CupPick | null)[]): number[] => {
    const livesAtPick: number[] = [];
    let currentLives = 0;
    
    for (const pick of picks) {
      // Lives available BEFORE this pick's result is processed
      livesAtPick.push(currentLives);
      
      if (pick) {
        // Add lives gained from successful picks
        if (pick.result === 'win' || pick.result === 'draw_success') {
          currentLives += pick.life_gained || 0;
        } else if (pick.result === 'saved_by_life' && currentLives > 0) {
          // Life was spent
          currentLives -= 1;
        }
        // On loss or saved_by_life with no lives, streak is broken - stop counting
        if (pick.result === 'loss' || (pick.result === 'saved_by_life' && livesAtPick[livesAtPick.length - 1] <= 0)) {
          break;
        }
      }
    }
    
    // Fill remaining slots with 0
    while (livesAtPick.length < 10) {
      livesAtPick.push(0);
    }
    
    return livesAtPick;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-purple-500" />
          <h3 className="text-base font-semibold">Cup Leaderboard</h3>
          {gameStatus === 'pending' && (
            <Badge variant="secondary" className="text-xs">Picks Hidden</Badge>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCopyToClipboard}
          disabled={isExporting}
          className="gap-1.5 h-8 text-xs"
        >
          {isExporting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          Copy
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Ranked by streak, then lives remaining, then goals scored.
      </p>

      <div 
        ref={gridRef} 
        className="rounded-lg border overflow-x-auto"
        style={{ backgroundColor: '#ffffff' }}
      >
        <div className="min-w-max">
          {/* Header row */}
          <div className="flex border-b" style={{ backgroundColor: '#f9fafb' }}>
            <div className="w-28 sm:w-36 shrink-0 px-2 py-1.5 font-medium text-xs border-r" style={{ color: '#111827' }}>
              Player
            </div>
            <div className="w-8 sm:w-10 shrink-0 px-1 py-1.5 text-center font-medium text-xs border-r" title="Streak">
              🔥
            </div>
            <div className="w-8 sm:w-10 shrink-0 px-1 py-1.5 text-center font-medium text-xs border-r" title="Lives">
              ❤️
            </div>
            <div className="w-8 sm:w-10 shrink-0 px-1 py-1.5 text-center font-medium text-xs border-r" title="Goals">
              ⚽
            </div>
            {Array.from({ length: 10 }, (_, i) => (
              <div 
                key={i} 
                className="w-16 sm:w-20 shrink-0 px-1 py-1.5 text-center font-medium text-xs"
                style={{ color: '#111827' }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Player rows */}
          {leaderboardData.map((player, index) => (
            <div 
              key={player.userId} 
              className="flex border-b last:border-b-0"
              style={{ backgroundColor: index === 0 ? '#fef9c3' : index % 2 === 0 ? '#f9fafb' : '#ffffff' }}
            >
              {/* Player name */}
              <div className="w-28 sm:w-36 shrink-0 px-2 py-1 border-r flex items-center gap-1">
                {index === 0 ? (
                  <Trophy className="h-3 w-3 text-yellow-500 shrink-0" />
                ) : (
                  <span className="w-3 text-center text-[10px] shrink-0" style={{ color: '#6b7280' }}>{index + 1}</span>
                )}
                <span className="truncate text-xs font-medium" style={{ color: '#111827' }}>{player.displayName}</span>
              </div>
              
              {/* Streak */}
              <div className="w-8 sm:w-10 shrink-0 px-1 py-1 text-center border-r flex items-center justify-center">
                <span 
                  className="text-xs font-bold"
                  style={{ color: player.streak >= 5 ? '#16a34a' : player.streak > 0 ? '#111827' : '#6b7280' }}
                >
                  {player.streak}
                </span>
              </div>
              
              {/* Lives */}
              <div className="w-8 sm:w-10 shrink-0 px-1 py-1 text-center border-r flex items-center justify-center">
                <span 
                  className="text-xs font-bold"
                  style={{ color: player.lives > 0 ? '#dc2626' : '#6b7280' }}
                >
                  {player.lives}
                </span>
              </div>
              
              {/* Goals */}
              <div className="w-8 sm:w-10 shrink-0 px-1 py-1 text-center text-xs border-r flex items-center justify-center" style={{ color: '#6b7280' }}>
                {player.goalsScored}
              </div>

              {/* Pick cells */}
              {(() => {
                const livesAtEachPick = calculateLivesAtEachPick(player.picks);
                return player.picks.map((pick, i) => {
                  const { label, style } = getPickCellContent(pick, picksAreVisible, player.hasMadePicks, livesAtEachPick[i]);
                  
                  return (
                    <div 
                      key={i} 
                      className="w-16 sm:w-20 shrink-0 p-0.5 flex items-center justify-center"
                    >
                      <div 
                        className="w-full h-7 sm:h-8 flex items-center justify-center text-[9px] sm:text-xs rounded text-center px-1"
                        style={style}
                        title={pick?.cup_fixtures ? `${pick.cup_fixtures.home_team} vs ${pick.cup_fixtures.away_team}` : undefined}
                      >
                        {label}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-2 py-2 border-t text-[10px] text-muted-foreground bg-muted/20 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-600"></div>
            <span>Win</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span>Saved</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-600"></div>
            <span>Loss</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted"></div>
            <span>Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}