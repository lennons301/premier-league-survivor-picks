import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Target, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Settings, 
  Search,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  RotateCcw
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface GameGameweek {
  gameweek_number: number;
  status: string;
  picks_visible: boolean;
}

interface PlayerProgressData {
  userId: string;
  displayName: string;
  isEliminated: boolean;
  eliminatedGameweek?: number;
  gameweekData: Record<number, any>;
  totalGoals: number;
}

interface PlayerProgressTableProps {
  pivotData: PlayerProgressData[];
  gameGameweeks: GameGameweek[];
  currentGameweek: number;
  gameGameweek?: GameGameweek;
  allPicks?: any[];
}

type ViewDensity = 'compact' | 'normal' | 'comfortable';
type SortField = 'name' | 'total' | number;

export default function PlayerProgressTable({ 
  pivotData, 
  gameGameweeks, 
  currentGameweek, 
  gameGameweek,
  allPicks = []
}: PlayerProgressTableProps) {
  // State management
  const [sortBy, setSortBy] = useState<SortField>('total');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'eliminated'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDensity, setViewDensity] = useState<ViewDensity>('normal');
  const [zoomLevel, setZoomLevel] = useState([100]);
  const [visibleGameweeks, setVisibleGameweeks] = useState<Set<number>>(new Set());
  const [gameweekRange, setGameweekRange] = useState<[number, number]>([1, currentGameweek]);
  const [minimalView, setMinimalView] = useState(false);
  
  const tableRef = useRef<HTMLDivElement>(null);

  // Initialize visible gameweeks (show last 5 by default on mobile, all on desktop)
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const availableGameweeks = gameGameweeks
      .filter(gw => gw.gameweek_number <= currentGameweek)
      .map(gw => gw.gameweek_number)
      .sort((a, b) => a - b);
    
    if (isMobile && availableGameweeks.length > 5) {
      const lastFive = availableGameweeks.slice(-5);
      setVisibleGameweeks(new Set(lastFive));
      setGameweekRange([lastFive[0], lastFive[lastFive.length - 1]]);
    } else {
      setVisibleGameweeks(new Set(availableGameweeks));
      setGameweekRange([availableGameweeks[0] || 1, availableGameweeks[availableGameweeks.length - 1] || currentGameweek]);
    }
  }, [gameGameweeks, currentGameweek]);

  // Memoized filtered and sorted data
  const filteredAndSortedData = useMemo(() => {
    let filtered = pivotData;
    
    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(user => !user.isEliminated);
    } else if (statusFilter === 'eliminated') {
      filtered = filtered.filter(user => user.isEliminated);
    }
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(user => 
        user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort the filtered data
    return [...filtered].sort((a, b) => {
      let compareValue = 0;
      
      if (sortBy === 'name') {
        compareValue = a.displayName.localeCompare(b.displayName);
      } else if (sortBy === 'total') {
        compareValue = a.totalGoals - b.totalGoals;
      } else if (typeof sortBy === 'number') {
        const aPick = a.gameweekData[sortBy];
        const bPick = b.gameweekData[sortBy];
        const aTeam = aPick 
          ? (aPick.picked_side === 'home' ? aPick.fixtures?.home_team?.short_name : aPick.fixtures?.away_team?.short_name) || ''
          : '';
        const bTeam = bPick 
          ? (bPick.picked_side === 'home' ? bPick.fixtures?.home_team?.short_name : bPick.fixtures?.away_team?.short_name) || ''
          : '';
        compareValue = aTeam.localeCompare(bTeam);
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
  }, [pivotData, sortBy, sortOrder, statusFilter, searchQuery]);

  // Get visible gameweeks in range
  const visibleGameweeksInRange = useMemo(() => {
    return gameGameweeks
      .filter(gw => 
        gw.gameweek_number <= currentGameweek &&
        gw.gameweek_number >= gameweekRange[0] &&
        gw.gameweek_number <= gameweekRange[1] &&
        (minimalView ? false : visibleGameweeks.has(gw.gameweek_number))
      )
      .sort((a, b) => a.gameweek_number - b.gameweek_number);
  }, [gameGameweeks, currentGameweek, gameweekRange, visibleGameweeks, minimalView]);

  const handleSort = (column: SortField) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'name' ? 'asc' : 'desc');
    }
  };

  const toggleGameweekVisibility = (gameweek: number) => {
    const newVisible = new Set(visibleGameweeks);
    if (newVisible.has(gameweek)) {
      newVisible.delete(gameweek);
    } else {
      newVisible.add(gameweek);
    }
    setVisibleGameweeks(newVisible);
  };

  const resetToDefaults = () => {
    const isMobile = window.innerWidth < 768;
    const availableGameweeks = gameGameweeks
      .filter(gw => gw.gameweek_number <= currentGameweek)
      .map(gw => gw.gameweek_number)
      .sort((a, b) => a - b);
    
    if (isMobile && availableGameweeks.length > 5) {
      const lastFive = availableGameweeks.slice(-5);
      setVisibleGameweeks(new Set(lastFive));
      setGameweekRange([lastFive[0], lastFive[lastFive.length - 1]]);
    } else {
      setVisibleGameweeks(new Set(availableGameweeks));
      setGameweekRange([availableGameweeks[0] || 1, availableGameweeks[availableGameweeks.length - 1] || currentGameweek]);
    }
    setViewDensity('normal');
    setZoomLevel([100]);
    setMinimalView(false);
    setSearchQuery('');
    setStatusFilter('all');
  };

  // Density classes
  const densityClasses = {
    compact: "text-xs",
    normal: "text-sm", 
    comfortable: "text-base"
  };

  const cellPadding = {
    compact: "p-1",
    normal: "p-2",
    comfortable: "p-4"
  };

  const availableGameweeks = gameGameweeks
    .filter(gw => gw.gameweek_number <= currentGameweek)
    .map(gw => gw.gameweek_number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Player Progress & Standings</h3>
          <p className="text-sm text-muted-foreground">
            Cumulative goals are used as tiebreakers when all players are eliminated
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-32 sm:w-40"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'eliminated') => setStatusFilter(value)}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Players</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="eliminated">Eliminated Only</SelectItem>
            </SelectContent>
          </Select>

          {/* View Settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                View
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-4">
              {/* View Density */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">View Density</Label>
                <div className="flex gap-2">
                  {(['compact', 'normal', 'comfortable'] as ViewDensity[]).map((density) => (
                    <Button
                      key={density}
                      variant={viewDensity === density ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewDensity(density)}
                      className="capitalize"
                    >
                      {density}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Zoom Level */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Zoom Level ({zoomLevel[0]}%)</Label>
                <div className="flex items-center gap-2">
                  <ZoomOut className="h-4 w-4" />
                  <Slider
                    value={zoomLevel}
                    onValueChange={setZoomLevel}
                    max={150}
                    min={50}
                    step={10}
                    className="flex-1"
                  />
                  <ZoomIn className="h-4 w-4" />
                </div>
              </div>

              {/* Minimal View Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Minimal View</Label>
                <Switch checked={minimalView} onCheckedChange={setMinimalView} />
              </div>

              {/* Gameweek Range */}
              {!minimalView && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Gameweek Range</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={gameweekRange[0].toString()}
                      onValueChange={(value) => setGameweekRange([parseInt(value), gameweekRange[1]])}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGameweeks.map(gw => (
                          <SelectItem key={gw} value={gw.toString()}>GW{gw}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">to</span>
                    <Select
                      value={gameweekRange[1].toString()}
                      onValueChange={(value) => setGameweekRange([gameweekRange[0], parseInt(value)])}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGameweeks.filter(gw => gw >= gameweekRange[0]).map(gw => (
                          <SelectItem key={gw} value={gw.toString()}>GW{gw}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Individual Gameweek Toggles */}
              {!minimalView && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Show/Hide Gameweeks</Label>
                  <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                    {availableGameweeks.filter(gw => gw >= gameweekRange[0] && gw <= gameweekRange[1]).map(gw => (
                      <Button
                        key={gw}
                        variant={visibleGameweeks.has(gw) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleGameweekVisibility(gw)}
                        className="text-xs h-8"
                      >
                        {visibleGameweeks.has(gw) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        <span className="ml-1">GW{gw}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset Button */}
              <Button variant="outline" size="sm" onClick={resetToDefaults} className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Showing {filteredAndSortedData.length} of {pivotData.length} players</span>
        {!minimalView && <span>• {visibleGameweeksInRange.length} gameweeks visible</span>}
      </div>

      {/* Table Container */}
      <Card>
        <CardContent className="p-0">
          <div 
            ref={tableRef}
            className="overflow-auto max-h-[70vh]"
            style={{ fontSize: `${zoomLevel[0]}%` }}
          >
            <Table className={densityClasses[viewDensity]}>
              <TableHeader>
                <TableRow>
                  {/* Player Name - Always Sticky */}
                  <TableHead 
                    className="sticky left-0 bg-background cursor-pointer hover:bg-muted/50 z-20 border-r min-w-[120px] max-w-[150px]"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Player
                      {sortBy === 'name' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>

                  {/* Status Column */}
                  <TableHead className="sticky left-[120px] bg-background z-20 border-r min-w-[100px] max-w-[120px]">
                    Status
                  </TableHead>

                  {/* Total Goals - Always Sticky */}
                  <TableHead 
                    className="sticky left-[220px] bg-background cursor-pointer hover:bg-muted/50 z-20 border-r text-right min-w-[100px] max-w-[120px]"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Total Goals
                      {sortBy === 'total' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>

                  {/* Gameweek Columns */}
                  {visibleGameweeksInRange.map(gw => (
                    <TableHead 
                      key={gw.gameweek_number} 
                      className="text-center min-w-[60px] max-w-[80px] cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort(gw.gameweek_number)}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs">GW{gw.gameweek_number}</span>
                        {sortBy === gw.gameweek_number && (
                          sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((user) => (
                  <TableRow key={user.userId} className="hover:bg-muted/30">
                    {/* Player Name */}
                    <TableCell className={`sticky left-0 bg-background font-medium z-10 border-r ${cellPadding[viewDensity]} truncate`}>
                      <div className="truncate" title={user.displayName}>
                        {user.displayName}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className={`sticky left-[120px] bg-background z-10 border-r ${cellPadding[viewDensity]}`}>
                      <Badge
                        variant={user.isEliminated ? "destructive" : "secondary"}
                        className={`${user.isEliminated ? "" : "bg-green-100 text-green-800"} ${viewDensity === 'compact' ? 'text-xs px-1 py-0' : ''}`}
                      >
                        {user.isEliminated 
                          ? `Eliminated${viewDensity !== 'compact' ? ` (GW${user.eliminatedGameweek})` : ''}`
                          : "Active"
                        }
                      </Badge>
                    </TableCell>

                    {/* Total Goals */}
                    <TableCell className={`sticky left-[220px] bg-background text-right z-10 border-r ${cellPadding[viewDensity]}`}>
                      <div className="flex items-center justify-end gap-1">
                        <span className={`font-bold text-primary ${viewDensity === 'compact' ? 'text-sm' : 'text-lg'}`}>
                          {user.totalGoals}
                        </span>
                        <Target className={`text-muted-foreground ${viewDensity === 'compact' ? 'h-3 w-3' : 'h-4 w-4'}`} />
                      </div>
                    </TableCell>

                     {/* Gameweek Cells */}
                     {visibleGameweeksInRange.map(gw => {
                       const pick = user.gameweekData[gw.gameweek_number];
                       const isCurrentGameweek = gw.gameweek_number === currentGameweek;
                       const shouldShowPick = !isCurrentGameweek || gameGameweek?.picks_visible;
                       const isOpenGameweek = gw.status === 'open';
                       const hasPick = !!pick && !pick.isPending;
                       const isPending = pick?.isPending;
                       
                       // Check if user has made a pick for this gameweek
                       const userHasPick = allPicks?.some(p => p.user_id === user.userId && p.gameweek === gw.gameweek_number) || hasPick;
                      
                      return (
                        <TableCell key={gw.gameweek_number} className={`text-center ${cellPadding[viewDensity]}`}>
                          {pick && shouldShowPick && !isPending ? (
                            <div
                              className={`
                                ${viewDensity === 'compact' ? 'w-12 h-8 text-[10px]' : viewDensity === 'normal' ? 'w-14 h-10 text-xs' : 'w-16 h-12 text-sm'} 
                                rounded flex flex-col items-center justify-center font-bold mx-auto p-1
                                ${pick.result === 'win' ? 'bg-green-500 text-white' :
                                  pick.result === 'loss' ? 'bg-red-500 text-white' :
                                  pick.result === 'draw' ? 'bg-orange-500 text-white' :
                                  pick.fixtures?.is_completed ? 'bg-yellow-500 text-white' :
                                  'bg-gray-400 text-white'
                                }
                              `}
                              title={`${pick.picked_side === 'home' ? pick.fixtures?.home_team?.short_name : pick.fixtures?.away_team?.short_name} vs ${pick.opponent} - ${pick.result || 'Pending'}`}
                            >
                              <div className="font-semibold leading-tight truncate w-full text-center">
                                {pick.picked_side === 'home' ? pick.fixtures?.home_team?.short_name : pick.fixtures?.away_team?.short_name}
                              </div>
                              {viewDensity !== 'compact' && (
                                <div className="text-[10px] opacity-75 leading-tight truncate w-full text-center">
                                  vs {pick.opponent}
                                </div>
                              )}
                            </div>
                           ) : isPending || (isOpenGameweek && !user.isEliminated) ? (
                            <div
                              className={`
                                ${viewDensity === 'compact' ? 'w-12 h-8 text-[10px]' : viewDensity === 'normal' ? 'w-14 h-10 text-xs' : 'w-16 h-12 text-sm'} 
                                rounded flex items-center justify-center mx-auto p-1 border-2 border-dashed
                                ${userHasPick 
                                  ? 'border-green-300 bg-green-50 text-green-600'
                                  : 'border-orange-300 bg-orange-50 text-orange-600'
                                }
                              `}
                              title={userHasPick ? "Pick made - hidden until gameweek becomes active" : "Pick pending - deadline not passed yet"}
                            >
                              <div className="font-medium">
                                {viewDensity === 'compact' 
                                  ? (userHasPick ? '✓' : '⏳')
                                  : (userHasPick ? 'Picked' : 'Pending')
                                }
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">-</div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Navigation Hint */}
      <div className="text-xs text-muted-foreground text-center sm:hidden">
        Swipe horizontally to scroll • Use View settings to customize
      </div>
    </div>
  );
}