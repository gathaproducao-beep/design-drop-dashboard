import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  conversation_id: string;
  content: string;
  message_type?: string;
  media_url?: string;
  caption?: string;
}

// Normaliza telefone
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .single();

    const body: SendMessageRequest = await req.json();
    const { conversation_id, content, message_type = 'text', media_url, caption } = body;

    if (!conversation_id || (!content && !media_url)) {
      throw new Error('conversation_id and content or media_url are required');
    }

    console.log('📤 Enviando mensagem:', { conversation_id, content: content?.substring(0, 50) });

    // 1. Buscar conversa com contato e instância
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select(`
        *,
        contact:whatsapp_contacts(*),
        instance:whatsapp_instances(*)
      `)
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      throw new Error('Conversation not found');
    }

    const phone = normalizePhone(conversation.contact.phone);
    const instance = conversation.instance;

    // 2. Salvar mensagem no banco como pending
    const { data: savedMessage, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id,
        direction: 'outbound',
        message_type,
        content: content || caption || '',
        media_url,
        caption,
        sender_name: profile?.full_name || user.email,
        sent_by_user_id: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (msgError) {
      throw msgError;
    }

    // 3. Atualizar conversa
    await supabase
      .from('whatsapp_conversations')
      .update({
        status: 'em_atendimento',
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        last_message_preview: (content || caption || '').substring(0, 100),
        unread_count: 0
      })
      .eq('id', conversation_id);

    // 4. Enviar via WhatsApp
    let sendSuccess = false;
    let sendError = '';

    if (instance && instance.is_active) {
      try {
        if (instance.api_type === 'evolution') {
          // Enviar via Evolution API
          const evolutionUrl = instance.evolution_api_url;
          const evolutionKey = instance.evolution_api_key;
          const evolutionInstance = instance.evolution_instance;

          if (evolutionUrl && evolutionKey && evolutionInstance) {
            let endpoint = '';
            let payload: any = {};

            if (message_type === 'text' || !media_url) {
              endpoint = `${evolutionUrl}/message/sendText/${evolutionInstance}`;
              payload = {
                number: phone,
                text: content
              };
            } else {
              endpoint = `${evolutionUrl}/message/sendMedia/${evolutionInstance}`;
              payload = {
                number: phone,
                mediatype: message_type,
                media: media_url,
                caption: caption || content
              };
            }

            console.log('📡 Enviando para Evolution:', endpoint);

            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey
              },
              body: JSON.stringify(payload)
            });

            if (response.ok) {
              sendSuccess = true;
              console.log('✅ Mensagem enviada via Evolution');
            } else {
              const errorText = await response.text();
              sendError = `Evolution API error: ${response.status} - ${errorText}`;
              console.error('❌ Erro Evolution:', sendError);
            }
          }
        } else if (instance.api_type === 'webhook' && instance.webhook_url) {
          // Enviar via Webhook
          const webhookPayload = {
            phone,
            message: content,
            media_url,
            media_type: message_type,
            caption,
            instance_name: instance.nome,
            timestamp: new Date().toISOString()
          };

          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };

          // Adicionar headers customizados
          if (instance.webhook_headers) {
            Object.assign(headers, instance.webhook_headers);
          }

          const response = await fetch(instance.webhook_url, {
            method: 'POST',
            headers,
            body: JSON.stringify(webhookPayload)
          });

          if (response.ok) {
            sendSuccess = true;
            console.log('✅ Mensagem enviada via Webhook');
          } else {
            const errorText = await response.text();
            sendError = `Webhook error: ${response.status} - ${errorText}`;
            console.error('❌ Erro Webhook:', sendError);
          }
        }
      } catch (err: unknown) {
        sendError = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Erro ao enviar:', err);
      }
    } else {
      sendError = 'No active instance found';
    }

    // 5. Atualizar status da mensagem
    await supabase
      .from('whatsapp_messages')
      .update({
        status: sendSuccess ? 'sent' : 'failed',
        error_message: sendSuccess ? null : sendError
      })
      .eq('id', savedMessage.id);

    // 6. Registrar na auditoria
    await supabase
      .from('whatsapp_audit_log')
      .insert({
        user_id: user.id,
        user_name: profile?.full_name || user.email,
        action: 'respondeu',
        entity_type: 'conversation',
        entity_id: conversation_id,
        details: {
          message_id: savedMessage.id,
          content_preview: (content || '').substring(0, 50),
          success: sendSuccess
        }
      });

    return new Response(JSON.stringify({
      success: sendSuccess,
      message_id: savedMessage.id,
      error: sendSuccess ? null : sendError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
