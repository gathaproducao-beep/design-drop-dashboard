// Tipos para o sistema de atendimento WhatsApp

export type ConversationStatus = 
  | 'novo' 
  | 'em_atendimento' 
  | 'aguardando_cliente' 
  | 'aguardando_interno' 
  | 'resolvido' 
  | 'pos_venda' 
  | 'finalizado';

export interface WhatsappContact {
  id: string;
  phone: string;
  name: string | null;
  is_lead: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsappConversation {
  id: string;
  contact_id: string;
  instance_id: string | null;
  status: ConversationStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  contact?: WhatsappContact;
  instance?: WhatsappInstance;
  assigned_profile?: { id: string; full_name: string } | null;
}

export interface WhatsappMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker';
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  caption: string | null;
  sender_phone: string | null;
  sender_name: string | null;
  sent_by_user_id: string | null;
  external_id: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface WhatsappInstance {
  id: string;
  nome: string;
  api_type: 'evolution' | 'webhook';
  is_active: boolean;
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  webhook_url: string | null;
}

export interface WhatsappInternalNote {
  id: string;
  conversation_id: string | null;
  contact_id: string | null;
  pedido_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  user?: { full_name: string };
}

export interface WhatsappQuickReply {
  id: string;
  name: string;
  content: string;
  category: string;
  shortcut: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsappAuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  nome_cliente: string;
  codigo_produto: string;
  telefone: string | null;
  data_pedido: string;
  layout_aprovado: string | null;
  mensagem_enviada: string | null;
  observacao: string | null;
  foto_aprovacao: string[] | null;
}

// Grouped conversation - múltiplas conversas do mesmo contato (diferentes instâncias)
export interface GroupedConversation {
  contactPhone: string;
  contact: WhatsappContact | null;
  conversations: WhatsappConversation[];
  totalUnreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  primaryStatus: ConversationStatus;
}

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  aguardando_interno: 'Aguardando interno',
  resolvido: 'Resolvido',
  pos_venda: 'Pós venda',
  finalizado: 'Finalizado'
};

export const STATUS_COLORS: Record<ConversationStatus, string> = {
  novo: 'bg-blue-500',
  em_atendimento: 'bg-green-500',
  aguardando_cliente: 'bg-yellow-500',
  aguardando_interno: 'bg-orange-500',
  resolvido: 'bg-purple-500',
  pos_venda: 'bg-pink-500',
  finalizado: 'bg-gray-500'
};
