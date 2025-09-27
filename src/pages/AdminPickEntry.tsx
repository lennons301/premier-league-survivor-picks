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

  const insertMitchellPick = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      
      const { data, error } = await supabase.rpc('admin_insert_pick', {
        p_game_id: '1dfdb11d-8436-4285-aa3d-c2f1d547ea12', // LPS 2 2025
        p_user_id: '6f708bc7-87ca-4f08-b25b-5e30bc2bc686', // Mitchell Conroy
        p_fixture_id: 'f72a6a51-b31e-4edf-b14f-944fe3551d00', // Spurs vs Wolves
        p_team_id: '3e9f27a7-7008-4f89-94ec-3b6e36ab0372', // Spurs
        p_picked_side: 'home',
        p_gameweek: 6
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Pick inserted successfully for Mitchell Conroy!");
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
            <p><strong>Game:</strong> LPS 2 2025</p>
            <p><strong>User:</strong> Mitchell Conroy</p>
            <p><strong>Gameweek:</strong> 6</p>
            <p><strong>Pick:</strong> Tottenham (Home) vs Wolves</p>
          </div>
          
          <Button 
            onClick={() => insertMitchellPick.mutate()}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Inserting Pick..." : "Insert Pick for Mitchell"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPickEntry;