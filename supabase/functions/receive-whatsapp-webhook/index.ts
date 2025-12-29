import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone removendo caracteres especiais
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  // Remove @s.whatsapp.net ou @c.us
  cleaned = cleaned.replace(/@.*$/, '');
  // Garante que começa com 55
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// Extrai texto da mensagem
function extractMessageContent(message: any): { content: string; type: string; mediaUrl?: string; caption?: string; mimeType?: string } {
  if (message.conversation) {
    return { content: message.conversation, type: 'text' };
  }
  if (message.extendedTextMessage?.text) {
    return { content: message.extendedTextMessage.text, type: 'text' };
  }
  if (message.imageMessage) {
    return { 
      content: message.imageMessage.caption || '[Imagem]',
      type: 'image',
      caption: message.imageMessage.caption,
      mimeType: message.imageMessage.mimetype
    };
  }
  if (message.documentMessage) {
    return { 
      content: message.documentMessage.fileName || '[Documento]',
      type: 'document',
      caption: message.documentMessage.caption,
      mimeType: message.documentMessage.mimetype
    };
  }
  if (message.audioMessage) {
    return { content: '[Áudio]', type: 'audio', mimeType: message.audioMessage.mimetype };
  }
  if (message.videoMessage) {
    return { 
      content: message.videoMessage.caption || '[Vídeo]',
      type: 'video',
      caption: message.videoMessage.caption,
      mimeType: message.videoMessage.mimetype
    };
  }
  if (message.stickerMessage) {
    return { content: '[Sticker]', type: 'sticker' };
  }
  return { content: '[Mensagem não suportada]', type: 'text' };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('📥 Webhook recebido:', JSON.stringify(payload, null, 2));

    // Evolution API envia diferentes tipos de eventos
    const event = payload.event || payload.type;
    
    // Ignorar eventos que não são mensagens
    if (!['messages.upsert', 'message', 'messages'].includes(event)) {
      console.log('⏭️ Evento ignorado:', event);
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair dados da mensagem
    const instanceName = payload.instance || payload.instanceName;
    const messageData = payload.data || payload.message || payload;
    
    // Se for array, pegar primeiro item
    const message = Array.isArray(messageData) ? messageData[0] : messageData;
    
    if (!message) {
      console.log('⚠️ Mensagem vazia');
      return new Response(JSON.stringify({ success: true, empty: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair informações
    const key = message.key || {};
    const remoteJid = key.remoteJid || message.from || '';
    const messageId = key.id || message.id;
    const pushName = message.pushName || message.name || '';
    const fromMe = key.fromMe || false;

    // Ignorar mensagens enviadas por nós mesmos
    if (fromMe) {
      console.log('⏭️ Mensagem própria ignorada');
      return new Response(JSON.stringify({ success: true, fromMe: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ignorar grupos
    if (remoteJid.includes('@g.us')) {
      console.log('⏭️ Mensagem de grupo ignorada');
      return new Response(JSON.stringify({ success: true, group: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair telefone do JID
    const phone = normalizePhone(remoteJid);
    if (!phone || phone.length < 10) {
      console.log('⚠️ Telefone inválido:', remoteJid);
      return new Response(JSON.stringify({ success: false, error: 'Invalid phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair conteúdo da mensagem
    const messageContent = message.message || message;
    const { content, type, caption, mimeType } = extractMessageContent(messageContent);

    console.log('📱 Processando mensagem:', { phone, pushName, type, content: content.substring(0, 50) });

    // 1. Buscar ou criar contato
    let { data: contact } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('phone', phone)
      .single();

    if (!contact) {
      // Verificar se tem pedidos vinculados
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id')
        .or(`telefone.ilike.%${phone}%,telefone.ilike.%${phone.substring(2)}%`)
        .limit(1);

      const isLead = !pedidos || pedidos.length === 0;

      const { data: newContact, error: contactError } = await supabase
        .from('whatsapp_contacts')
        .insert({
          phone,
          name: pushName || null,
          is_lead: isLead,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (contactError) {
        console.error('❌ Erro ao criar contato:', contactError);
        throw contactError;
      }
      contact = newContact;
      console.log('✅ Contato criado:', contact.id);
    } else {
      // Atualizar nome e last_message_at
      await supabase
        .from('whatsapp_contacts')
        .update({ 
          name: pushName || contact.name,
          last_message_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    }

    // 2. Buscar instância pelo nome
    let instanceId = null;
    if (instanceName) {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('evolution_instance', instanceName)
        .single();
      
      instanceId = instance?.id || null;
    }

    // 3. Buscar ou criar conversa
    let conversationQuery = supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('contact_id', contact.id);

    if (instanceId) {
      conversationQuery = conversationQuery.eq('instance_id', instanceId);
    } else {
      conversationQuery = conversationQuery.is('instance_id', null);
    }

    let { data: conversation } = await conversationQuery.single();

    if (!conversation) {
      const { data: newConversation, error: convError } = await supabase
        .from('whatsapp_conversations')
        .insert({
          contact_id: contact.id,
          instance_id: instanceId,
          status: 'novo',
          unread_count: 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100)
        })
        .select()
        .single();

      if (convError) {
        console.error('❌ Erro ao criar conversa:', convError);
        throw convError;
      }
      conversation = newConversation;
      console.log('✅ Conversa criada:', conversation.id);
    } else {
      // Verificar se conversa estava finalizada
      const wasFinalized = conversation.status === 'finalizado';
      
      const { error: updateError } = await supabase
        .from('whatsapp_conversations')
        .update({
          status: wasFinalized ? 'novo' : conversation.status,
          unread_count: (conversation.unread_count || 0) + 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
          // Se estava finalizado e recebeu nova msg, limpar assigned
          ...(wasFinalized ? { assigned_to: null, assigned_at: null } : {})
        })
        .eq('id', conversation.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar conversa:', updateError);
      }

      if (wasFinalized) {
        console.log('🔄 Conversa reaberta:', conversation.id);
      }
    }

    // 4. Salvar mensagem
    const { data: savedMessage, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'inbound',
        message_type: type,
        content,
        caption,
        media_mime_type: mimeType,
        sender_phone: phone,
        sender_name: pushName,
        external_id: messageId,
        status: 'delivered'
      })
      .select()
      .single();

    if (msgError) {
      console.error('❌ Erro ao salvar mensagem:', msgError);
      throw msgError;
    }

    console.log('✅ Mensagem salva:', savedMessage.id);

    return new Response(JSON.stringify({ 
      success: true, 
      contact_id: contact.id,
      conversation_id: conversation.id,
      message_id: savedMessage.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('❌ Erro no webhook:', error);
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
