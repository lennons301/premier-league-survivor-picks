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
import { Upload, Trash2, Save, Download, FileText, Check } from "lucide-react";

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
  const [editingResults, setEditingResults] = useState<Record<string, { home: string; away: string }>>({});

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row
      const dataLines = lines.slice(1);
      
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
    };
    reader.readAsText(file);
    
    // Reset file input
    e.target.value = '';
  };

  const saveFixturesMutation = useMutation({
    mutationFn: async () => {
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
    },
    onSuccess: () => {
      toast({
        title: "Fixtures uploaded!",
        description: `${parsedFixtures.length} fixtures saved successfully.`,
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

  const updateResultMutation = useMutation({
    mutationFn: async ({ fixtureId, homeGoals, awayGoals }: { fixtureId: string; homeGoals: number; awayGoals: number }) => {
      const { error } = await supabase
        .from("cup_fixtures")
        .update({
          home_goals: homeGoals,
          away_goals: awayGoals,
        })
        .eq("id", fixtureId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Result saved!",
        description: "Fixture result updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["cup-fixtures", gameId] });
      setEditingResults(prev => {
        const { [variables.fixtureId]: _, ...rest } = prev;
        return rest;
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving result",
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

  const downloadTemplate = () => {
    let content = 'home_team,away_team,tier_difference\n';
    content += 'Manchester United,Liverpool,0\n';
    content += 'Arsenal,Bristol City,2\n';
    content += 'Plymouth,Chelsea,-2\n';
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'cup-fixtures-template.csv';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearParsed = () => {
    setParsedFixtures([]);
  };

  const handleResultChange = (fixtureId: string, field: 'home' | 'away', value: string) => {
    setEditingResults(prev => ({
      ...prev,
      [fixtureId]: {
        ...prev[fixtureId],
        [field]: value,
      }
    }));
  };

  const saveResult = (fixtureId: string) => {
    const result = editingResults[fixtureId];
    if (!result || result.home === '' || result.away === '') {
      toast({
        title: "Invalid result",
        description: "Both home and away scores are required",
        variant: "destructive",
      });
      return;
    }
    
    updateResultMutation.mutate({
      fixtureId,
      homeGoals: parseInt(result.home),
      awayGoals: parseInt(result.away),
    });
  };

  const startEditing = (fixture: CupFixture) => {
    if (fixture.id) {
      setEditingResults(prev => ({
        ...prev,
        [fixture.id!]: {
          home: fixture.home_goals?.toString() ?? '',
          away: fixture.away_goals?.toString() ?? '',
        }
      }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cup Fixtures & Results
        </CardTitle>
        <CardDescription>
          Upload fixtures via CSV. Enter results directly in the table below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template download and upload */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Fixtures Template
          </Button>
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
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* Existing fixtures with inline result editing */}
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
            <div className="max-h-96 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Away</TableHead>
                    <TableHead className="w-16">Tier</TableHead>
                    <TableHead className="w-40">Result</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingFixtures.map((fixture) => {
                    const isEditing = fixture.id && editingResults[fixture.id] !== undefined;
                    const hasResult = fixture.home_goals !== null && fixture.away_goals !== null;
                    
                    return (
                      <TableRow key={fixture.id}>
                        <TableCell className="text-xs">{fixture.fixture_order}</TableCell>
                        <TableCell className="text-xs">{fixture.home_team}</TableCell>
                        <TableCell className="text-xs">{fixture.away_team}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {fixture.tier_difference > 0 ? `+${fixture.tier_difference}` : fixture.tier_difference}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                className="w-12 h-7 text-xs text-center"
                                value={editingResults[fixture.id!]?.home ?? ''}
                                onChange={(e) => handleResultChange(fixture.id!, 'home', e.target.value)}
                              />
                              <span className="text-xs">-</span>
                              <Input
                                type="number"
                                min="0"
                                className="w-12 h-7 text-xs text-center"
                                value={editingResults[fixture.id!]?.away ?? ''}
                                onChange={(e) => handleResultChange(fixture.id!, 'away', e.target.value)}
                              />
                            </div>
                          ) : (
                            <span className="text-xs">
                              {hasResult ? `${fixture.home_goals} - ${fixture.away_goals}` : '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => saveResult(fixture.id!)}
                              disabled={updateResultMutation.isPending}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => startEditing(fixture)}
                            >
                              {hasResult ? 'Edit' : 'Add'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                Fixtures Preview ({parsedFixtures.length})
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
