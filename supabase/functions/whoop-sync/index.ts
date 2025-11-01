import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Default to single-user ID if not provided
    const user_id = body.user_id || '00000000-0000-0000-0000-000000000001';

    console.log('Starting WHOOP sync for user:', user_id);

    const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID');
    const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get stored tokens
    console.log('Fetching OAuth tokens for user:', user_id);
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', user_id)
      .eq('provider', 'whoop')
      .single();

    if (tokenError || !tokenData) {
      console.error('No WHOOP tokens found for user:', user_id);
      return new Response('Not connected to WHOOP', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    // Check if token needs refresh
    if (expiresAt <= new Date()) {
      console.log('Access token expired, refreshing...');
      const refreshResponse = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
          client_id: WHOOP_CLIENT_ID!,
          client_secret: WHOOP_CLIENT_SECRET!,
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Token refresh failed:', refreshResponse.status, errorText);
        return new Response('Failed to refresh WHOOP token', { 
          status: 500,
          headers: corsHeaders 
        });
      }

      const newTokenData = await refreshResponse.json();
      accessToken = newTokenData.access_token;
      const newExpiresAt = new Date(Date.now() + (newTokenData.expires_in * 1000));

      // Update tokens in database
      await supabase
        .from('oauth_tokens')
        .update({
          access_token: newTokenData.access_token,
          refresh_token: newTokenData.refresh_token,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', tokenData.id);

      console.log('Token refreshed successfully');
    }

    // Fetch last 7 days of recovery data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log('Fetching WHOOP recovery data...');
    const recoveryResponse = await fetch(
      `https://api.prod.whoop.com/developer/v1/recovery?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!recoveryResponse.ok) {
      const errorText = await recoveryResponse.text();
      console.error('WHOOP API error:', recoveryResponse.status, errorText);
      return new Response('Failed to fetch WHOOP data', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const recoveryData = await recoveryResponse.json();
    console.log('Fetched recovery records:', recoveryData.records?.length || 0);

    // Fetch sleep data
    console.log('Fetching WHOOP sleep data...');
    const sleepResponse = await fetch(
      `https://api.prod.whoop.com/developer/v1/activity/sleep?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const sleepData = sleepResponse.ok ? await sleepResponse.json() : { records: [] };
    console.log('Fetched sleep records:', sleepData.records?.length || 0);

    // Process and store data
    const insertedCount = 0;
    
    if (recoveryData.records && recoveryData.records.length > 0) {
      for (const recovery of recoveryData.records) {
        const date = new Date(recovery.created_at).toISOString().split('T')[0];
        
        // Find corresponding sleep data
        const sleep = sleepData.records?.find((s: any) => {
          const sleepDate = new Date(s.created_at).toISOString().split('T')[0];
          return sleepDate === date;
        });

        const whoopRecord = {
          user_id,
          date,
          recovery_pct: recovery.score?.recovery_score ? Math.round(recovery.score.recovery_score) : null,
          hrv_ms: recovery.score?.hrv_rmssd_milli ? Math.round(recovery.score.hrv_rmssd_milli) : null,
          rhr_bpm: recovery.score?.resting_heart_rate ? Math.round(recovery.score.resting_heart_rate) : null,
          sleep_start: sleep?.start ? new Date(sleep.start).toISOString() : null,
          sleep_end: sleep?.end ? new Date(sleep.end).toISOString() : null,
          sleep_perf_pct: sleep?.score?.stage_summary?.total_in_bed_time_milli 
            ? Math.round((sleep.score.stage_summary.total_in_bed_time_milli / (8 * 60 * 60 * 1000)) * 100)
            : null,
        };

        // Upsert (insert or update if exists)
        const { error: upsertError } = await supabase
          .from('whoop_daily')
          .upsert(whoopRecord, {
            onConflict: 'user_id,date',
          });

        if (upsertError) {
          console.error('Failed to upsert WHOOP data:', upsertError);
        }
      }
    }

    console.log(`WHOOP sync completed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        records_processed: recoveryData.records?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in whoop-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});