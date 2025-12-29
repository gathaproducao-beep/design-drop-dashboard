import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { WhatsappQuickReply } from '@/types/atendimento';
import { Search } from 'lucide-react';

interface QuickRepliesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (content: string) => void;
  contactName?: string | null;
}

export function QuickRepliesDialog({ open, onOpenChange, onSelect, contactName }: QuickRepliesDialogProps) {
  const [replies, setReplies] = useState<WhatsappQuickReply[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchReplies();
    }
  }, [open]);

  const fetchReplies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_quick_replies')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setReplies((data || []) as WhatsappQuickReply[]);
    setLoading(false);
  };

  const handleSelect = (reply: WhatsappQuickReply) => {
    let content = reply.content;
    if (contactName) {
      content = content.replace(/{nome}/gi, contactName);
    }
    onSelect(content);
  };

  const filtered = replies.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Respostas Rápidas</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-10"
          />
        </div>
        <ScrollArea className="h-[300px]">
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma resposta encontrada</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(reply => (
                <Button
                  key={reply.id}
                  variant="ghost"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => handleSelect(reply)}
                >
                  <div className="text-left">
                    <p className="font-medium">{reply.name}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                      {reply.content}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
