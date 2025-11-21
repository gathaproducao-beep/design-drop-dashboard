import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Buscando configurações do Google Drive...');

    // Buscar configurações do Drive (pegar apenas o primeiro registro)
    const { data: settings, error: settingsError } = await supabase
      .from('google_drive_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error('Erro ao buscar configurações:', settingsError);
      return new Response(
        JSON.stringify({ 
          error: 'Configurações do Google Drive não encontradas',
          suggestion: 'Configure suas credenciais OAuth2 em Configurações > Google Drive'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Renovando access token...');

    // Renovar access token usando refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: settings.client_id,
        client_secret: settings.client_secret,
        refresh_token: settings.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao renovar token:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Falha ao renovar token do Google Drive',
          details: errorText,
          suggestion: 'Verifique se suas credenciais OAuth2 estão corretas'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token renovado com sucesso');

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3599,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função google-drive-auth:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
