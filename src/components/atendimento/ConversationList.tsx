import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WhatsappConversation, STATUS_COLORS, STATUS_LABELS } from '@/types/atendimento';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ConversationListProps {
  conversations: WhatsappConversation[];
  selectedId?: string;
  loading: boolean;
  onSelect: (conversation: WhatsappConversation) => void;
}

export function ConversationList({ conversations, selectedId, loading, onSelect }: ConversationListProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
        <User className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">Nenhuma conversa encontrada</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {conversations.map(conversation => {
          const contact = conversation.contact;
          const isSelected = selectedId === conversation.id;
          const hasUnread = (conversation.unread_count || 0) > 0;
          const instanceInactive = conversation.instance && !conversation.instance.is_active;

          return (
            <div
              key={conversation.id}
              className={cn(
                "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                isSelected && "bg-muted"
              )}
              onClick={() => onSelect(conversation)}
            >
              <div className="flex gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {contact?.name?.[0]?.toUpperCase() || contact?.phone?.slice(-2) || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "font-medium truncate",
                      hasUnread && "font-bold"
                    )}>
                      {contact?.name || contact?.phone || 'Desconhecido'}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {conversation.last_message_at && formatDistanceToNow(
                        new Date(conversation.last_message_at),
                        { addSuffix: true, locale: ptBR }
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className={cn(
                      "text-sm text-muted-foreground truncate",
                      hasUnread && "text-foreground font-medium"
                    )}>
                      {conversation.last_message_preview || 'Sem mensagens'}
                    </p>
                    {hasUnread && (
                      <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center rounded-full">
                        {conversation.unread_count}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-xs text-white",
                        STATUS_COLORS[conversation.status]
                      )}
                    >
                      {STATUS_LABELS[conversation.status]}
                    </Badge>

                    {conversation.assigned_profile && (
                      <Badge variant="outline" className="text-xs">
                        {conversation.assigned_profile.full_name}
                      </Badge>
                    )}

                    {instanceInactive && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Inativo
                      </Badge>
                    )}

                    {contact?.is_lead && (
                      <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
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
  );
}
