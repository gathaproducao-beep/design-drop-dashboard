import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verifica se é um LID (Local ID) do WhatsApp - não é telefone válido
function isLidId(jid: string): boolean {
  // LIDs terminam com @lid ou são números muito grandes (>13 dígitos)
  if (jid.includes('@lid')) return true;
  const cleaned = jid.replace(/\D/g, '').replace(/@.*$/, '');
  // LIDs geralmente são IDs internos com muitos dígitos
  return cleaned.length > 13;
}

// Normaliza telefone removendo caracteres especiais
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  // Remove @s.whatsapp.net ou @c.us ou @lid
  cleaned = cleaned.replace(/@.*$/, '');
  
  // Se for um LID (número muito grande), retorna vazio
  if (cleaned.length > 13) {
    console.log('⚠️ Detectado LID (não é telefone):', cleaned.substring(0, 10) + '...');
    return '';
  }
  
  // Garante que começa com 55 (Brasil)
  if (!cleaned.startsWith('55') && cleaned.length >= 10 && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

// Extrai texto da mensagem - Evolution API envia base64 ou url no payload
function extractMessageContent(message: any, fullPayload?: any): { content: string; type: string; mediaUrl?: string; caption?: string; mimeType?: string; base64?: string } {
  // Evolution API pode enviar a mídia no nível do data
  const mediaData = fullPayload?.data || {};
  
  // Para mensagens enviadas externamente, Evolution API pode colocar a URL em mediaUrl no nível do data
  const externalMediaUrl = mediaData.mediaUrl || mediaData.message?.mediaUrl;
  
  if (message.conversation) {
    return { content: message.conversation, type: 'text' };
  }
  if (message.extendedTextMessage?.text) {
    return { content: message.extendedTextMessage.text, type: 'text' };
  }
  if (message.imageMessage) {
    // Evolution API envia a URL/base64 em diferentes lugares
    const mediaUrl = externalMediaUrl || mediaData.media?.url || message.imageMessage.url;
    const base64 = mediaData.base64 || mediaData.media?.base64;
    
    return { 
      content: message.imageMessage.caption || '[Imagem]',
      type: 'image',
      mediaUrl,
      base64,
      caption: message.imageMessage.caption,
      mimeType: message.imageMessage.mimetype
    };
  }
  if (message.documentMessage) {
    const mediaUrl = externalMediaUrl || mediaData.media?.url || message.documentMessage.url;
    const base64 = mediaData.base64 || mediaData.media?.base64;
    return { 
      content: message.documentMessage.fileName || '[Documento]',
      type: 'document',
      mediaUrl,
      base64,
      caption: message.documentMessage.caption,
      mimeType: message.documentMessage.mimetype
    };
  }
  if (message.audioMessage) {
    const mediaUrl = externalMediaUrl || mediaData.media?.url || message.audioMessage.url;
    const base64 = mediaData.base64 || mediaData.media?.base64;
    return { 
      content: '[Áudio]', 
      type: 'audio', 
      mediaUrl,
      base64,
      mimeType: message.audioMessage.mimetype 
    };
  }
  if (message.videoMessage) {
    const mediaUrl = externalMediaUrl || mediaData.media?.url || message.videoMessage.url;
    const base64 = mediaData.base64 || mediaData.media?.base64;
    return { 
      content: message.videoMessage.caption || '[Vídeo]',
      type: 'video',
      mediaUrl,
      base64,
      caption: message.videoMessage.caption,
      mimeType: message.videoMessage.mimetype
    };
  }
  if (message.stickerMessage) {
    const mediaUrl = externalMediaUrl || mediaData.media?.url || message.stickerMessage.url;
    const base64 = mediaData.base64 || mediaData.media?.base64;
    return { content: '[Sticker]', type: 'sticker', mediaUrl, base64 };
  }
  // Verificar reação
  if (message.reactionMessage) {
    return { content: message.reactionMessage.text || '👍', type: 'reaction' };
  }
  return { content: '[Mensagem não suportada]', type: 'text' };
}

// Função para fazer download e upload de mídia para o Storage
async function downloadAndUploadMedia(
  supabase: any,
  mediaUrl: string | undefined,
  base64Data: string | undefined,
  mimeType: string | undefined,
  messageId: string,
  type: string
): Promise<string | null> {
  try {
    let fileData: Uint8Array | null = null;
    
    // Prioriza base64 se disponível (mais confiável)
    if (base64Data) {
      console.log('📦 Usando dados base64 para upload');
      // Decodificar base64
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes;
    } else if (mediaUrl) {
      console.log('🌐 Fazendo download de:', mediaUrl.substring(0, 50) + '...');
      
      // Fazer download da URL
      const response = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'WhatsApp/2.0'
        }
      });
      
      if (!response.ok) {
        console.error('❌ Erro ao baixar mídia:', response.status, response.statusText);
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      fileData = new Uint8Array(arrayBuffer);
    }
    
    if (!fileData || fileData.length === 0) {
      console.log('⚠️ Sem dados de mídia para upload');
      return null;
    }
    
    // Determinar extensão baseado no mimeType
    let extension = 'bin';
    if (mimeType) {
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
      else if (mimeType.includes('png')) extension = 'png';
      else if (mimeType.includes('gif')) extension = 'gif';
      else if (mimeType.includes('webp')) extension = 'webp';
      else if (mimeType.includes('mp4')) extension = 'mp4';
      else if (mimeType.includes('ogg')) extension = 'ogg';
      else if (mimeType.includes('opus')) extension = 'opus';
      else if (mimeType.includes('mpeg') && type === 'audio') extension = 'mp3';
      else if (mimeType.includes('pdf')) extension = 'pdf';
      else if (mimeType.includes('webm')) extension = 'webm';
    }
    
    const fileName = `${Date.now()}_${messageId}.${extension}`;
    const filePath = `messages/${fileName}`;
    
    console.log(`📤 Uploading para Storage: ${filePath} (${fileData.length} bytes)`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(filePath, fileData, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ Erro ao fazer upload:', uploadError);
      return null;
    }
    
    // Gerar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filePath);
    
    console.log('✅ Mídia salva no Storage:', publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Erro ao processar mídia:', error);
    return null;
  }
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
    const messageId = key.id || message.id || crypto.randomUUID();
    const pushName = message.pushName || message.name || '';
    const fromMe = key.fromMe || false;

    // IMPORTANTE: WhatsApp pode usar LID (Local ID) em key.remoteJid
    // O telefone real fica em key.remoteJidAlt quando isso acontece
    let remoteJid = key.remoteJid || message.from || '';
    
    // Se remoteJid é um LID, tentar usar remoteJidAlt
    if (isLidId(remoteJid)) {
      console.log('🔍 Detectado LID em remoteJid, buscando remoteJidAlt...');
      const altJid = key.remoteJidAlt || message.remoteJidAlt || '';
      if (altJid && !isLidId(altJid)) {
        console.log('✅ Usando remoteJidAlt:', altJid);
        remoteJid = altJid;
      } else {
        console.log('⚠️ remoteJidAlt não disponível ou também é LID');
      }
    }

    // Mensagens enviadas por nós são salvas como outbound
    console.log(`📤 Mensagem ${fromMe ? 'ENVIADA' : 'RECEBIDA'} - JID: ${remoteJid}`);
    
    // Definir direção baseada em fromMe
    const direction = fromMe ? 'outbound' : 'inbound';

    // Ignorar grupos
    if (remoteJid.includes('@g.us')) {
      console.log('⏭️ Mensagem de grupo ignorada');
      return new Response(JSON.stringify({ success: true, group: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extrair telefone do JID
    let phone = normalizePhone(remoteJid);
    
    // Se ainda não conseguiu telefone válido, tentar outros campos
    if (!phone || phone.length < 10) {
      // Tentar remoteJidAlt diretamente
      const altPhone = normalizePhone(key.remoteJidAlt || '');
      if (altPhone && altPhone.length >= 10) {
        console.log('✅ Telefone extraído de remoteJidAlt:', altPhone);
        phone = altPhone;
      } else {
        // Tentar participant (para mensagens enviadas)
        const participantPhone = normalizePhone(key.participant || message.participant || '');
        if (participantPhone && participantPhone.length >= 10) {
          console.log('✅ Telefone extraído de participant:', participantPhone);
          phone = participantPhone;
        }
      }
    }
    
    if (!phone || phone.length < 10) {
      console.log('⚠️ Telefone inválido após todas tentativas:', remoteJid, '| Alt:', key.remoteJidAlt);
      return new Response(JSON.stringify({ success: false, error: 'Invalid phone - could not extract valid number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('📞 Telefone extraído:', phone);

    // Extrair conteúdo da mensagem
    const messageContent = message.message || message;
    const { content, type, mediaUrl, caption, mimeType, base64 } = extractMessageContent(messageContent, payload);

    console.log('📱 Processando mensagem:', { phone, pushName, type, content: content.substring(0, 50), hasMedia: !!(mediaUrl || base64) });

    // Download e upload de mídia para Storage (se houver)
    let storedMediaUrl: string | null = null;
    if (mediaUrl || base64) {
      storedMediaUrl = await downloadAndUploadMedia(supabase, mediaUrl, base64, mimeType, messageId, type);
    }

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
      // Atualizar nome (apenas se tiver pushName e for inbound) e last_message_at
      const updateData: any = {
        last_message_at: new Date().toISOString()
      };
      
      // Só atualiza nome se for mensagem recebida com pushName
      if (!fromMe && pushName) {
        updateData.name = pushName;
      }
      
      await supabase
        .from('whatsapp_contacts')
        .update(updateData)
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
          // Só incrementa unread se for mensagem recebida
          unread_count: fromMe ? 0 : 1,
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
      
      // Só incrementa unread e reabre se for mensagem recebida (não enviada por nós)
      const updateData: any = {
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
      };
      
      if (!fromMe) {
        // Mensagem recebida: incrementa unread e reabre se finalizado
        updateData.unread_count = (conversation.unread_count || 0) + 1;
        if (wasFinalized) {
          updateData.status = 'novo';
          updateData.assigned_to = null;
          updateData.assigned_at = null;
        }
      }
      
      const { error: updateError } = await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', conversation.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar conversa:', updateError);
      }

      if (wasFinalized && !fromMe) {
        console.log('🔄 Conversa reaberta:', conversation.id);
      }
    }

    // 4. Salvar mensagem (usar URL do Storage se disponível, senão URL original)
    const finalMediaUrl = storedMediaUrl || mediaUrl || null;
    
    const { data: savedMessage, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        direction: direction,
        message_type: type,
        content,
        caption,
        media_url: finalMediaUrl,
        media_mime_type: mimeType,
        sender_phone: fromMe ? null : phone,
        sender_name: fromMe ? null : pushName,
        external_id: messageId,
        status: fromMe ? 'sent' : 'delivered'
      })
      .select()
      .single();

    if (msgError) {
      console.error('❌ Erro ao salvar mensagem:', msgError);
      throw msgError;
    }

    console.log('✅ Mensagem salva:', savedMessage.id, storedMediaUrl ? '(com mídia no Storage)' : '');

    return new Response(JSON.stringify({ 
      success: true, 
      contact_id: contact.id,
      conversation_id: conversation.id,
      message_id: savedMessage.id,
      media_stored: !!storedMediaUrl
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
