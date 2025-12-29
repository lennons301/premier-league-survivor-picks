import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FPLBootstrapResponse {
  events: Array<{
    id: number
    name: string
    deadline_time: string
    finished: boolean
    data_checked: boolean
    is_previous: boolean
    is_current: boolean
    is_next: boolean
    average_entry_score?: number
    highest_score?: number
    highest_scoring_entry?: number
  }>
  teams: Array<{
    id: number
    name: string
    short_name: string
    code: number
    strength_overall_home: number
    strength_overall_away: number
    strength_attack_home: number
    strength_attack_away: number
    strength_defence_home: number
    strength_defence_away: number
    pulse_id: number
  }>
}

interface FPLFixture {
  id: number
  code: number
  event: number
  finished: boolean
  finished_provisional: boolean
  kickoff_time: string
  minutes: number
  provisional_start_time: boolean
  started: boolean
  team_a: number
  team_a_score: number | null
  team_h: number
  team_h_score: number | null
  team_h_difficulty: number
  team_a_difficulty: number
  pulse_id: number
  stats: any[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting FPL data sync...')

    // Fetch bootstrap data (gameweeks and teams)
    console.log('Fetching bootstrap data...')
    const bootstrapResponse = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!bootstrapResponse.ok) {
      if (bootstrapResponse.status === 403) {
        throw new Error('FPL API rate limit exceeded. Please try again in a few minutes.')
      }
      throw new Error(`Bootstrap API error: ${bootstrapResponse.status}`)
    }

    const bootstrapData: FPLBootstrapResponse = await bootstrapResponse.json()

    // Sync teams
    console.log(`Syncing ${bootstrapData.teams.length} teams...`)
    for (const team of bootstrapData.teams) {
      const { error } = await supabase.rpc('sync_team_with_fpl', {
        p_fpl_team_id: team.id,
        p_name: team.name,
        p_short_name: team.short_name,
        p_code: team.code,
        p_strength_overall_home: team.strength_overall_home,
        p_strength_overall_away: team.strength_overall_away,
        p_strength_attack_home: team.strength_attack_home,
        p_strength_attack_away: team.strength_attack_away,
        p_strength_defence_home: team.strength_defence_home,
        p_strength_defence_away: team.strength_defence_away,
        p_pulse_id: team.pulse_id
      })

      if (error) {
        console.error('Error syncing team:', team.id, error)
      }
    }

    // Sync gameweeks
    console.log(`Syncing ${bootstrapData.events.length} gameweeks...`)
    for (const event of bootstrapData.events) {
      const { error } = await supabase.rpc('sync_gameweek_with_fpl', {
        p_fpl_event_id: event.id,
        p_name: event.name,
        p_deadline_time: event.deadline_time,
        p_finished: event.finished,
        p_data_checked: event.data_checked,
        p_is_previous: event.is_previous,
        p_is_current: event.is_current,
        p_is_next: event.is_next,
        p_average_entry_score: event.average_entry_score || null,
        p_highest_score: event.highest_score || null,
        p_highest_scoring_entry: event.highest_scoring_entry || null
      })

      if (error) {
        console.error('Error syncing gameweek:', event.id, error)
      }
    }

    // Fetch fixtures
    console.log('Fetching fixtures...')
    const fixturesResponse = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!fixturesResponse.ok) {
      if (fixturesResponse.status === 403) {
        throw new Error('FPL API rate limit exceeded. Please try again in a few minutes.')
      }
      throw new Error(`Fixtures API error: ${fixturesResponse.status}`)
    }

    const fixturesData: FPLFixture[] = await fixturesResponse.json()

    // Sync fixtures
    console.log(`Syncing ${fixturesData.length} fixtures...`)
    for (const fixture of fixturesData) {
      const { error } = await supabase.rpc('sync_fixture_with_fpl', {
        p_fpl_fixture_id: fixture.id,
        p_code: fixture.code,
        p_event: fixture.event,
        p_finished: fixture.finished,
        p_finished_provisional: fixture.finished_provisional,
        p_kickoff_time: fixture.kickoff_time,
        p_minutes: fixture.minutes,
        p_provisional_start_time: fixture.provisional_start_time,
        p_started: fixture.started,
        p_team_a: fixture.team_a,
        p_team_a_score: fixture.team_a_score || 0,
        p_team_h: fixture.team_h,
        p_team_h_score: fixture.team_h_score || 0,
        p_team_h_difficulty: fixture.team_h_difficulty,
        p_team_a_difficulty: fixture.team_a_difficulty,
        p_pulse_id: fixture.pulse_id,
        p_stats: fixture.stats || []
      })

      if (error) {
        console.error('Error syncing fixture:', fixture.id, error)
      }
    }

    // Check and finish Turbo games for any gameweeks that are complete
    console.log('Checking Turbo games for completion...')
    const completedGameweeks = new Set<number>()
    
    // Find gameweeks where all fixtures are complete
    for (const event of bootstrapData.events) {
      if (event.finished) {
        completedGameweeks.add(event.id)
      }
    }
    
    // Also check for gameweeks where all fixtures in our synced data are finished
    const fixturesByGameweek = new Map<number, FPLFixture[]>()
    for (const fixture of fixturesData) {
      if (fixture.event) {
        const existing = fixturesByGameweek.get(fixture.event) || []
        existing.push(fixture)
        fixturesByGameweek.set(fixture.event, existing)
      }
    }
    
    for (const [gameweek, fixtures] of fixturesByGameweek) {
      if (fixtures.every(f => f.finished)) {
        completedGameweeks.add(gameweek)
      }
    }
    
    // Call check_and_finish_turbo_games for each completed gameweek
    for (const gameweek of completedGameweeks) {
      console.log(`Checking Turbo games for gameweek ${gameweek}...`)
      const { error } = await supabase.rpc('check_and_finish_turbo_games', {
        p_gameweek_number: gameweek
      })
      if (error) {
        console.error(`Error checking Turbo games for gameweek ${gameweek}:`, error)
      } else {
        console.log(`Turbo game check complete for gameweek ${gameweek}`)
      }
    }

    console.log('FPL data sync completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'FPL data synced successfully',
        synced: {
          teams: bootstrapData.teams.length,
          gameweeks: bootstrapData.events.length,
          fixtures: fixturesData.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error syncing FPL data:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})