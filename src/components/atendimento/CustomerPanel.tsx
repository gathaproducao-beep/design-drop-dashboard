import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WhatsappContact } from '@/types/atendimento';
import { useCustomerPedidos } from '@/hooks/useCustomerPedidos';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, Package, CheckCircle, XCircle, Plus, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

interface CustomerPanelProps {
  contact?: WhatsappContact;
  conversationId: string;
}

export function CustomerPanel({ contact, conversationId }: CustomerPanelProps) {
  const { pedidos, loading, updatePedidoStatus } = useCustomerPedidos(contact?.phone || null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const { toast } = useToast();

  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('whatsapp_internal_notes').insert({
        conversation_id: conversationId,
        contact_id: contact?.id,
        user_id: user?.id,
        content: newNote.trim()
      });
      setNewNote('');
      toast({ title: 'Nota salva' });
    } catch (error) {
      toast({ title: 'Erro ao salvar nota', variant: 'destructive' });
    } finally {
      setSavingNote(false);
    }
  };

  const handleApprove = async (pedidoId: string) => {
    const success = await updatePedidoStatus(pedidoId, 'layout_aprovado', 'aprovado');
    if (success) toast({ title: 'Pedido aprovado' });
  };

  const handleReject = async (pedidoId: string) => {
    const success = await updatePedidoStatus(pedidoId, 'layout_aprovado', 'reprovado');
    if (success) toast({ title: 'Pedido reprovado' });
  };

  if (!contact) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Dados do contato */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{contact.name || 'Sem nome'}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {contact.phone}
            </div>
            {contact.is_lead && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Lead</Badge>
            )}
          </CardContent>
        </Card>

        {/* Pedidos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pedidos ({pedidos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido vinculado</p>
            ) : (
              pedidos.map(pedido => (
                <div key={pedido.id} className="border rounded p-2 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">#{pedido.numero_pedido}</p>
                      <p className="text-xs text-muted-foreground">{pedido.codigo_produto}</p>
                    </div>
                    <Badge variant={
                      pedido.layout_aprovado === 'aprovado' ? 'default' :
                      pedido.layout_aprovado === 'reprovado' ? 'destructive' : 'secondary'
                    }>
                      {pedido.layout_aprovado || 'pendente'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleApprove(pedido.id)}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleReject(pedido.id)}>
                      <XCircle className="h-3 w-3 mr-1" /> Reprovar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Notas internas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Nota Interna
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Adicionar observação..."
              rows={3}
            />
            <Button size="sm" onClick={handleSaveNote} disabled={!newNote.trim() || savingNote}>
              <Plus className="h-4 w-4 mr-1" /> Salvar Nota
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
