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
import { Navigation } from '@/components/Navigation';
import { ConversationStatus, GroupedConversation } from '@/types/atendimento';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
  const [showFinalized, setShowFinalized] = useState(false);
  
  // Dados auxiliares
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Dialogs
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // View control para mobile
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  
  const {
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
    refresh,
    setSelectedGroup
  } = useAtendimento({
    instanceFilter,
    statusFilter,
    assignedFilter,
    searchQuery,
    hideFinalized: !showFinalized,
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

  // Handler para selecionar grupo de conversas
  const handleSelectGroup = async (group: GroupedConversation) => {
    await selectGroup(group);
    if (isMobile) {
      setMobileView('chat');
    }
  };

  // Handler para voltar (mobile)
  const handleBack = () => {
    setMobileView('list');
    setSelectedGroup(null);
  };

  // Handler para finalizar conversa
  const handleFinalize = async (group: GroupedConversation) => {
    for (const conv of group.conversations) {
      await updateStatus(conv.id, 'finalizado');
    }
  };

  // Handler para status filter incluindo finalizados
  const handleStatusFilterChange = (value: ConversationStatus | null) => {
    setStatusFilter(value);
    // Se selecionar "Todos os status" ou "Finalizado", mostrar finalizados
    setShowFinalized(value === null || value === 'finalizado');
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Menu recolhido */}
      <div className="border-b bg-card px-2 py-1.5 flex items-center gap-2">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Navigation />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-medium">Atendimento</span>
      </div>

      {/* Header com filtros */}
      <AtendimentoHeader
        instances={instances}
        profiles={profiles}
        instanceFilter={instanceFilter}
        statusFilter={statusFilter}
        assignedFilter={assignedFilter}
        searchQuery={searchQuery}
        onInstanceChange={setInstanceFilter}
        onStatusChange={handleStatusFilterChange}
        onAssignedChange={setAssignedFilter}
        onSearchChange={setSearchQuery}
        onNewConversation={() => setNewConversationOpen(true)}
        onRefresh={refresh}
      />

      {/* Área principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de conversas */}
        {(!isMobile || mobileView === 'list') && (
          <div className={`${isMobile ? 'w-full' : 'w-72 border-r'} flex-shrink-0`}>
            <ConversationList
              groupedConversations={groupedConversations}
              selectedPhone={selectedGroup?.contactPhone}
              loading={loading}
              onSelect={handleSelectGroup}
              onFinalize={handleFinalize}
              readFilter={readFilter}
              onReadFilterChange={setReadFilter}
            />
          </div>
        )}

        {/* Área do chat */}
        {(!isMobile || mobileView === 'chat') && selectedGroup && selectedConversation && (
          <>
            <div className="flex-1 flex flex-col min-w-0">
              <ChatArea
                group={selectedGroup}
                selectedConversation={selectedConversation}
                selectedInstanceId={selectedInstanceId}
                messages={messages}
                loading={messagesLoading}
                onSend={sendMessage}
                onStatusChange={(status) => updateStatus(selectedConversation.id, status)}
                onSwitchInstance={switchInstance}
                onBack={isMobile ? handleBack : undefined}
                onQuickReply={() => setQuickRepliesOpen(true)}
              />
            </div>

            {/* Painel do cliente */}
            {!isMobile && (
              <div className="w-72 border-l flex-shrink-0">
                <CustomerPanel
                  contact={selectedGroup.contact}
                  conversationId={selectedConversation.id}
                />
              </div>
            )}
          </>
        )}

        {/* Placeholder quando não há conversa selecionada */}
        {!isMobile && !selectedGroup && (
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
          if (selectedConversation) {
            sendMessage(content);
          }
          setQuickRepliesOpen(false);
        }}
        contactName={selectedGroup?.contact?.name}
      />
    </div>
  );
};

export default Atendimento;
