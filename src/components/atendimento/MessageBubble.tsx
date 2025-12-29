import { WhatsappMessage } from '@/types/atendimento';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';

interface MessageBubbleProps {
  message: WhatsappMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  
  const StatusIcon = () => {
    switch (message.status) {
      case 'pending': return <Clock className="h-3 w-3" />;
      case 'sent': return <Check className="h-3 w-3" />;
      case 'delivered': return <CheckCheck className="h-3 w-3" />;
      case 'read': return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'failed': return <AlertCircle className="h-3 w-3 text-destructive" />;
      default: return null;
    }
  };

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[70%] rounded-lg px-3 py-2",
        isOutbound ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {!isOutbound && message.sender_name && (
          <p className="text-xs font-medium mb-1 opacity-70">{message.sender_name}</p>
        )}
        
        {message.media_url && message.message_type === 'image' && (
          <img src={message.media_url} alt="" className="rounded max-w-full mb-2" />
        )}
        
        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        
        <div className={cn(
          "flex items-center gap-1 mt-1 text-xs",
          isOutbound ? "justify-end opacity-70" : "text-muted-foreground"
        )}>
          <span>{format(new Date(message.created_at), 'HH:mm')}</span>
          {isOutbound && <StatusIcon />}
        </div>
      </div>
    </div>
  );
}
