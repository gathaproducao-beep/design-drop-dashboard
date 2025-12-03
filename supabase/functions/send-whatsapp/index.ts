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
    let lastError: any = null;
    let lastErrorMessage = '';
    for (const instance of instances) {
      try {
        console.log(`Tentando enviar pela instância: ${instance.nome} (${instance.evolution_instance})`);

        // Limpar espaços da URL e dados da instância
        const apiUrl = instance.evolution_api_url?.trim();
        const apiKey = instance.evolution_api_key?.trim();
        const instanceName = instance.evolution_instance?.trim();

        if (!apiUrl || !apiKey || !instanceName) {
          console.error(`Instância ${instance.nome} com dados incompletos`);
          lastErrorMessage = `Instância "${instance.nome}" está com dados incompletos. Verifique URL, API Key e nome da instância.`;
          continue;
        }

        let response;
        let data;

        // Se tem mídia, enviar como mídia
        if (media_url && media_type) {
          console.log(`Enviando mídia: ${media_type} - ${media_url}`);
          const mediaUrl = `${apiUrl}/message/sendMedia/${instanceName}`;
          
          response = await fetch(mediaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
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
          const textUrl = `${apiUrl}/message/sendText/${instanceName}`;
          
          response = await fetch(textUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
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
          
          // Traduzir erros comuns para mensagens mais claras
          if (response.status === 401 || response.status === 403) {
            lastErrorMessage = `API Key inválida na instância "${instance.nome}". Verifique a chave de autenticação.`;
          } else if (response.status === 404) {
            lastErrorMessage = `Instância "${instanceName}" não encontrada no servidor Evolution. Verifique se o nome está correto.`;
          } else if (data?.message?.includes('not connected') || data?.message?.includes('disconnected')) {
            lastErrorMessage = `WhatsApp não conectado na instância "${instance.nome}". Escaneie o QR Code novamente.`;
          } else if (data?.message?.includes('number') || data?.message?.includes('phone')) {
            lastErrorMessage = `Número de telefone inválido: ${normalizedPhone}. Verifique se está no formato correto (com DDD).`;
          } else {
            lastErrorMessage = `Erro na instância "${instance.nome}": ${data?.message || 'Erro desconhecido'}`;
          }
          continue;
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
        
        // Traduzir erros de conexão
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('Invalid URL')) {
          lastErrorMessage = `URL inválida na instância "${instance.nome}". Verifique se a URL está correta e sem espaços.`;
        } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED')) {
          lastErrorMessage = `Não foi possível conectar ao servidor Evolution da instância "${instance.nome}". Verifique se o servidor está online.`;
        } else {
          lastErrorMessage = `Erro ao conectar com "${instance.nome}": ${errorMsg}`;
        }
        continue;
      }
    }

    // Se chegou aqui, nenhuma instância conseguiu enviar
    return new Response(
      JSON.stringify({ 
        error: lastErrorMessage || 'Não foi possível enviar a mensagem. Verifique as configurações das instâncias.',
        message: lastErrorMessage || 'Falha ao enviar mensagem por todas as instâncias',
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
