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
 * Formato esperado: 5546999999999 (código país + DDD + número)
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  
  // Remove espaços e caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Formato brasileiro: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
  const phoneRegex = /^55\d{10,11}$/;
  
  return phoneRegex.test(cleanPhone);
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
  scheduledAt?: Date
) => {
  try {
    const { error } = await supabase
      .from('whatsapp_queue')
      .insert([{
        phone,
        message,
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
