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

/**
 * Envia mensagem via Evolution API
 */
const sendViaEvolution = async (
  instance: any,
  normalizedPhone: string,
  message: string,
  media_url?: string,
  media_type?: string,
  caption?: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  const apiUrl = instance.evolution_api_url?.trim();
  const apiKey = instance.evolution_api_key?.trim();
  const instanceName = instance.evolution_instance?.trim();

  if (!apiUrl || !apiKey || !instanceName) {
    return { 
      success: false, 
      error: `Instância "${instance.nome}" está com dados incompletos. Verifique URL, API Key e nome da instância.`
    };
  }

  let response;
  let data;

  // Se tem mídia, enviar como mídia
  if (media_url && media_type) {
    console.log(`[Evolution] Enviando mídia: ${media_type} - ${media_url}`);
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
    console.log(`[Evolution] Enviando texto: ${message?.substring(0, 50)}...`);
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
    console.error(`[Evolution] Erro na instância ${instance.nome}:`, data);
    
    // Traduzir erros comuns
    let errorMessage;
    if (response.status === 401 || response.status === 403) {
      errorMessage = `API Key inválida na instância "${instance.nome}". Verifique a chave de autenticação.`;
    } else if (response.status === 404) {
      errorMessage = `Instância "${instanceName}" não encontrada no servidor Evolution. Verifique se o nome está correto.`;
    } else if (data?.message?.includes('not connected') || data?.message?.includes('disconnected')) {
      errorMessage = `WhatsApp não conectado na instância "${instance.nome}". Escaneie o QR Code novamente.`;
    } else if (data?.message?.includes('number') || data?.message?.includes('phone')) {
      errorMessage = `Número de telefone inválido: ${normalizedPhone}. Verifique se está no formato correto (com DDD).`;
    } else {
      errorMessage = `Erro na instância "${instance.nome}": ${data?.message || 'Erro desconhecido'}`;
    }
    
    return { success: false, error: errorMessage };
  }

  return { success: true, data };
};

/**
 * Envia mensagem via API Oficial do WhatsApp (Meta)
 */
const sendViaOficial = async (
  instance: any,
  normalizedPhone: string,
  message: string,
  media_url?: string,
  media_type?: string,
  caption?: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  const phoneNumberId = instance.phone_number_id?.trim();
  const accessToken = instance.access_token?.trim();

  if (!phoneNumberId || !accessToken) {
    return { 
      success: false, 
      error: `Instância "${instance.nome}" está com dados incompletos. Verifique Phone Number ID e Access Token.`
    };
  }

  const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  let requestBody: any;

  // Se tem mídia, enviar como mídia
  if (media_url && media_type) {
    console.log(`[Oficial] Enviando mídia: ${media_type} - ${media_url}`);
    
    const mediaTypeMap: Record<string, string> = {
      'image': 'image',
      'video': 'video',
      'document': 'document'
    };

    requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: mediaTypeMap[media_type] || 'image',
      [mediaTypeMap[media_type] || 'image']: {
        link: media_url,
        caption: caption || message
      }
    };
  } else {
    // Enviar como texto
    console.log(`[Oficial] Enviando texto: ${message?.substring(0, 50)}...`);
    
    requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "text",
      text: {
        preview_url: true,
        body: message
      }
    };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`[Oficial] Erro na instância ${instance.nome}:`, data);
    
    // Traduzir erros comuns da API Oficial
    let errorMessage = 'Erro ao enviar mensagem';
    
    if (data.error) {
      const errorCode = data.error.code;
      
      switch (errorCode) {
        case 190:
          errorMessage = `Token de acesso inválido ou expirado na instância "${instance.nome}".`;
          break;
        case 100:
          errorMessage = `Parâmetro inválido: ${data.error.message}`;
          break;
        case 131026:
          errorMessage = 'Número não registrado no WhatsApp.';
          break;
        case 131047:
          errorMessage = 'Limite de mensagens atingido. Aguarde antes de enviar novamente.';
          break;
        default:
          errorMessage = `Erro na instância "${instance.nome}": ${data.error.message || 'Erro desconhecido'}`;
      }
    }
    
    return { success: false, error: errorMessage };
  }

  // Verificar se a mensagem foi realmente enviada
  if (data.messages && data.messages.length > 0) {
    return { success: true, data };
  }

  return { success: false, error: 'Resposta inesperada da API Oficial' };
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
    let lastError = '';
    for (const instance of instances) {
      try {
        const apiType = instance.api_type || 'evolution';
        console.log(`Tentando enviar pela instância: ${instance.nome} (tipo: ${apiType})`);

        let result;

        if (apiType === 'oficial') {
          result = await sendViaOficial(
            instance,
            normalizedPhone,
            message,
            media_url,
            media_type,
            caption
          );
        } else {
          result = await sendViaEvolution(
            instance,
            normalizedPhone,
            message,
            media_url,
            media_type,
            caption
          );
        }

        if (result.success) {
          console.log(`Mensagem enviada com sucesso pela instância: ${instance.nome} (${apiType})`);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              data: result.data,
              instance_used: instance.nome,
              api_type: apiType
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        lastError = result.error || 'Erro desconhecido';
        console.log(`Falha na instância ${instance.nome}: ${lastError}`);

      } catch (error) {
        console.error(`Erro ao enviar pela instância ${instance.nome}:`, error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        if (errorMsg.includes('Invalid URL')) {
          lastError = `URL inválida na instância "${instance.nome}". Verifique se a URL está correta e sem espaços.`;
        } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED')) {
          lastError = `Não foi possível conectar ao servidor da instância "${instance.nome}". Verifique se o servidor está online.`;
        } else {
          lastError = `Erro ao conectar com "${instance.nome}": ${errorMsg}`;
        }
      }
    }

    // Se chegou aqui, nenhuma instância conseguiu enviar
    return new Response(
      JSON.stringify({ 
        error: lastError || 'Não foi possível enviar a mensagem. Verifique as configurações das instâncias.',
        message: lastError || 'Falha ao enviar mensagem por todas as instâncias',
        success: false
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
