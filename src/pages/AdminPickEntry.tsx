import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const AdminPickEntry = () => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const insertPick = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      
      // First insert the pick
      const { data, error } = await supabase.rpc('admin_insert_pick', {
        p_game_id: '15597efe-565a-44ce-8c6a-1644a22aa2bd', // LPS 3 2025
        p_user_id: 'db833f23-47b3-4dd9-8ce1-0791db5ce062', // Sarit
        p_fixture_id: '4cda57b8-c611-4c2b-8775-9df8ed6c9ed3', // Crystal Palace vs Man City
        p_team_id: 'a1f16a7a-6548-4df5-9cd5-045a9ab0c979', // Man City
        p_picked_side: 'away',
        p_gameweek: 16
      });
      
      if (error) throw error;
      
      // Then update the pick with result and goals_scored
      const { error: updateError } = await supabase
        .from('picks')
        .update({ result: 'win', goals_scored: 3 })
        .eq('id', data);
      
      if (updateError) throw updateError;
      
      return data;
    },
    onSuccess: () => {
      toast.success("Pick inserted successfully for Sarit with Man City win (3 goals)!");
      setIsSubmitting(false);
    },
    onError: (error: any) => {
      console.error("Error inserting pick:", error);
      toast.error(`Failed to insert pick: ${error.message || 'Unknown error'}`);
      setIsSubmitting(false);
    }
  });

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Admin Pick Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p><strong>Game:</strong> LPS 3 2025</p>
            <p><strong>User:</strong> Sarit</p>
            <p><strong>Gameweek:</strong> 16</p>
            <p><strong>Pick:</strong> Man City (Away) vs Crystal Palace</p>
            <p><strong>Result:</strong> Win with 3 goals</p>
          </div>
          
          <Button 
            onClick={() => insertPick.mutate()}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Inserting Pick..." : "Insert Pick for Sarit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPickEntry;