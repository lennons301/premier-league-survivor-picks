import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Target, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Settings, 
  Search,
  Eye,
  EyeOff,
  RotateCcw
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import html2canvas from "html2canvas";
import { toast } from "@/hooks/use-toast";
import { Download, Copy } from "lucide-react";

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

type ViewDensity = 'compact' | 'normal';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'eliminated' | 'picked' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDensity, setViewDensity] = useState<ViewDensity>('normal');
  const [visibleGameweeks, setVisibleGameweeks] = useState<Set<number>>(new Set());
  const [gameweekRange, setGameweekRange] = useState<[number, number]>([1, currentGameweek]);
  
  const tableRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
    
    // Apply status and pick status filters
    if (statusFilter === 'active') {
      filtered = filtered.filter(user => !user.isEliminated);
    } else if (statusFilter === 'eliminated') {
      filtered = filtered.filter(user => user.isEliminated);
    } else if (statusFilter === 'picked' || statusFilter === 'pending') {
      // Filter by pick status for current gameweek
      filtered = filtered.filter(user => {
        const pick = user.gameweekData[currentGameweek];
        const userHasPick = allPicks?.some(p => p.user_id === user.userId && p.gameweek === currentGameweek) || (!!pick && !pick.isPending);
        return statusFilter === 'picked' ? userHasPick : !userHasPick;
      });
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
  }, [pivotData, sortBy, sortOrder, statusFilter, searchQuery, currentGameweek, allPicks]);

  // Get visible gameweeks in range
  const visibleGameweeksInRange = useMemo(() => {
    return gameGameweeks
      .filter(gw => 
        gw.gameweek_number <= currentGameweek &&
        gw.gameweek_number >= gameweekRange[0] &&
        gw.gameweek_number <= gameweekRange[1] &&
        visibleGameweeks.has(gw.gameweek_number)
      )
      .sort((a, b) => a.gameweek_number - b.gameweek_number);
  }, [gameGameweeks, currentGameweek, gameweekRange, visibleGameweeks]);

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
    setSearchQuery('');
    setStatusFilter('all');
  };

  const exportToPNG = async () => {
    if (!exportRef.current) return;

    try {
      toast({
        title: "Generating export...",
        description: "Please wait while we create your PNG export.",
      });

      // Create a temporary container with all filtered data
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.background = 'white';
      tempContainer.style.padding = '20px';
      tempContainer.style.fontSize = '14px';
      tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      
      // Add title
      const title = document.createElement('h3');
      title.textContent = 'Player Progress';
      title.style.fontSize = '18px';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '16px';
      title.style.color = '#000';
      tempContainer.appendChild(title);

      // Create table
      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.border = '1px solid #e2e8f0';

      // Create header
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.style.backgroundColor = '#f8fafc';

        // Add header cells
        ['Player', 'Goals', ...visibleGameweeksInRange.map(gw => `GW${gw.gameweek_number}`)].forEach(text => {
          const th = document.createElement('th');
          th.textContent = text;
          th.style.border = '1px solid #e2e8f0';
          th.style.padding = '8px';
          th.style.textAlign = 'left';
          th.style.fontWeight = 'bold';
          th.style.fontSize = '12px';
          headerRow.appendChild(th);
        });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Create body
      const tbody = document.createElement('tbody');
      filteredAndSortedData.forEach(user => {
        const row = document.createElement('tr');
        
        // Color code the row based on status
        if (user.isEliminated) {
          row.style.backgroundColor = '#fef2f2';
          row.style.color = '#dc2626';
        } else {
          row.style.backgroundColor = '#f0fdf4';
          row.style.color = '#16a34a';
        }

        // Player name
        const nameCell = document.createElement('td');
        nameCell.textContent = user.isEliminated 
          ? `${user.displayName} (Eliminated GW${user.eliminatedGameweek})`
          : user.displayName;
        nameCell.style.border = '1px solid #e2e8f0';
        nameCell.style.padding = '4px 6px';
        nameCell.style.fontWeight = '500';
        nameCell.style.verticalAlign = 'middle';
        row.appendChild(nameCell);

        // Total goals
        const totalCell = document.createElement('td');
        totalCell.textContent = user.totalGoals.toString();
        totalCell.style.border = '1px solid #e2e8f0';
        totalCell.style.padding = '4px 6px';
        totalCell.style.textAlign = 'center';
        totalCell.style.fontWeight = 'bold';
        totalCell.style.verticalAlign = 'middle';
        row.appendChild(totalCell);

        // Gameweek cells
        visibleGameweeksInRange.forEach(gw => {
          const gwCell = document.createElement('td');
          const pick = user.gameweekData[gw.gameweek_number];
          const isCurrentGameweek = gw.gameweek_number === currentGameweek;
          const shouldShowPick = !isCurrentGameweek || gameGameweek?.picks_visible;
          const isOpenGameweek = gw.status === 'open';
          const hasPick = !!pick && !pick.isPending;
          const isPending = pick?.isPending;
          
          // Check if user has made a pick for this gameweek
          const userHasPick = allPicks?.some(p => p.user_id === user.userId && p.gameweek === gw.gameweek_number) || hasPick;
          
          if (pick && shouldShowPick && !isPending && !isOpenGameweek) {
            // Show actual team name for active/completed gameweeks
            const teamName = pick.picked_side === 'home' 
              ? pick.fixtures?.home_team?.short_name 
              : pick.fixtures?.away_team?.short_name;
            gwCell.textContent = teamName || '';
            
            // Use the same color scheme as the table
            if (pick.result === 'win') {
              gwCell.style.backgroundColor = '#22c55e'; // bg-green-500
              gwCell.style.color = '#ffffff';
            } else if (pick.result === 'loss') {
              gwCell.style.backgroundColor = '#ef4444'; // bg-red-500
              gwCell.style.color = '#ffffff';
            } else if (pick.result === 'draw') {
              gwCell.style.backgroundColor = '#f97316'; // bg-orange-500
              gwCell.style.color = '#ffffff';
            } else if (pick.fixtures?.is_completed) {
              gwCell.style.backgroundColor = '#eab308'; // bg-yellow-500
              gwCell.style.color = '#ffffff';
            } else {
              gwCell.style.backgroundColor = '#9ca3af'; // bg-gray-400
              gwCell.style.color = '#ffffff';
            }
            gwCell.style.fontWeight = 'bold';
          } else if ((isPending || (isOpenGameweek && !user.isEliminated)) && userHasPick) {
            // Show "Picked" status for open gameweeks
            gwCell.textContent = 'Picked';
            gwCell.style.backgroundColor = '#dcfce7'; // bg-green-50
            gwCell.style.color = '#16a34a'; // text-green-600
            gwCell.style.fontWeight = '500';
          } else if ((isPending || (isOpenGameweek && !user.isEliminated)) && !userHasPick) {
            // Show "Pending" status for open gameweeks
            gwCell.textContent = 'Pending';
            gwCell.style.backgroundColor = '#fff7ed'; // bg-orange-50
            gwCell.style.color = '#ea580c'; // text-orange-600
            gwCell.style.fontWeight = '500';
          } else {
            // Show dash for no pick
            gwCell.textContent = '-';
            gwCell.style.color = '#9ca3af';
          }
          
          gwCell.style.border = '1px solid #e2e8f0';
          gwCell.style.padding = '3px 4px';
          gwCell.style.textAlign = 'center';
          gwCell.style.verticalAlign = 'middle';
          gwCell.style.fontSize = '11px';
          row.appendChild(gwCell);
        });

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tempContainer.appendChild(table);

      // Add summary
      const summary = document.createElement('p');
      summary.textContent = `Showing ${filteredAndSortedData.length} of ${pivotData.length} players • ${visibleGameweeksInRange.length} gameweeks visible`;
      summary.style.marginTop = '16px';
      summary.style.fontSize = '12px';
      summary.style.color = '#64748b';
      tempContainer.appendChild(summary);

      document.body.appendChild(tempContainer);

      // Generate canvas
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: tempContainer.scrollWidth,
        height: tempContainer.scrollHeight
      });

      // Clean up
      document.body.removeChild(tempContainer);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        if (isMobile && navigator.clipboard && window.ClipboardItem) {
          // Try to copy to clipboard on mobile
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            toast({
              title: "Export copied to clipboard!",
              description: "The player standings have been copied to your clipboard.",
            });
          } catch (clipboardError) {
            // Fallback to download if clipboard fails
            downloadBlob(blob);
          }
        } else {
          // Download on desktop or if clipboard not supported
          downloadBlob(blob);
        }
      }, 'image/png');

    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "There was an error generating the export. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `player-standings-${new Date().toISOString().split('T')[0]}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export downloaded!",
      description: "The player standings have been downloaded as a PNG file.",
    });
  };

  // Density classes
  const densityClasses = {
    compact: "text-xs",
    normal: "text-sm"
  };

  const cellPadding = {
    compact: "p-1",
    normal: "p-2"
  };

  const availableGameweeks = gameGameweeks
    .filter(gw => gw.gameweek_number <= currentGameweek)
    .map(gw => gw.gameweek_number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex flex-col gap-2 sm:gap-4">
        {/* Controls */}
        <div className="flex gap-1 sm:gap-2 items-center w-full">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-full sm:w-32 text-xs sm:text-sm"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'eliminated' | 'picked' | 'pending') => setStatusFilter(value)}>
            <SelectTrigger className="w-16 sm:w-28 text-xs sm:text-sm px-1 sm:px-3">
              <Filter className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
              <span className="hidden sm:inline">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="eliminated">Eliminated</SelectItem>
              <SelectItem value="picked">Picked (GW{currentGameweek})</SelectItem>
              <SelectItem value="pending">Pending (GW{currentGameweek})</SelectItem>
            </SelectContent>
          </Select>

          {/* Export Button */}
          <Button variant="outline" size="sm" onClick={exportToPNG} className="px-2 sm:px-3">
            {isMobile ? <Copy className="h-4 w-4" /> : <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>}
          </Button>

          {/* View Settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="px-2 sm:px-3">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">View</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-4">
              {/* View Density */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">View Density</Label>
                <div className="flex gap-2">
                  {(['compact', 'normal'] as ViewDensity[]).map((density) => (
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

              {/* Gameweek Range */}
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

              {/* Individual Gameweek Toggles */}
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
        <span>• {visibleGameweeksInRange.length} gameweeks visible</span>
      </div>

      {/* Table Container - Mobile Optimized */}
      <Card>
        <CardContent className="p-0">
          <div 
            ref={exportRef}
            className="overflow-x-auto overflow-y-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
            style={{ 
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="min-w-max">
              <Table className={`${densityClasses[viewDensity]} w-full`}>
                <TableHeader>
                  <TableRow>
                    {/* Player Name - Sticky */}
                    <TableHead 
                      className={`sticky left-0 bg-background cursor-pointer hover:bg-muted/50 z-20 border-r ${
                        isMobile ? 'min-w-[100px] max-w-[120px] text-xs p-1' : 'min-w-[140px] max-w-[180px] p-2'
                      }`}
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Player
                        {sortBy === 'name' && (
                          sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        )}
                      </div>
                    </TableHead>

                    {/* Total Goals - Sticky */}
                    <TableHead 
                      className={`sticky ${isMobile ? 'left-[100px]' : 'left-[140px]'} bg-background cursor-pointer hover:bg-muted/50 z-20 border-r text-right ${
                        isMobile ? 'min-w-[60px] max-w-[80px] text-xs p-1' : 'min-w-[100px] max-w-[120px] p-2'
                      }`}
                      onClick={() => handleSort('total')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {isMobile ? 'Goals' : 'Total Goals'}
                        {sortBy === 'total' && (
                          sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        )}
                      </div>
                    </TableHead>

                    {/* Gameweek Columns */}
                    {visibleGameweeksInRange.map(gw => (
                      <TableHead 
                        key={gw.gameweek_number} 
                        className={`text-center cursor-pointer hover:bg-muted/50 ${
                          isMobile ? 'min-w-[45px] max-w-[55px] text-xs p-1' : 'min-w-[60px] max-w-[80px] p-2'
                        }`}
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
                    <TableRow 
                      key={user.userId} 
                      className={`border-l-4 ${
                        user.isEliminated 
                          ? "bg-red-50/50 hover:bg-red-100/50 border-l-red-500" 
                          : "bg-green-50/50 hover:bg-green-100/50 border-l-green-500"
                      }`}
                    >
                      {/* Player Name */}
                      <TableCell 
                        className={`sticky left-0 bg-inherit font-medium z-10 border-r align-middle ${
                          isMobile ? 'p-1 text-xs' : 'p-2'
                        } ${user.isEliminated ? 'text-red-700' : 'text-green-700'}`}
                      >
                        <div className="truncate" title={user.displayName}>
                          {user.displayName}
                        </div>
                        {user.isEliminated && isMobile && (
                          <div className="text-xs text-red-600 opacity-75">
                            GW{user.eliminatedGameweek}
                          </div>
                        )}
                      </TableCell>

                      {/* Total Goals */}
                      <TableCell 
                        className={`sticky ${isMobile ? 'left-[100px]' : 'left-[140px]'} bg-inherit text-center z-10 border-r align-middle ${
                          isMobile ? 'p-1 text-xs' : 'p-2'
                        } ${user.isEliminated ? 'text-red-700' : 'text-green-700'}`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-bold ${isMobile ? 'text-sm' : 'text-lg'}`}>
                            {user.totalGoals}
                          </span>
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
                                 ${viewDensity === 'compact' ? 'w-12 h-8 text-[10px]' : 'w-14 h-10 text-xs'} 
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
                                ${viewDensity === 'compact' ? 'w-12 h-8 text-[10px]' : 'w-14 h-10 text-xs'} 
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