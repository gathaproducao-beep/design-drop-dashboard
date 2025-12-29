import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GroupedConversation, STATUS_COLORS, STATUS_LABELS, ConversationStatus } from '@/types/atendimento';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, AlertCircle, Phone, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPhone } from '@/lib/whatsapp';

interface ConversationListProps {
  groupedConversations: GroupedConversation[];
  selectedPhone?: string;
  loading: boolean;
  onSelect: (group: GroupedConversation) => void;
  onFinalize: (group: GroupedConversation) => void;
  readFilter: 'all' | 'unread';
  onReadFilterChange: (value: 'all' | 'unread') => void;
}

export function ConversationList({ 
  groupedConversations, 
  selectedPhone, 
  loading, 
  onSelect, 
  onFinalize,
  readFilter,
  onReadFilterChange
}: ConversationListProps) {
  // Filtrar por lidas/não lidas
  const filteredConversations = readFilter === 'unread' 
    ? groupedConversations.filter(g => g.totalUnreadCount > 0)
    : groupedConversations;

  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filtro rápido */}
      <div className="p-2 border-b">
        <ToggleGroup 
          type="single" 
          value={readFilter} 
          onValueChange={(val) => val && onReadFilterChange(val as 'all' | 'unread')}
          className="w-full"
        >
          <ToggleGroupItem value="all" className="flex-1 text-xs h-8">
            Tudo
          </ToggleGroupItem>
          <ToggleGroupItem value="unread" className="flex-1 text-xs h-8">
            Não lidas
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-muted-foreground">
          <User className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-center text-sm">
            {readFilter === 'unread' ? 'Nenhuma conversa não lida' : 'Nenhuma conversa encontrada'}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredConversations.map(group => {
              const contact = group.contact;
              const isSelected = selectedPhone === group.contactPhone;
              const hasUnread = group.totalUnreadCount > 0;
              const instanceCount = group.conversations.length;
              const hasInactive = group.conversations.some(c => c.instance && !c.instance.is_active);

              return (
                <div
                  key={group.contactPhone}
                  className={cn(
                    "p-2.5 cursor-pointer hover:bg-muted/50 transition-colors",
                    isSelected && "bg-muted"
                  )}
                  onClick={() => onSelect(group)}
                >
                  <div className="flex gap-2.5">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {contact?.name?.[0]?.toUpperCase() || contact?.phone?.slice(-2) || '?'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={cn(
                          "font-medium text-sm truncate max-w-[100px]",
                          hasUnread && "font-bold"
                        )}>
                          {contact?.name || 'Desconhecido'}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {group.lastMessageAt && formatDistanceToNow(
                              new Date(group.lastMessageAt),
                              { addSuffix: false, locale: ptBR }
                            )}
                          </span>
                          {/* Botão Finalizar */}
                          {group.primaryStatus !== 'finalizado' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-60 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                onFinalize(group);
                              }}
                              title="Finalizar conversa"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Telefone formatado */}
                      <p className="text-[10px] text-muted-foreground">
                        {formatPhone(group.contactPhone)}
                      </p>

                      <div className="flex items-center justify-between gap-1.5 mt-0.5">
                        <p className={cn(
                          "text-xs text-muted-foreground truncate max-w-[130px]",
                          hasUnread && "text-foreground font-medium"
                        )}>
                          {group.lastMessagePreview || 'Sem mensagens'}
                        </p>
                        {hasUnread && (
                          <Badge variant="default" className="h-4 min-w-4 text-[10px] px-1 flex items-center justify-center rounded-full flex-shrink-0">
                            {group.totalUnreadCount}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-[10px] h-4 px-1 text-white",
                            STATUS_COLORS[group.primaryStatus]
                          )}
                        >
                          {STATUS_LABELS[group.primaryStatus]}
                        </Badge>

                        {group.conversations[0]?.assigned_profile && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 truncate max-w-[60px]">
                            {group.conversations[0].assigned_profile.full_name.split(' ')[0]}
                          </Badge>
                        )}

                        {instanceCount > 1 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-700 border-blue-200">
                            <Phone className="h-2.5 w-2.5 mr-0.5" />
                            {instanceCount}
                          </Badge>
                        )}

                        {hasInactive && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1">
                            <AlertCircle className="h-2.5 w-2.5" />
                          </Badge>
                        )}

                        {contact?.is_lead && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-300">
                            Lead
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
