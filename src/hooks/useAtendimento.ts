import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WhatsappConversation, WhatsappMessage, ConversationStatus, GroupedConversation } from '@/types/atendimento';
import { useToast } from '@/hooks/use-toast';

interface UseAtendimentoOptions {
  instanceFilter?: string | null;
  statusFilter?: ConversationStatus | null;
  assignedFilter?: string | null;
  searchQuery?: string;
  refreshInterval?: number;
}

// Helper para agrupar conversas por telefone do contato
function groupConversationsByContact(conversations: WhatsappConversation[]): GroupedConversation[] {
  const groups = new Map<string, WhatsappConversation[]>();

  for (const conv of conversations) {
    const phone = conv.contact?.phone || 'unknown';
    if (!groups.has(phone)) {
      groups.set(phone, []);
    }
    groups.get(phone)!.push(conv);
  }

  const result: GroupedConversation[] = [];

  for (const [phone, convs] of groups) {
    // Ordenar por última mensagem
    convs.sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });

    const primaryConv = convs[0];
    const totalUnread = convs.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    result.push({
      contactPhone: phone,
      contact: primaryConv.contact || null,
      conversations: convs,
      totalUnreadCount: totalUnread,
      lastMessageAt: primaryConv.last_message_at,
      lastMessagePreview: primaryConv.last_message_preview,
      primaryStatus: primaryConv.status
    });
  }

  // Ordenar grupos por última mensagem
  result.sort((a, b) => {
    const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return dateB - dateA;
  });

  return result;
}

export function useAtendimento(options: UseAtendimentoOptions = {}) {
  const { 
    instanceFilter, 
    statusFilter, 
    assignedFilter, 
    searchQuery,
    refreshInterval = 5000 
  } = options;
  
  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupedConversation | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const { toast } = useToast();

  // Conversas agrupadas
  const groupedConversations = useMemo(() => {
    return groupConversationsByContact(conversations);
  }, [conversations]);

  // Conversa selecionada atual (baseado no grupo + instância)
  const selectedConversation = useMemo(() => {
    if (!selectedGroup) return null;
    if (selectedInstanceId) {
      return selectedGroup.conversations.find(c => c.instance_id === selectedInstanceId) || selectedGroup.conversations[0];
    }
    return selectedGroup.conversations[0];
  }, [selectedGroup, selectedInstanceId]);

  // Buscar conversas
  const fetchConversations = useCallback(async () => {
    try {
      let query = supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          contact:whatsapp_contacts(*),
          instance:whatsapp_instances(id, nome, is_active),
          assigned_profile:profiles!whatsapp_conversations_assigned_to_fkey(id, full_name)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (instanceFilter) {
        query = query.eq('instance_id', instanceFilter);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (assignedFilter) {
        query = query.eq('assigned_to', assignedFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar por busca se necessário
      let filtered = (data || []) as unknown as WhatsappConversation[];
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        filtered = filtered.filter(conv => 
          conv.contact?.name?.toLowerCase().includes(lowerSearch) ||
          conv.contact?.phone?.includes(searchQuery) ||
          conv.last_message_preview?.toLowerCase().includes(lowerSearch)
        );
      }

      setConversations(filtered);

      // Atualizar o grupo selecionado se existir
      if (selectedGroup) {
        const updatedGroup = groupConversationsByContact(filtered).find(
          g => g.contactPhone === selectedGroup.contactPhone
        );
        if (updatedGroup) {
          setSelectedGroup(updatedGroup);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
    } finally {
      setLoading(false);
    }
  }, [instanceFilter, statusFilter, assignedFilter, searchQuery, selectedGroup?.contactPhone]);

  // Buscar mensagens de uma conversa
  const fetchMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .returns<WhatsappMessage[]>();

      if (error) throw error;
      setMessages(data || []);
      // NÃO marca como lida aqui - apenas ao responder

    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Selecionar grupo de conversas
  const selectGroup = useCallback(async (group: GroupedConversation, instanceId?: string) => {
    setSelectedGroup(group);
    const targetInstance = instanceId || group.conversations[0]?.instance_id;
    setSelectedInstanceId(targetInstance || null);
    
    const targetConv = instanceId 
      ? group.conversations.find(c => c.instance_id === instanceId) 
      : group.conversations[0];
    
    if (targetConv) {
      await fetchMessages(targetConv.id);
    }
  }, [fetchMessages]);

  // Trocar instância (aba) dentro do mesmo grupo
  const switchInstance = useCallback(async (instanceId: string) => {
    if (!selectedGroup) return;
    setSelectedInstanceId(instanceId);
    
    const targetConv = selectedGroup.conversations.find(c => c.instance_id === instanceId);
    if (targetConv) {
      await fetchMessages(targetConv.id);
    }
  }, [selectedGroup, fetchMessages]);

  // Enviar mensagem
  const sendMessage = useCallback(async (content: string, mediaUrl?: string, messageType: string = 'text') => {
    if (!selectedConversation) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado para enviar mensagens',
          variant: 'destructive'
        });
        return false;
      }

      const response = await supabase.functions.invoke('send-chat-message', {
        body: {
          conversation_id: selectedConversation.id,
          content,
          message_type: messageType,
          media_url: mediaUrl
        }
      });

      if (response.error) throw response.error;
      
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao enviar mensagem');
      }

      // Marcar como lida ao responder
      await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', selectedConversation.id);

      // Recarregar mensagens e conversas
      await fetchMessages(selectedConversation.id);
      await fetchConversations();
      
      return true;
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  }, [selectedConversation, fetchMessages, fetchConversations, toast]);

  // Atualizar status
  const updateStatus = useCallback(async (conversationId: string, status: ConversationStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ status })
        .eq('id', conversationId);

      if (error) throw error;

      // Registrar na auditoria
      await supabase.from('whatsapp_audit_log').insert({
        user_id: user?.id,
        user_name: profile?.full_name,
        action: 'alterou_status',
        entity_type: 'conversation',
        entity_id: conversationId,
        details: { new_status: status }
      });

      await fetchConversations();

      toast({
        title: 'Status atualizado',
        description: `Status alterado para ${status}`
      });
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [fetchConversations, toast]);

  // Polling para atualização
  useEffect(() => {
    fetchConversations();
    
    const interval = setInterval(fetchConversations, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchConversations, refreshInterval]);

  // Realtime para mensagens
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as WhatsappMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  return {
    conversations,
    groupedConversations,
    selectedGroup,
    selectedConversation,
    selectedInstanceId,
    messages,
    loading,
    messagesLoading,
    selectGroup,
    switchInstance,
    sendMessage,
    updateStatus,
    refresh: fetchConversations,
    setSelectedGroup
  };
}
