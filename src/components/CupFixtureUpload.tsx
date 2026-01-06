import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Save, Download, FileText } from "lucide-react";

interface CupFixture {
  id?: string;
  home_team: string;
  away_team: string;
  tier_difference: number;
  home_goals: number | null;
  away_goals: number | null;
  fixture_order: number;
}

interface CupFixtureUploadProps {
  gameId: string;
}

export default function CupFixtureUpload({ gameId }: CupFixtureUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parsedFixtures, setParsedFixtures] = useState<CupFixture[]>([]);
  const [isResultsMode, setIsResultsMode] = useState(false);

  // Fetch existing fixtures
  const { data: existingFixtures } = useQuery({
    queryKey: ["cup-fixtures", gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cup_fixtures")
        .select("*")
        .eq("game_id", gameId)
        .order("fixture_order");
      if (error) throw error;
      return data as CupFixture[];
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, mode: 'fixtures' | 'results') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      if (mode === 'fixtures') {
        const fixtures: CupFixture[] = dataLines.map((line, index) => {
          const [home_team, away_team, tier_diff] = line.split(',').map(s => s.trim());
          return {
            home_team: home_team || '',
            away_team: away_team || '',
            tier_difference: parseInt(tier_diff) || 0,
            home_goals: null,
            away_goals: null,
            fixture_order: index + 1,
          };
        }).filter(f => f.home_team && f.away_team);
        
        setParsedFixtures(fixtures);
        setIsResultsMode(false);
      } else {
        // Results mode - update existing fixtures
        if (!existingFixtures?.length) {
          toast({
            title: "No fixtures to update",
            description: "Upload fixtures first before adding results",
            variant: "destructive",
          });
          return;
        }
        
        const updatedFixtures = existingFixtures.map(fixture => {
          const resultLine = dataLines.find(line => {
            const [home, away] = line.split(',').map(s => s.trim().toLowerCase());
            return home === fixture.home_team.toLowerCase() || 
                   away === fixture.away_team.toLowerCase();
          });
          
          if (resultLine) {
            const parts = resultLine.split(',').map(s => s.trim());
            const homeGoals = parts[3] !== '' ? parseInt(parts[3]) : null;
            const awayGoals = parts[4] !== '' ? parseInt(parts[4]) : null;
            return { ...fixture, home_goals: homeGoals, away_goals: awayGoals };
          }
          return fixture;
        });
        
        setParsedFixtures(updatedFixtures);
        setIsResultsMode(true);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    e.target.value = '';
  };

  const saveFixturesMutation = useMutation({
    mutationFn: async () => {
      if (isResultsMode) {
        // Update existing fixtures with results
        for (const fixture of parsedFixtures) {
          if (fixture.id) {
            const { error } = await supabase
              .from("cup_fixtures")
              .update({
                home_goals: fixture.home_goals,
                away_goals: fixture.away_goals,
              })
              .eq("id", fixture.id);
            if (error) throw error;
          }
        }
      } else {
        // Delete existing and insert new
        await supabase
          .from("cup_fixtures")
          .delete()
          .eq("game_id", gameId);
        
        const { error } = await supabase
          .from("cup_fixtures")
          .insert(parsedFixtures.map(f => ({
            game_id: gameId,
            home_team: f.home_team,
            away_team: f.away_team,
            tier_difference: f.tier_difference,
            home_goals: f.home_goals,
            away_goals: f.away_goals,
            fixture_order: f.fixture_order,
          })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: isResultsMode ? "Results updated!" : "Fixtures uploaded!",
        description: `${parsedFixtures.length} fixtures ${isResultsMode ? 'updated' : 'saved'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["cup-fixtures", gameId] });
      setParsedFixtures([]);
    },
    onError: (error) => {
      toast({
        title: "Error saving fixtures",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processResultsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('process_cup_results', { p_game_id: gameId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Results processed!",
        description: "Player picks, lives, and streaks have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["cup-picks", gameId] });
      queryClient.invalidateQueries({ queryKey: ["game-players", gameId] });
    },
    onError: (error) => {
      toast({
        title: "Error processing results",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadTemplate = (type: 'fixtures' | 'results') => {
    let content: string;
    if (type === 'fixtures') {
      content = 'home_team,away_team,tier_difference\n';
      content += 'Manchester United,Liverpool,0\n';
      content += 'Arsenal,Bristol City,2\n';
      content += 'Plymouth,Chelsea,-2\n';
    } else {
      content = 'home_team,away_team,tier_difference,home_goals,away_goals\n';
      if (existingFixtures?.length) {
        existingFixtures.forEach(f => {
          content += `${f.home_team},${f.away_team},${f.tier_difference},${f.home_goals ?? ''},${f.away_goals ?? ''}\n`;
        });
      }
    }
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = type === 'fixtures' ? 'cup-fixtures-template.csv' : 'cup-results.csv';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearParsed = () => {
    setParsedFixtures([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cup Fixtures & Results
        </CardTitle>
        <CardDescription>
          Upload fixtures via CSV. Format: home_team, away_team, tier_difference
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template downloads */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate('fixtures')}>
            <Download className="h-4 w-4 mr-2" />
            Fixtures Template
          </Button>
          {existingFixtures && existingFixtures.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('results')}>
              <Download className="h-4 w-4 mr-2" />
              Results Template
            </Button>
          )}
        </div>

        {/* Upload buttons */}
        <div className="flex gap-2 flex-wrap">
          <div>
            <Label htmlFor="fixture-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm">
                <Upload className="h-4 w-4" />
                Upload Fixtures
              </div>
            </Label>
            <Input
              id="fixture-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileUpload(e, 'fixtures')}
            />
          </div>
          
          {existingFixtures && existingFixtures.length > 0 && (
            <div>
              <Label htmlFor="results-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 text-sm">
                  <Upload className="h-4 w-4" />
                  Upload Results
                </div>
              </Label>
              <Input
                id="results-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'results')}
              />
            </div>
          )}
        </div>

        {/* Existing fixtures display */}
        {existingFixtures && existingFixtures.length > 0 && parsedFixtures.length === 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Current Fixtures ({existingFixtures.length})</h4>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => processResultsMutation.mutate()}
                disabled={processResultsMutation.isPending}
              >
                Process Results
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Away</TableHead>
                    <TableHead className="w-16">Tier</TableHead>
                    <TableHead className="w-20">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingFixtures.map((fixture) => (
                    <TableRow key={fixture.id}>
                      <TableCell className="text-xs">{fixture.fixture_order}</TableCell>
                      <TableCell className="text-xs">{fixture.home_team}</TableCell>
                      <TableCell className="text-xs">{fixture.away_team}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {fixture.tier_difference > 0 ? `+${fixture.tier_difference}` : fixture.tier_difference}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {fixture.home_goals !== null && fixture.away_goals !== null 
                          ? `${fixture.home_goals} - ${fixture.away_goals}`
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Parsed fixtures preview */}
        {parsedFixtures.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">
                {isResultsMode ? 'Results Preview' : 'Fixtures Preview'} ({parsedFixtures.length})
              </h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearParsed}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => saveFixturesMutation.mutate()}
                  disabled={saveFixturesMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveFixturesMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Away</TableHead>
                    <TableHead className="w-16">Tier</TableHead>
                    {isResultsMode && <TableHead className="w-20">Result</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedFixtures.map((fixture, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs">{fixture.fixture_order}</TableCell>
                      <TableCell className="text-xs">{fixture.home_team}</TableCell>
                      <TableCell className="text-xs">{fixture.away_team}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {fixture.tier_difference > 0 ? `+${fixture.tier_difference}` : fixture.tier_difference}
                        </Badge>
                      </TableCell>
                      {isResultsMode && (
                        <TableCell className="text-xs">
                          {fixture.home_goals !== null && fixture.away_goals !== null 
                            ? `${fixture.home_goals} - ${fixture.away_goals}`
                            : '-'
                          }
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}