import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Max time a sync lock can be held before we consider it stale (30 seconds)
const SYNC_LOCK_TIMEOUT_MS = 30 * 1000;

export const useFPLSync = () => {
  const [isLoading, setIsLoading] = useState(false);

  const syncFPLData = useCallback(async () => {
    // Check if sync is already in progress (prevents concurrent calls)
    const syncStartTime = localStorage.getItem('fpl_sync_in_progress');
    if (syncStartTime) {
      const elapsed = Date.now() - parseInt(syncStartTime, 10);
      if (elapsed < SYNC_LOCK_TIMEOUT_MS) {
        console.log('Skipping sync - already in progress');
        return;
      }
      // Lock is stale, clear it and proceed
      console.log('Clearing stale sync lock');
      localStorage.removeItem('fpl_sync_in_progress');
    }

    setIsLoading(true);
    localStorage.setItem('fpl_sync_in_progress', Date.now().toString());
    
    try {
      console.log('Starting FPL data sync...');
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