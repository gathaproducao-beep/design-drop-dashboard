import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Paperclip, X, Zap, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
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

  // Mostrar preview de imagem
  const showImagePreview = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Apenas imagens são permitidas',
        variant: 'destructive'
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setImagePreview({ file, url });
  }, [toast]);

  // Cancelar preview
  const cancelImagePreview = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview.url);
      setImagePreview(null);
    }
  }, [imagePreview]);

  // Enviar imagem do preview
  const sendImageFromPreview = useCallback(async () => {
    if (!imagePreview) return;

    setUploading(true);
    try {
      const file = imagePreview.file;
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

      await onSend('', publicUrl, 'image');
      
      cancelImagePreview();
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
  }, [imagePreview, onSend, cancelImagePreview, toast]);

  // Handler para colar imagem
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          showImagePreview(file);
        }
        break;
      }
    }
  }, [showImagePreview]);

  // Handler para selecionar arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      showImagePreview(file);
    }
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

        {/* Abas de instâncias - sempre mostrar para identificar qual número */}
        <div className="mt-2">
          {group.conversations.length > 1 ? (
            <Tabs 
              value={selectedInstanceId || group.conversations[0]?.instance_id || ''} 
              onValueChange={onSwitchInstance}
            >
              <TabsList className="h-9 w-full justify-start gap-1 bg-muted/50 p-1">
                {group.conversations.map(conv => (
                  <TabsTrigger 
                    key={conv.id} 
                    value={conv.instance_id || ''}
                    className="text-xs h-7 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md gap-1.5 font-medium"
                  >
                    <Phone className="h-3 w-3" />
                    {conv.instance?.nome || 'Sem número'}
                    {(conv.unread_count || 0) > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[10px] px-1 bg-destructive text-destructive-foreground">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            /* Mostrar qual instância mesmo quando há apenas uma */
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-md text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span>Conversa via:</span>
              <Badge variant="secondary" className="font-medium">
                {group.conversations[0]?.instance?.nome || 'Número não identificado'}
              </Badge>
            </div>
          )}
        </div>
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

      {/* Preview de imagem */}
      {imagePreview && (
        <div className="border-t p-3 bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={imagePreview.url} 
                alt="Preview" 
                className="h-20 w-20 object-cover rounded-lg border"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={cancelImagePreview}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Enviar imagem?</p>
              <p className="text-xs text-muted-foreground">{imagePreview.file.name}</p>
            </div>
            <Button onClick={sendImageFromPreview} disabled={uploading}>
              {uploading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      )}

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
