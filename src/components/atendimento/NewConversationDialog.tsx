import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: { id: string; nome: string; is_active: boolean }[];
  onSuccess: (conversationId: string) => void;
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

export function NewConversationDialog({ open, onOpenChange, instances, onSuccess }: NewConversationDialogProps) {
  const [phone, setPhone] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!phone.trim()) {
      toast({ title: 'Digite um telefone', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone);

      // Buscar ou criar contato
      let { data: contact } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('phone', normalizedPhone)
        .single();

      if (!contact) {
        const { data: newContact, error } = await supabase
          .from('whatsapp_contacts')
          .insert({ phone: normalizedPhone, is_lead: true })
          .select()
          .single();
        if (error) throw error;
        contact = newContact;
      }

      // Buscar ou criar conversa
      let conversationQuery = supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('contact_id', contact.id);

      if (instanceId) {
        conversationQuery = conversationQuery.eq('instance_id', instanceId);
      }

      let { data: conversation } = await conversationQuery.single();

      if (!conversation) {
        const { data: newConv, error } = await supabase
          .from('whatsapp_conversations')
          .insert({
            contact_id: contact.id,
            instance_id: instanceId || null,
            status: 'novo'
          })
          .select()
          .single();
        if (error) throw error;
        conversation = newConv;
      }

      toast({ title: 'Conversa criada' });
      setPhone('');
      setInstanceId('');
      onSuccess(conversation.id);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 11999999999"
            />
          </div>
          <div>
            <Label>Número WhatsApp (opcional)</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um número" />
              </SelectTrigger>
              <SelectContent>
                {instances.filter(i => i.is_active).map(instance => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? 'Criando...' : 'Iniciar Conversa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
