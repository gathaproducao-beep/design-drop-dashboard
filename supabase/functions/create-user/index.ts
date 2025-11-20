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
    // 1. Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Request from user:', user.id);

    // 2. Verificar se é admin
    const { data: isAdmin } = await supabaseClient.rpc('is_admin', { check_user_id: user.id });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User is admin, proceeding...');

    // 3. Pegar dados do corpo da requisição
    const { email, password, full_name, whatsapp, access_profile_ids } = await req.json();

    // 4. Usar service_role para criar usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Creating user:', email);

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) throw authError;

    console.log('User created in auth, ID:', authUser.user.id);

    // 5. Atualizar profile com whatsapp
    if (whatsapp) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ whatsapp })
        .eq('id', authUser.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }

    // 6. Associar perfis de acesso
    if (access_profile_ids && access_profile_ids.length > 0) {
      const rolesToInsert = access_profile_ids.map((profileId: string) => ({
        user_id: authUser.user.id,
        access_profile_id: profileId
      }));

      const { error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .insert(rolesToInsert);

      if (rolesError) throw rolesError;

      console.log('Roles assigned successfully');
    }

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
