import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Paperclip, Image, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GroupedConversation, WhatsappMessage, ConversationStatus, STATUS_LABELS, WhatsappConversation } from '@/types/atendimento';
import { MessageBubble } from './MessageBubble';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatAreaProps {
  group: GroupedConversation;
  selectedConversation: WhatsappConversation;
  selectedInstanceId: string | null;
  messages: WhatsappMessage[];
  loading: boolean;
  onSend: (content: string, mediaUrl?: string, type?: string) => Promise<boolean>;
  onStatusChange: (status: ConversationStatus) => void;
  onSwitchInstance: (instanceId: string) => void;
  onBack?: () => void;
  onQuickReply: () => void;
}

export function ChatArea({ 
  group, 
  selectedConversation, 
  selectedInstanceId, 
  messages, 
  loading, 
  onSend, 
  onStatusChange, 
  onSwitchInstance,
  onBack, 
  onQuickReply 
}: ChatAreaProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    const success = await onSend(message.trim());
    if (success) setMessage('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Upload de imagem
  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Apenas imagens são permitidas',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `chat-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('mockup-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('mockup-images')
        .getPublicUrl(filePath);

      // Enviar como mensagem de imagem
      await onSend('', publicUrl, 'image');
      
      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi enviada com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro no upload',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  }, [onSend, toast]);

  // Handler para colar imagem
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadImage(file);
        }
        break;
      }
    }
  }, [uploadImage]);

  // Handler para selecionar arquivo
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadImage(file);
    }
    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-3 bg-card">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate text-sm">
              {group.contact?.name || group.contact?.phone}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {group.contact?.phone}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                {STATUS_LABELS[selectedConversation.status]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => onStatusChange(key as ConversationStatus)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Abas de instâncias */}
        {group.conversations.length > 1 && (
          <Tabs 
            value={selectedInstanceId || group.conversations[0]?.instance_id || ''} 
            onValueChange={onSwitchInstance}
            className="mt-2"
          >
            <TabsList className="h-8 w-full justify-start overflow-x-auto">
              {group.conversations.map(conv => (
                <TabsTrigger 
                  key={conv.id} 
                  value={conv.instance_id || ''}
                  className="text-xs h-7 px-3 relative"
                >
                  {conv.instance?.nome || 'Sem número'}
                  {(conv.unread_count || 0) > 0 && (
                    <span className="ml-1.5 h-4 min-w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                      {conv.unread_count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className="h-12 w-48 rounded-lg" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 bg-card">
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Anexar imagem"
            className="flex-shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onQuickReply} 
            title="Respostas rápidas"
            className="flex-shrink-0"
          >
            <Zap className="h-5 w-5" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={uploading ? "Enviando imagem..." : "Digite sua mensagem... (cole imagens aqui)"}
            className="min-h-[40px] max-h-24 resize-none text-sm"
            rows={1}
            disabled={uploading}
          />
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sending || uploading}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
