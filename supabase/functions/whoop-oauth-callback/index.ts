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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This should contain user_id

    if (!code || !state) {
      console.error('Missing code or state parameter');
      return new Response('Missing authorization code or state', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID');
    const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
      console.error('Missing WHOOP credentials');
      return new Response('Server configuration error', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Exchange authorization code for access token
    console.log('Exchanging code for tokens...');
    const tokenResponse = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
        redirect_uri: `${SUPABASE_URL}/functions/v1/whoop-oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('WHOOP token exchange failed:', tokenResponse.status, errorText);
      return new Response('Failed to exchange authorization code', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully obtained tokens');

    // Store tokens in database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    // Check if token already exists for this user
    const { data: existingToken } = await supabase
      .from('oauth_tokens')
      .select('id')
      .eq('user_id', state)
      .eq('provider', 'whoop')
      .single();

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from('oauth_tokens')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', existingToken.id);

      if (updateError) {
        console.error('Failed to update token:', updateError);
        return new Response('Failed to store tokens', { 
          status: 500,
          headers: corsHeaders 
        });
      }
    } else {
      // Insert new token
      const { error: insertError } = await supabase
        .from('oauth_tokens')
        .insert({
          user_id: state,
          provider: 'whoop',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error('Failed to insert token:', insertError);
        return new Response('Failed to store tokens', { 
          status: 500,
          headers: corsHeaders 
        });
      }
    }

    console.log('Tokens stored successfully');

    // Trigger initial sync
    console.log('Triggering initial WHOOP data sync...');
    const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/whoop-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ user_id: state }),
    });

    if (!syncResponse.ok) {
      console.error('Initial sync failed, but OAuth completed');
    }

    // Redirect back to settings page with success message
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${url.origin}/settings?whoop=connected`,
      },
    });

  } catch (error) {
    console.error('Error in whoop-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});