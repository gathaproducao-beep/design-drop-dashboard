import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstanceStatus {
  id: string;
  nome: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Verificando status das instâncias WhatsApp...');

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar todas as instâncias (ativas e inativas)
    const { data: instances, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .order('ordem', { ascending: true });

    if (instanceError) {
      console.error('Erro ao buscar instâncias:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar instâncias' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instances || instances.length === 0) {
      return new Response(
        JSON.stringify({ statuses: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verificando ${instances.length} instâncias...`);

    const statuses: InstanceStatus[] = [];

    for (const instance of instances) {
      try {
        const apiUrl = instance.evolution_api_url?.trim();
        const apiKey = instance.evolution_api_key?.trim();
        const instanceName = instance.evolution_instance?.trim();

        if (!apiUrl || !apiKey || !instanceName) {
          statuses.push({
            id: instance.id,
            nome: instance.nome,
            status: 'error',
            message: 'Dados incompletos',
          });
          continue;
        }

        // Consultar status de conexão na Evolution API
        const statusUrl = `${apiUrl}/instance/connectionState/${instanceName}`;
        console.log(`Verificando ${instance.nome}: ${statusUrl}`);

        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
          },
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Erro ao verificar ${instance.nome}:`, errorData);
          statuses.push({
            id: instance.id,
            nome: instance.nome,
            status: 'error',
            message: `HTTP ${response.status}`,
          });
          continue;
        }

        const data = await response.json();
        console.log(`Status ${instance.nome}:`, data);

        // A Evolution API retorna { instance: "xxx", state: "open" | "close" | "connecting" }
        let status: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
        
        if (data?.state === 'open' || data?.instance?.state === 'open') {
          status = 'connected';
        } else if (data?.state === 'connecting' || data?.instance?.state === 'connecting') {
          status = 'connecting';
        } else if (data?.state === 'close' || data?.instance?.state === 'close') {
          status = 'disconnected';
        }

        statuses.push({
          id: instance.id,
          nome: instance.nome,
          status,
          message: data?.state || data?.instance?.state,
        });

      } catch (error) {
        console.error(`Erro ao verificar instância ${instance.nome}:`, error);
        statuses.push({
          id: instance.id,
          nome: instance.nome,
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    console.log('Resultado:', statuses);

    return new Response(
      JSON.stringify({ statuses }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro interno:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
