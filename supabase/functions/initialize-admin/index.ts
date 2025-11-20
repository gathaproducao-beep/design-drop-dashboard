import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, password, full_name } = await req.json();

    console.log('Creating admin user:', email);

    // 1. Criar usuário no auth.users (com service_role)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: { full_name }
    });

    if (authError) throw authError;

    console.log('User created in auth, ID:', authUser.user.id);

    // 2. Profile já foi criado pelo trigger
    
    // 3. Associar perfil admin ao usuário
    const { data: adminProfile } = await supabaseAdmin
      .from('access_profiles')
      .select('id')
      .eq('code', 'admin')
      .single();

    if (!adminProfile) throw new Error('Admin profile not found');

    console.log('Admin profile ID:', adminProfile.id);

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        access_profile_id: adminProfile.id
      });

    if (roleError) throw roleError;

    console.log('Admin user created successfully');

    return new Response(
      JSON.stringify({ success: true, user: authUser.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
