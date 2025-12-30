import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Paperclip, X, Zap, Phone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GroupedConversation, WhatsappMessage, ConversationStatus, STATUS_LABELS, WhatsappConversation } from '@/types/atendimento';
import { MessageBubble } from './MessageBubble';
import { QuickReplyButtons } from './QuickReplyButtons';
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

  // Scroll para o final quando mensagens carregam ou mudam
  useEffect(() => {
    // Usa setTimeout para garantir que o DOM foi renderizado
    const timeoutId = setTimeout(() => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, loading]);

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
    <div className="flex flex-col h-full bg-[#efeae2]">
      {/* Header - estilo WhatsApp */}
      <div className="bg-[#f0f2f5] border-b border-[#d1d7db] px-4 py-2">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0 h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-[#111b21] truncate">
              {group.contact?.name || group.contact?.phone}
            </h2>
            <p className="text-xs text-[#667781] truncate">
              {group.contact?.phone}
            </p>
          </div>
          <Button 
            onClick={() => onStatusChange('finalizado')}
            className="bg-red-500 hover:bg-red-600 text-white font-medium h-9 px-4"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Finalizar Atendimento
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs h-8 bg-white border border-[#d1d7db] hover:bg-[#f5f6f6]">
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
        <div className="mt-2">
          {group.conversations.length > 1 ? (
            <Tabs 
              value={selectedInstanceId || group.conversations[0]?.instance_id || ''} 
              onValueChange={onSwitchInstance}
            >
              <TabsList className="h-8 w-full justify-start gap-1 bg-white/50 p-0.5 border border-[#d1d7db]">
                {group.conversations.map(conv => (
                  <TabsTrigger 
                    key={conv.id} 
                    value={conv.instance_id || ''}
                    className="text-xs h-7 px-3 data-[state=active]:bg-[#00a884] data-[state=active]:text-white gap-1.5 font-medium rounded"
                  >
                    <Phone className="h-3 w-3" />
                    {conv.instance?.nome || 'Sem número'}
                    {(conv.unread_count || 0) > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[10px] px-1 bg-red-500 text-white">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-white/60 rounded border border-[#d1d7db] text-xs text-[#667781]">
              <Phone className="h-3.5 w-3.5" />
              <span>Conversa via:</span>
              <span className="font-medium text-[#111b21]">
                {group.conversations[0]?.instance?.nome || 'Número não identificado'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages - fundo estilo WhatsApp */}
      <div 
        className="flex-1 overflow-hidden relative"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d4ccc0' fill-opacity='0.4'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#efeae2'
        }}
      >
        <ScrollArea className="h-full px-4 py-3" ref={scrollRef}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                  <Skeleton className="h-12 w-48 rounded-lg" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#667781]">
              <p className="text-sm bg-white/80 px-4 py-2 rounded-lg shadow-sm">Nenhuma mensagem ainda</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Preview de imagem */}
      {imagePreview && (
        <div className="bg-[#f0f2f5] border-t border-[#d1d7db] p-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src={imagePreview.url} 
                alt="Preview" 
                className="h-20 w-20 object-cover rounded-lg border border-[#d1d7db]"
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
              <p className="text-sm font-medium text-[#111b21]">Enviar imagem?</p>
              <p className="text-xs text-[#667781]">{imagePreview.file.name}</p>
            </div>
            <Button 
              onClick={sendImageFromPreview} 
              disabled={uploading}
              className="bg-[#00a884] hover:bg-[#008f72]"
            >
              {uploading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      )}

      {/* Input - estilo WhatsApp */}
      <div className="bg-[#f0f2f5] border-t border-[#d1d7db] px-4 py-2">
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
            className="flex-shrink-0 h-10 w-10 text-[#54656f] hover:bg-[#d9dbdc]"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onQuickReply} 
            title="Todas as respostas rápidas"
            className="flex-shrink-0 h-10 w-10 text-[#54656f] hover:bg-[#d9dbdc]"
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
            className="min-h-[42px] max-h-24 resize-none text-sm bg-white border-0 rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
            rows={1}
            disabled={uploading}
          />
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sending || uploading}
            size="icon"
            className="flex-shrink-0 h-10 w-10 bg-[#00a884] hover:bg-[#008f72] rounded-full"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Botões de respostas rápidas - abaixo do input */}
      <QuickReplyButtons 
        onSelect={(content) => setMessage(content)} 
        contactName={group.contact?.name}
      />
    </div>
  );
}
