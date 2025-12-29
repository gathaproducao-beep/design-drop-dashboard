import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WhatsappConversation, WhatsappMessage, ConversationStatus } from '@/types/atendimento';
import { useToast } from '@/hooks/use-toast';

interface UseAtendimentoOptions {
  instanceFilter?: string | null;
  statusFilter?: ConversationStatus | null;
  assignedFilter?: string | null;
  searchQuery?: string;
  refreshInterval?: number;
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
  const [selectedConversation, setSelectedConversation] = useState<WhatsappConversation | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const { toast } = useToast();

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
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
    } finally {
      setLoading(false);
    }
  }, [instanceFilter, statusFilter, assignedFilter, searchQuery]);

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

      // Marcar como lida
      await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Selecionar conversa
  const selectConversation = useCallback(async (conversation: WhatsappConversation) => {
    setSelectedConversation(conversation);
    await fetchMessages(conversation.id);
  }, [fetchMessages]);

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

      // Recarregar mensagens
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
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, status } : null);
      }

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
  }, [fetchConversations, selectedConversation, toast]);

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
    selectedConversation,
    messages,
    loading,
    messagesLoading,
    selectConversation,
    sendMessage,
    updateStatus,
    refresh: fetchConversations,
    setSelectedConversation
  };
}
