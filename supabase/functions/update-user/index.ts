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

    // 2. Verificar se é admin
    const { data: isAdmin } = await supabaseClient.rpc('is_admin', { check_user_id: user.id });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Pegar dados do corpo da requisição
    const { user_id, email, password, full_name, whatsapp, is_active, access_profile_ids } = await req.json();

    console.log('Updating user:', user_id);

    // 4. Usar service_role para atualizar usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 5. Atualizar auth.users
    const authUpdate: any = {
      email,
      user_metadata: { full_name }
    };

    if (password) {
      authUpdate.password = password;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      authUpdate
    );

    if (authError) throw authError;

    console.log('Auth user updated');

    // 6. Atualizar profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email,
        full_name,
        whatsapp,
        is_active
      })
      .eq('id', user_id);

    if (profileError) throw profileError;

    console.log('Profile updated');

    // 7. Atualizar roles (deletar antigas, inserir novas)
    const { error: deleteRolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);

    if (deleteRolesError) throw deleteRolesError;

    if (access_profile_ids && access_profile_ids.length > 0) {
      const rolesToInsert = access_profile_ids.map((profileId: string) => ({
        user_id: user_id,
        access_profile_id: profileId
      }));

      const { error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .insert(rolesToInsert);

      if (rolesError) throw rolesError;

      console.log('Roles updated');
    }

    return new Response(
      JSON.stringify({ success: true }),
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
