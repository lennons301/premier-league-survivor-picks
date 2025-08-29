import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useDeadlineCheck = () => {
  const [isLoading, setIsLoading] = useState(false);

  const checkDeadlines = useCallback(async (gameId: string) => {
    // Check if deadline check was done recently (within last 5 minutes)
    const lastCheck = localStorage.getItem('deadline_last_check');
    const now = Date.now();
    
    if (lastCheck && (now - parseInt(lastCheck)) < 5 * 60 * 1000) {
      console.log('Skipping deadline check - done recently');
      return;
    }

    // Check if deadline check is already in progress
    const checkInProgress = localStorage.getItem('deadline_check_in_progress');
    if (checkInProgress) {
      console.log('Skipping deadline check - already in progress');
      return;
    }

    setIsLoading(true);
    localStorage.setItem('deadline_check_in_progress', 'true');
    
    try {
      const { data, error } = await supabase.functions.invoke('check-deadline-activation', {
        body: { gameId }
      });
      
      if (error) {
        console.error('Error checking deadlines:', error);
        return;
      }

      if (data?.success) {
        localStorage.setItem('deadline_last_check', now.toString());
        console.log('Deadline check completed:', data.message);
      }
    } catch (error) {
      console.error('Error calling deadline check function:', error);
    } finally {
      setIsLoading(false);
      localStorage.removeItem('deadline_check_in_progress');
    }
  }, []);

  return {
    checkDeadlines,
    isLoading
  };
};