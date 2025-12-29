import { WhatsappMessage } from '@/types/atendimento';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, CheckCheck, Clock, AlertCircle, Image, FileText, Mic, Video, Download } from 'lucide-react';

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

  // Renderizar mídia baseado no tipo
  const renderMedia = () => {
    if (!message.media_url) return null;

    const mediaType = message.message_type;

    if (mediaType === 'image') {
      return (
        <img 
          src={message.media_url} 
          alt={message.caption || 'Imagem'} 
          className="rounded max-w-full max-h-64 mb-2 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(message.media_url!, '_blank')}
          onError={(e) => {
            // Fallback se a imagem não carregar
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement?.querySelector('.media-fallback')?.classList.remove('hidden');
          }}
        />
      );
    }

    if (mediaType === 'video') {
      return (
        <video 
          src={message.media_url} 
          controls 
          className="rounded max-w-full max-h-64 mb-2"
        />
      );
    }

    if (mediaType === 'audio') {
      return (
        <audio 
          src={message.media_url} 
          controls 
          className="mb-2 max-w-full"
        />
      );
    }

    if (mediaType === 'document') {
      return (
        <a 
          href={message.media_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded bg-background/50 hover:bg-background/70 transition-colors mb-2"
        >
          <FileText className="h-5 w-5" />
          <span className="text-sm underline">{message.content || 'Documento'}</span>
          <Download className="h-4 w-4 ml-auto" />
        </a>
      );
    }

    // Fallback para outros tipos de mídia
    return (
      <a 
        href={message.media_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 rounded bg-background/50 hover:bg-background/70 transition-colors mb-2"
      >
        <Download className="h-5 w-5" />
        <span className="text-sm underline">Baixar arquivo</span>
      </a>
    );
  };

  // Ícone de fallback para mídia
  const renderMediaFallback = () => {
    const mediaType = message.message_type;
    let Icon = Image;
    let label = 'Mídia não disponível';

    if (mediaType === 'audio') {
      Icon = Mic;
      label = 'Áudio';
    } else if (mediaType === 'video') {
      Icon = Video;
      label = 'Vídeo';
    } else if (mediaType === 'document') {
      Icon = FileText;
      label = message.content || 'Documento';
    }

    return (
      <div className="media-fallback hidden flex items-center gap-2 p-3 rounded bg-background/30 mb-2">
        <Icon className="h-5 w-5 opacity-60" />
        <span className="text-sm opacity-60">{label}</span>
      </div>
    );
  };

  // Verificar se tem conteúdo de texto para exibir (não é só placeholder de mídia)
  const hasTextContent = message.content && 
    !['[Imagem]', '[Áudio]', '[Vídeo]', '[Sticker]', '[Documento]'].includes(message.content);

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[70%] rounded-lg px-3 py-2",
        isOutbound ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {!isOutbound && message.sender_name && (
          <p className="text-xs font-medium mb-1 opacity-70">{message.sender_name}</p>
        )}
        
        {/* Renderizar mídia */}
        {renderMedia()}
        {renderMediaFallback()}
        
        {/* Texto/caption */}
        {hasTextContent && (
          <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        )}
        {message.caption && message.caption !== message.content && (
          <p className="whitespace-pre-wrap break-words text-sm">{message.caption}</p>
        )}
        
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
