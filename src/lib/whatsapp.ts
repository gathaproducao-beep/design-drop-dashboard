import { supabase } from "@/integrations/supabase/client";

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
 */
export const normalizePhone = (phone: string): string => {
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
 * Formata número de telefone para exibição
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  // 5546999999999 -> +55 (46) 99999-9999
  if (cleanPhone.length === 13) {
    return `+${cleanPhone.slice(0, 2)} (${cleanPhone.slice(2, 4)}) ${cleanPhone.slice(4, 9)}-${cleanPhone.slice(9)}`;
  }
  
  // 5546999999999 -> +55 (46) 9999-9999
  if (cleanPhone.length === 12) {
    return `+${cleanPhone.slice(0, 2)} (${cleanPhone.slice(2, 4)}) ${cleanPhone.slice(4, 8)}-${cleanPhone.slice(8)}`;
  }
  
  return phone;
};

/**
 * Adiciona mensagem à fila para envio assíncrono
 */
export const queueWhatsappMessage = async (
  phone: string, 
  message: string,
  pedidoId?: string,
  scheduledAt?: Date
) => {
  try {
    const { error } = await supabase
      .from('whatsapp_queue')
      .insert([{
        phone,
        message,
        pedido_id: pedidoId,
        status: 'pending',
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : new Date().toISOString()
      }]);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error queueing WhatsApp message:', error);
    throw error;
  }
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
    
    // 6. Substituir variáveis
    const mensagemFinal = replaceVariables(mensagemSelecionada.mensagem, pedido);
    
    // 7. Adicionar à fila COM pedidoId
    await queueWhatsappMessage(telefoneNormalizado, mensagemFinal, pedidoId);
    
    // 8. Atualizar status do pedido para "enviando"
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({ mensagem_enviada: 'enviando' })
      .eq('id', pedidoId);
    
    if (updateError) throw updateError;
    
    return {
      success: true,
      mensagemUsada: mensagemSelecionada.nome,
      telefone: telefoneNormalizado
    };
  } catch (error: any) {
    console.error('Erro ao processar envio:', error);
    throw error;
  }
};
