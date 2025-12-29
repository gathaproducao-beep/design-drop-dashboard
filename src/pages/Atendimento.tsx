import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAtendimento } from '@/hooks/useAtendimento';
import { ConversationList } from '@/components/atendimento/ConversationList';
import { ChatArea } from '@/components/atendimento/ChatArea';
import { CustomerPanel } from '@/components/atendimento/CustomerPanel';
import { AtendimentoHeader } from '@/components/atendimento/AtendimentoHeader';
import { NewConversationDialog } from '@/components/atendimento/NewConversationDialog';
import { QuickRepliesDialog } from '@/components/atendimento/QuickRepliesDialog';
import { ConversationStatus } from '@/types/atendimento';
import { useIsMobile } from '@/hooks/use-mobile';

interface WhatsappInstance {
  id: string;
  nome: string;
  is_active: boolean;
}

interface Profile {
  id: string;
  full_name: string;
}

const Atendimento = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Filtros
  const [instanceFilter, setInstanceFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | null>(null);
  const [assignedFilter, setAssignedFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dados auxiliares
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Dialogs
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  
  // View control para mobile
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  
  const {
    conversations,
    selectedConversation,
    messages,
    loading,
    messagesLoading,
    selectConversation,
    sendMessage,
    updateStatus,
    refresh,
    setSelectedConversation
  } = useAtendimento({
    instanceFilter,
    statusFilter,
    assignedFilter,
    searchQuery,
    refreshInterval: 5000
  });

  // Buscar instâncias e perfis
  useEffect(() => {
    const fetchData = async () => {
      const [instancesRes, profilesRes] = await Promise.all([
        supabase.from('whatsapp_instances').select('id, nome, is_active'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true)
      ]);
      
      setInstances(instancesRes.data || []);
      setProfiles(profilesRes.data || []);
    };
    
    fetchData();
  }, []);

  // Handler para selecionar conversa
  const handleSelectConversation = async (conversation: typeof selectedConversation) => {
    if (conversation) {
      await selectConversation(conversation);
      if (isMobile) {
        setMobileView('chat');
      }
    }
  };

  // Handler para voltar (mobile)
  const handleBack = () => {
    setMobileView('list');
    setSelectedConversation(null);
  };

  // Handler para inserir template
  const handleInsertTemplate = (content: string) => {
    // O QuickRepliesDialog vai passar o conteúdo para o ChatArea
    setQuickRepliesOpen(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header com filtros */}
      <AtendimentoHeader
        instances={instances}
        profiles={profiles}
        instanceFilter={instanceFilter}
        statusFilter={statusFilter}
        assignedFilter={assignedFilter}
        searchQuery={searchQuery}
        onInstanceChange={setInstanceFilter}
        onStatusChange={setStatusFilter}
        onAssignedChange={setAssignedFilter}
        onSearchChange={setSearchQuery}
        onNewConversation={() => setNewConversationOpen(true)}
        onRefresh={refresh}
      />

      {/* Área principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de conversas */}
        {(!isMobile || mobileView === 'list') && (
          <div className={`${isMobile ? 'w-full' : 'w-80 border-r'} flex-shrink-0`}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversation?.id}
              loading={loading}
              onSelect={handleSelectConversation}
            />
          </div>
        )}

        {/* Área do chat */}
        {(!isMobile || mobileView === 'chat') && selectedConversation && (
          <>
            <div className="flex-1 flex flex-col min-w-0">
              <ChatArea
                conversation={selectedConversation}
                messages={messages}
                loading={messagesLoading}
                onSend={sendMessage}
                onStatusChange={(status) => updateStatus(selectedConversation.id, status)}
                onBack={isMobile ? handleBack : undefined}
                onQuickReply={() => setQuickRepliesOpen(true)}
              />
            </div>

            {/* Painel do cliente */}
            {!isMobile && (
              <div className="w-80 border-l flex-shrink-0">
                <CustomerPanel
                  contact={selectedConversation.contact}
                  conversationId={selectedConversation.id}
                />
              </div>
            )}
          </>
        )}

        {/* Placeholder quando não há conversa selecionada */}
        {!isMobile && !selectedConversation && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg">Selecione uma conversa</p>
              <p className="text-sm">ou inicie uma nova conversa</p>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        instances={instances}
        onSuccess={(conversationId) => {
          refresh();
          setNewConversationOpen(false);
        }}
      />

      <QuickRepliesDialog
        open={quickRepliesOpen}
        onOpenChange={setQuickRepliesOpen}
        onSelect={(content) => {
          // Este callback será usado para inserir o template no chat
          if (selectedConversation) {
            sendMessage(content);
          }
          setQuickRepliesOpen(false);
        }}
        contactName={selectedConversation?.contact?.name}
      />
    </div>
  );
};

export default Atendimento;
