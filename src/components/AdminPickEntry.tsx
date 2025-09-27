import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AdminPickEntryProps {
  gameId: string;
  gameName: string;
}

export const AdminPickEntry = ({ gameId, gameName }: AdminPickEntryProps) => {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedFixture, setSelectedFixture] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedSide, setSelectedSide] = useState<string>("");
  const [gameweek, setGameweek] = useState<number>(6);

  // Get users without picks for the gameweek
  const { data: usersWithoutPicks } = useQuery({
    queryKey: ['users-without-picks', gameId, gameweek],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_users_without_picks', {
        p_game_id: gameId,
        p_gameweek: gameweek
      });
      if (error) throw error;
      return data;
    }
  });

  // Get fixtures for the gameweek
  const { data: fixtures } = useQuery({
    queryKey: ['fixtures', gameweek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixtures')
        .select(`
          *,
          home_team:teams!fixtures_home_team_id_fkey(id, name, short_name),
          away_team:teams!fixtures_away_team_id_fkey(id, name, short_name)
        `)
        .eq('gameweek', gameweek)
        .order('kickoff_time');
      if (error) throw error;
      return data;
    }
  });

  const insertPickMutation = useMutation({
    mutationFn: async () => {
      const fixture = fixtures?.find(f => f.id === selectedFixture);
      const teamId = selectedSide === 'home' ? fixture?.home_team_id : fixture?.away_team_id;
      
      const { data, error } = await supabase.rpc('admin_insert_pick', {
        p_game_id: gameId,
        p_user_id: selectedUser,
        p_fixture_id: selectedFixture,
        p_team_id: teamId,
        p_picked_side: selectedSide,
        p_gameweek: gameweek
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Pick inserted successfully!");
      setSelectedUser("");
      setSelectedFixture("");
      setSelectedTeam("");
      setSelectedSide("");
    },
    onError: (error) => {
      console.error("Error inserting pick:", error);
      toast.error("Failed to insert pick");
    }
  });

  const selectedFixtureData = fixtures?.find(f => f.id === selectedFixture);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Admin Pick Entry - {gameName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="gameweek">Gameweek</Label>
          <Input
            id="gameweek"
            type="number"
            value={gameweek}
            onChange={(e) => setGameweek(Number(e.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="user">User Without Pick</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {usersWithoutPicks?.map((user: any) => (
                <SelectItem key={user.user_id} value={user.user_id}>
                  {user.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="fixture">Fixture</Label>
          <Select value={selectedFixture} onValueChange={setSelectedFixture}>
            <SelectTrigger>
              <SelectValue placeholder="Select fixture" />
            </SelectTrigger>
            <SelectContent>
              {fixtures?.map((fixture) => (
                <SelectItem key={fixture.id} value={fixture.id}>
                  {fixture.home_team?.name} vs {fixture.away_team?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedFixtureData && (
          <div>
            <Label htmlFor="side">Pick Side</Label>
            <Select value={selectedSide} onValueChange={setSelectedSide}>
              <SelectTrigger>
                <SelectValue placeholder="Select side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">
                  {selectedFixtureData.home_team?.name} (Home)
                </SelectItem>
                <SelectItem value="away">
                  {selectedFixtureData.away_team?.name} (Away)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button 
          onClick={() => insertPickMutation.mutate()}
          disabled={!selectedUser || !selectedFixture || !selectedSide || insertPickMutation.isPending}
          className="w-full"
        >
          {insertPickMutation.isPending ? "Inserting..." : "Insert Pick"}
        </Button>
      </CardContent>
    </Card>
  );
};