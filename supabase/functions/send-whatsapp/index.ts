import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsappRequest {
  phone: string;
  message: string;
  instance_id?: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'document' | 'audio';
  caption?: string;
}

/**
 * Normaliza número de telefone adicionando código do país (55) se necessário
 */
const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Se já começa com 55, retornar
  if (cleanPhone.startsWith('55')) {
    return cleanPhone;
  }
  
  // Adicionar código do país 55
  return `55${cleanPhone}`;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, message, instance_id, media_url, media_type, caption }: SendWhatsappRequest = await req.json();

    // Normalizar telefone (adicionar 55 se necessário)
    const normalizedPhone = normalizePhone(phone);

    console.log('Recebida requisição de envio WhatsApp:', { 
      phone: phone, 
      normalized: normalizedPhone,
      instance_id 
    });

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Telefone e mensagem são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar instâncias ativas do banco
    let instanceQuery = supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('is_active', true)
      .order('ordem', { ascending: true });

    if (instance_id) {
      instanceQuery = instanceQuery.eq('id', instance_id);
    }

    const { data: instances, error: instanceError } = await instanceQuery;

    if (instanceError || !instances || instances.length === 0) {
      console.error('Erro ao buscar instâncias:', instanceError);
      return new Response(
        JSON.stringify({ error: 'Nenhuma instância WhatsApp ativa encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontradas ${instances.length} instâncias ativas`);

    // Tentar enviar por cada instância até conseguir
    let lastError = null;
    for (const instance of instances) {
      try {
        console.log(`Tentando enviar pela instância: ${instance.nome} (${instance.evolution_instance})`);

        let response;
        let data;

        // Se tem mídia, enviar como mídia
        if (media_url && media_type) {
          console.log(`Enviando mídia: ${media_type} - ${media_url}`);
          const mediaUrl = `${instance.evolution_api_url}/message/sendMedia/${instance.evolution_instance}`;
          
          response = await fetch(mediaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': instance.evolution_api_key,
            },
            body: JSON.stringify({
              number: normalizedPhone,
              mediatype: media_type,
              media: media_url,
              caption: caption || message,
            }),
          });

          data = await response.json();
        } else {
          // Enviar como texto
          console.log(`Enviando texto: ${message}`);
          const textUrl = `${instance.evolution_api_url}/message/sendText/${instance.evolution_instance}`;
          
          response = await fetch(textUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': instance.evolution_api_key,
            },
            body: JSON.stringify({
              number: normalizedPhone,
              text: message,
            }),
          });

          data = await response.json();
        }

        if (!response.ok) {
          console.error(`Erro na instância ${instance.nome}:`, data);
          lastError = data;
          continue; // Tenta próxima instância
        }

        console.log(`Mensagem enviada com sucesso pela instância: ${instance.nome}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            data,
            instance_used: instance.nome 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error(`Erro ao enviar pela instância ${instance.nome}:`, error);
        lastError = error;
        continue; // Tenta próxima instância
      }
    }

    // Se chegou aqui, nenhuma instância conseguiu enviar
    return new Response(
      JSON.stringify({ 
        error: 'Falha ao enviar mensagem por todas as instâncias',
        details: lastError 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro interno:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
