import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFPLSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const syncFPLData = async () => {
    // Check if sync was done recently (within last 5 minutes)
    const lastSync = localStorage.getItem('fpl_last_sync');
    const now = Date.now();
    
    if (lastSync && (now - parseInt(lastSync)) < 5 * 60 * 1000) {
      console.log('Skipping sync - done recently');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-fpl-data');
      
      if (error) {
        console.error('Error syncing FPL data:', error);
        toast({
          title: "Sync Error",
          description: "Failed to sync FPL data. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.success) {
        localStorage.setItem('fpl_last_sync', now.toString());
        console.log('FPL data synced successfully:', data.synced);
        
        toast({
          title: "Data Updated",
          description: `Synced ${data.synced.teams} teams, ${data.synced.gameweeks} gameweeks, and ${data.synced.fixtures} fixtures.`,
        });
      }
    } catch (error) {
      console.error('Error calling sync function:', error);
      toast({
        title: "Sync Error", 
        description: "Failed to sync FPL data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    syncFPLData,
    isLoading
  };
};