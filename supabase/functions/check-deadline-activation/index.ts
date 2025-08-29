import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { gameId } = await req.json();

    if (!gameId) {
      return new Response(
        JSON.stringify({ error: 'Game ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the game has any open gameweeks
    const { data: openGameweeks, error: gameweekError } = await supabase
      .from('game_gameweeks')
      .select('gameweek_number, status')
      .eq('game_id', gameId)
      .eq('status', 'open');

    if (gameweekError) {
      console.error('Error checking game gameweeks:', gameweekError);
      return new Response(
        JSON.stringify({ error: 'Failed to check game gameweeks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no open gameweeks, nothing to check
    if (!openGameweeks || openGameweeks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No open gameweeks to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the database function to activate any expired deadlines
    const { error: activateError } = await supabase.rpc('activate_gameweeks_past_deadline');

    if (activateError) {
      console.error('Error activating gameweeks:', activateError);
      return new Response(
        JSON.stringify({ error: 'Failed to activate gameweeks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Deadline check completed',
        checkedGameweeks: openGameweeks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-deadline-activation function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});