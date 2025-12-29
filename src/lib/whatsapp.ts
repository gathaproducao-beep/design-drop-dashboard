import { supabase } from "@/integrations/supabase/client";

/**
 * Extrai URLs de imagem do Supabase Storage de uma mensagem
 */
const extractImageUrl = (message: string): { text: string, imageUrl: string | null } => {
  // Regex para detectar URLs do Supabase Storage
  const imageUrlRegex = /(https:\/\/[^\s]+\/storage\/v1\/object\/public\/[^\s]+\.(png|jpg|jpeg|webp|gif))/gi;
  
  const match = message.match(imageUrlRegex);
  
  if (match && match.length > 0) {
    const imageUrl = match[0];
    const textWithoutUrl = message.replace(imageUrl, '').trim();
    return { text: textWithoutUrl, imageUrl };
  }
  
  return { text: message, imageUrl: null };
};

/**
 * Substitui variáveis no template de mensagem
 */
export const replaceVariables = (template: string, pedido: any) => {
  if (!template || !pedido) return template;
  
  // Formatar data
  const formatDate = (date: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  return template
    .replace(/{numero_pedido}/g, pedido.numero_pedido || '')
    .replace(/{nome_cliente}/g, pedido.nome_cliente || '')
    .replace(/{codigo_produto}/g, pedido.codigo_produto || '')
    .replace(/{data_pedido}/g, formatDate(pedido.data_pedido) || '')
    .replace(/{observacao}/g, pedido.observacao || '')
    .replace(/{foto_aprovacao}/g, pedido.foto_aprovacao?.[0] || '[Sem foto]');
};

/**
 * Valida número de telefone no formato brasileiro
 * Aceita com ou sem código do país (55)
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  
  // Remove espaços e caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Aceitar tanto com 55 quanto sem: (55)?DDD + número (8 ou 9 dígitos)
  const phoneRegex = /^(55)?\d{10,11}$/;
  
  return phoneRegex.test(cleanPhone);
};

/**
 * Normaliza número de telefone adicionando código do país (55) se necessário
 * DDDs válidos no Brasil vão de 11 a 99 (não existe DDD 00-10)
 * Números com 10-11 dígitos são sem código do país
 * Números com 12-13 dígitos já têm código do país
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Números muito longos (>13 dígitos) geralmente são IDs internos do WhatsApp
  // Tentar extrair os últimos 12-13 dígitos que podem ser o número real
  if (cleanPhone.length > 13) {
    // Se o número começa com 55, pode ter zeros ou dígitos extras no início
    if (cleanPhone.startsWith('55')) {
      cleanPhone = cleanPhone.slice(0, 13);
    } else {
      // Tentar pegar os últimos 13 dígitos e verificar se faz sentido
      const lastDigits = cleanPhone.slice(-13);
      if (lastDigits.startsWith('55')) {
        cleanPhone = lastDigits;
      } else {
        // Tentar os últimos 11 dígitos (sem código do país)
        const last11 = cleanPhone.slice(-11);
        cleanPhone = `55${last11}`;
      }
    }
  }
  
  // Número com 10 ou 11 dígitos = sem código do país (DDD + número)
  // Adicionar código do país 55
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    return `55${cleanPhone}`;
  }
  
  // Número com 12 ou 13 dígitos = já tem código do país
  if (cleanPhone.length === 12 || cleanPhone.length === 13) {
    return cleanPhone;
  }
  
  return cleanPhone;
};

/**
 * Formata número de telefone para exibição
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Normalizar primeiro para garantir o código do país
  const normalizedPhone = normalizePhone(cleanPhone);
  
  // 5546999999999 (13 dígitos) -> +55 (46) 99999-9999
  if (normalizedPhone.length === 13) {
    return `+${normalizedPhone.slice(0, 2)} (${normalizedPhone.slice(2, 4)}) ${normalizedPhone.slice(4, 9)}-${normalizedPhone.slice(9)}`;
  }
  
  // 554699999999 (12 dígitos) -> +55 (46) 9999-9999
  if (normalizedPhone.length === 12) {
    return `+${normalizedPhone.slice(0, 2)} (${normalizedPhone.slice(2, 4)}) ${normalizedPhone.slice(4, 8)}-${normalizedPhone.slice(8)}`;
  }
  
  // Para números com tamanho não padrão, tentar formatar de forma básica
  if (normalizedPhone.length > 0) {
    // Mostrar apenas últimos 8 dígitos formatados
    if (normalizedPhone.length >= 8) {
      const last8 = normalizedPhone.slice(-8);
      return `***-${last8.slice(0, 4)}-${last8.slice(4)}`;
    }
  }
  
  // Fallback: retornar original se não conseguir formatar
  return phone;
};

/**
 * Adiciona mensagem à fila para envio assíncrono
 */
export const queueWhatsappMessage = async (
  phone: string, 
  message: string,
  pedidoId?: string,
  scheduledAt?: Date,
  templateData?: {
    template_name: string;
    template_params?: string[];
  }
) => {
  try {
    // Extrair URL de imagem se houver
    const { text, imageUrl } = extractImageUrl(message);
    
    const queueData: any = {
      phone,
      message: imageUrl ? text : message, // Se tem imagem, só texto vai pra message
      pedido_id: pedidoId,
      status: 'pending',
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : new Date().toISOString()
    };
    
    // Se tem imagem, adicionar campos de mídia
    if (imageUrl) {
      queueData.media_url = imageUrl;
      queueData.media_type = 'image';
      queueData.caption = text; // O texto vira caption da imagem
    }

    const { error } = await supabase
      .from('whatsapp_queue')
      .insert([queueData]);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error queueing WhatsApp message:', error);
    throw error;
  }
};

/**
 * Busca templates ativos do WhatsApp (API Oficial)
 */
export const getActiveTemplates = async () => {
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('is_active', true)
    .order('nome');
  
  if (error) throw error;
  return data;
};

/**
 * Substitui variáveis em parâmetros do template com dados do pedido
 */
export const replaceTemplateVariables = (variaveis: string[], pedido: any): string[] => {
  return variaveis.map(variavel => {
    // Mapear nomes de variáveis para campos do pedido
    const mapping: Record<string, string> = {
      'nome_cliente': pedido.nome_cliente || '',
      'numero_pedido': pedido.numero_pedido || '',
      'codigo_produto': pedido.codigo_produto || '',
      'data_pedido': pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString('pt-BR') : '',
      'observacao': pedido.observacao || '',
    };
    
    return mapping[variavel] || variavel;
  });
};

/**
 * Envia mensagem diretamente via Edge Function (usado para testes)
 */
export const sendWhatsappMessage = async (
  phone: string, 
  message: string,
  instanceId?: string
) => {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { phone, message, instance_id: instanceId }
  });
  
  if (error) {
    console.error('Erro ao invocar edge function:', error);
    throw error;
  }
  
  if (!data?.success) {
    throw new Error(data?.error || 'Erro ao enviar mensagem');
  }
  
  return data;
};

/**
 * Processa envio de mensagem de aprovação para um pedido
 * - Valida telefone e adiciona código 55 se necessário
 * - Busca mensagens ativas do tipo "aprovacao"
 * - Seleciona uma aleatoriamente
 * - Substitui variáveis com dados do pedido
 * - Adiciona à fila de envio
 * - Atualiza status do pedido para "enviando"
 */
export const processarEnvioPedido = async (pedidoId: string) => {
  try {
    // 1. Buscar dados do pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();
    
    if (pedidoError) throw pedidoError;
    
    // 2. Validar telefone
    if (!pedido.telefone) {
      throw new Error('Pedido não possui telefone cadastrado');
    }
    
    if (!validatePhone(pedido.telefone)) {
      throw new Error('Telefone inválido');
    }
    
    // 3. Normalizar telefone (adicionar 55 se necessário)
    const telefoneNormalizado = normalizePhone(pedido.telefone);
    
    // 4. Buscar mensagens ativas do tipo "aprovacao"
    const { data: mensagens, error: mensagensError } = await supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('type', 'aprovacao')
      .eq('is_active', true);
    
    if (mensagensError) throw mensagensError;
    
    if (!mensagens || mensagens.length === 0) {
      throw new Error('Nenhuma mensagem de aprovação ativa encontrada');
    }
    
    // 5. Selecionar mensagem aleatoriamente
    const mensagemSelecionada = mensagens[Math.floor(Math.random() * mensagens.length)];
    
    // 6. Obter partes da mensagem (usar partes_mensagem se existir, senão usar mensagem)
    const partesMensagem = (mensagemSelecionada as any).partes_mensagem as string[] || [];
    const partesParaEnviar = partesMensagem.length > 0 
      ? partesMensagem.filter((p: string) => p && p.trim().length > 0)
      : [mensagemSelecionada.mensagem];
    
    // 7. Adicionar cada parte à fila em ordem
    for (const parte of partesParaEnviar) {
      const mensagemFinal = replaceVariables(parte, pedido);
      await queueWhatsappMessage(telefoneNormalizado, mensagemFinal, pedidoId);
    }
    
    // 8. Atualizar status do pedido para "enviando"
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({ mensagem_enviada: 'enviando' })
      .eq('id', pedidoId);
    
    if (updateError) throw updateError;
    
    return {
      success: true,
      mensagemUsada: mensagemSelecionada.nome,
      telefone: telefoneNormalizado,
      totalMensagens: partesParaEnviar.length
    };
  } catch (error: any) {
    console.error('Erro ao processar envio:', error);
    throw error;
  }
};
