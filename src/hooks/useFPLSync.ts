import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFPLSync = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const syncFPLData = useCallback(async () => {
    // Check if sync was done recently (within last 5 minutes)
    const lastSync = localStorage.getItem('fpl_last_sync');
    const now = Date.now();
    
    if (lastSync && (now - parseInt(lastSync)) < 5 * 60 * 1000) {
      console.log('Skipping sync - done recently');
      return;
    }

    // Check if sync is already in progress
    const syncInProgress = localStorage.getItem('fpl_sync_in_progress');
    if (syncInProgress) {
      console.log('Skipping sync - already in progress');
      return;
    }

    setIsLoading(true);
    localStorage.setItem('fpl_sync_in_progress', 'true');
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-fpl-data');
      
      if (error) {
        console.error('Error syncing FPL data:', error);
        const errorMessage = error.message || error.toString();
        
        if (errorMessage.includes('rate limit')) {
          toast({
            title: "Rate Limit Exceeded",
            description: "FPL API is busy. Data will sync automatically when available.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sync Error",
            description: "Failed to sync FPL data. Please try again later.",
            variant: "destructive",
          });
        }
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
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes('rate limit')) {
        toast({
          title: "Rate Limit Exceeded", 
          description: "FPL API is busy. Data will sync automatically when available.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sync Error", 
          description: "Failed to sync FPL data. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      localStorage.removeItem('fpl_sync_in_progress');
    }
  }, [toast]);

  return {
    syncFPLData,
    isLoading
  };
};