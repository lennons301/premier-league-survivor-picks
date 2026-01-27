import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useFPLSync = () => {
  const [isLoading, setIsLoading] = useState(false);

  const syncFPLData = useCallback(async () => {
    // Check if sync is already in progress (prevents concurrent calls)
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
        console.error('FPL sync error:', error.message || error);
        return;
      }

      if (data?.success) {
        console.log('FPL data synced successfully:', data.synced);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('FPL sync failed:', errorMessage);
    } finally {
      setIsLoading(false);
      localStorage.removeItem('fpl_sync_in_progress');
    }
  }, []);

  return {
    syncFPLData,
    isLoading
  };
};