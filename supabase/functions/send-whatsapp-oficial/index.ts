import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsappOficialRequest {
  phone: string;
  message: string;
  phone_number_id: string;
  access_token: string;
  template_name?: string;
  template_params?: string[];
  media_url?: string;
  media_type?: 'image' | 'video' | 'document';
  caption?: string;
  header_image_url?: string; // Nova: imagem de cabeçalho do template
}

/**
 * Normaliza número de telefone para formato internacional
 */
const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('55')) {
    return cleanPhone;
  }
  return `55${cleanPhone}`;
};

serve(async (req) => {
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

    const { 
      phone, 
      message, 
      phone_number_id,
      access_token,
      template_name,
      template_params,
      media_url,
      media_type,
      caption,
      header_image_url
    }: SendWhatsappOficialRequest = await req.json();

    const normalizedPhone = normalizePhone(phone);

    console.log('Enviando via API Oficial do WhatsApp:', { 
      phone: normalizedPhone,
      phone_number_id,
      hasTemplate: !!template_name,
      hasMedia: !!media_url,
      hasHeaderImage: !!header_image_url
    });

    if (!phone || !phone_number_id || !access_token) {
      return new Response(
        JSON.stringify({ error: 'Telefone, phone_number_id e access_token são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = `https://graph.facebook.com/v18.0/${phone_number_id}/messages`;

    let requestBody: any;

    // Se tem template, usar template
    if (template_name) {
      const components: any[] = [];

      // Se tem imagem de cabeçalho, adicionar componente header
      if (header_image_url) {
        components.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: header_image_url
              }
            }
          ]
        });
      }

      // Se tem parâmetros de texto, adicionar componente body
      if (template_params && template_params.length > 0) {
        components.push({
          type: "body",
          parameters: template_params.map(param => ({
            type: "text",
            text: param
          }))
        });
      }

      requestBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedPhone,
        type: "template",
        template: {
          name: template_name,
          language: {
            code: "pt_BR"
          },
          components: components.length > 0 ? components : undefined
        }
      };
    } 
    // Se tem mídia (sem template), enviar como mídia
    else if (media_url && media_type) {
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
    }
    // Senão, enviar como texto
    else {
      if (!message) {
        return new Response(
          JSON.stringify({ error: 'Mensagem é obrigatória para envio de texto' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na API Oficial:', data);
      
      let errorMessage = 'Erro ao enviar mensagem';
      
      if (data.error) {
        const errorCode = data.error.code;
        const errorSubcode = data.error.error_subcode;
        
        switch (errorCode) {
          case 190:
            errorMessage = 'Token de acesso inválido ou expirado. Verifique as credenciais.';
            break;
          case 100:
            if (errorSubcode === 33) {
              errorMessage = 'Parâmetro inválido. Verifique o número de telefone.';
            } else {
              errorMessage = `Parâmetro inválido: ${data.error.message}`;
            }
            break;
          case 131026:
            errorMessage = 'Número não registrado no WhatsApp.';
            break;
          case 131047:
            errorMessage = 'Limite de mensagens atingido. Aguarde antes de enviar novamente.';
            break;
          case 131051:
            errorMessage = 'Template não aprovado ou não encontrado.';
            break;
          case 131052:
            errorMessage = 'Erro no formato do template.';
            break;
          case 131053:
            errorMessage = 'Template pausado pelo Meta.';
            break;
          case 132000:
            errorMessage = 'Número de parâmetros do template incorreto.';
            break;
          case 132001:
            errorMessage = 'Parâmetro de template com formato inválido.';
            break;
          case 132005:
            errorMessage = 'Tipo de parâmetro de template incorreto (ex: falta imagem no header).';
            break;
          case 132012:
            errorMessage = 'Número de componentes do template incorreto.';
            break;
          case 132015:
            errorMessage = 'Template não encontrado.';
            break;
          default:
            errorMessage = data.error.message || 'Erro desconhecido na API Oficial';
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: data.error,
          success: false
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Mensagem enviada com sucesso via API Oficial:', data);

    if (data.messages && data.messages.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data,
          message_id: data.messages[0].id,
          api_type: 'oficial'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Resposta inesperada da API',
        data 
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
