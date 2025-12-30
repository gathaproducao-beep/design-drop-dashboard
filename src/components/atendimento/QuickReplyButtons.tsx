import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface QuickReply {
  id: string;
  name: string;
  content: string;
  shortcut: string | null;
}

interface QuickReplyButtonsProps {
  onSelect: (content: string) => void;
  contactName?: string | null;
}

export function QuickReplyButtons({ onSelect, contactName }: QuickReplyButtonsProps) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReplies();
  }, []);

  const fetchReplies = async () => {
    const { data } = await supabase
      .from('whatsapp_quick_replies')
      .select('id, name, content, shortcut')
      .eq('is_active', true)
      .order('name')
      .limit(20);
    setReplies(data || []);
    setLoading(false);
  };

  const handleSelect = (reply: QuickReply) => {
    let content = reply.content;
    if (contactName) {
      content = content.replace(/{nome}/gi, contactName);
    }
    onSelect(content);
  };

  if (loading || replies.length === 0) return null;

  const visibleReplies = expanded ? replies : replies.slice(0, 5);

  return (
    <div className="bg-[#f0f2f5] px-4 py-2 border-t border-[#d1d7db]">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-3.5 w-3.5 text-[#667781]" />
        <span className="text-xs text-[#667781] font-medium">Respostas Rápidas:</span>
        {replies.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-xs text-[#667781] hover:text-[#111b21]"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Menos
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Mais ({replies.length - 5})
              </>
            )}
          </Button>
        )}
      </div>
      <ScrollArea className="w-full">
        <div className="flex flex-wrap gap-1.5">
          {visibleReplies.map(reply => (
            <Button
              key={reply.id}
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-white hover:bg-[#00a884] hover:text-white hover:border-[#00a884] transition-colors"
              onClick={() => handleSelect(reply)}
              title={reply.content}
            >
              {reply.shortcut ? `${reply.shortcut} - ` : ''}{reply.name}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
