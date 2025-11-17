import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsappRequest {
  phone: string;
  message: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar método
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Método não permitido. Use POST.' 
        }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Obter dados da requisição
    const { phone, message }: SendWhatsappRequest = await req.json();

    // Validar campos obrigatórios
    if (!phone || !message) {
      console.error('Validação falhou:', { phone: !!phone, message: !!message });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Telefone e mensagem são obrigatórios' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Obter configurações dos secrets
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      console.error('Secrets não configurados');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração da Evolution API incompleta' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Construir URL da Evolution API
    const evolutionUrl = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
    
    console.log('Enviando mensagem via Evolution API:', {
      url: evolutionUrl,
      phone: phone,
      messageLength: message.length
    });

    // Fazer requisição para a Evolution API
    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    const evolutionData = await evolutionResponse.json();

    // Verificar resposta da Evolution API
    if (!evolutionResponse.ok) {
      console.error('Erro na Evolution API:', {
        status: evolutionResponse.status,
        data: evolutionData
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao enviar mensagem via Evolution API',
          details: evolutionData
        }),
        { 
          status: evolutionResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Mensagem enviada com sucesso:', evolutionData);

    // Retornar sucesso
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: evolutionData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro interno na função send-whatsapp:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno ao enviar mensagem via Evolution API',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
