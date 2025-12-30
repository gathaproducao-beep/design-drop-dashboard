import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface QuickReply {
  id: string;
  name: string;
  content: string;
  category: string;
  shortcut: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const RespostasRapidas = () => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: 'geral',
    shortcut: '',
    is_active: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchReplies();
  }, []);

  const fetchReplies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_quick_replies')
      .select('*')
      .order('name');
    
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setReplies(data || []);
    }
    setLoading(false);
  };

  const handleOpenDialog = (reply?: QuickReply) => {
    if (reply) {
      setEditingReply(reply);
      setFormData({
        name: reply.name,
        content: reply.content,
        category: reply.category,
        shortcut: reply.shortcut || '',
        is_active: reply.is_active
      });
    } else {
      setEditingReply(null);
      setFormData({
        name: '',
        content: '',
        category: 'geral',
        shortcut: '',
        is_active: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({ title: 'Preencha nome e conteúdo', variant: 'destructive' });
      return;
    }

    const data = {
      name: formData.name.trim(),
      content: formData.content.trim(),
      category: formData.category.trim() || 'geral',
      shortcut: formData.shortcut.trim() || null,
      is_active: formData.is_active
    };

    let error;
    if (editingReply) {
      const result = await supabase
        .from('whatsapp_quick_replies')
        .update(data)
        .eq('id', editingReply.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('whatsapp_quick_replies')
        .insert(data);
      error = result.error;
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingReply ? 'Resposta atualizada' : 'Resposta criada' });
      setDialogOpen(false);
      fetchReplies();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta resposta rápida?')) return;

    const { error } = await supabase
      .from('whatsapp_quick_replies')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Resposta excluída' });
      fetchReplies();
    }
  };

  const handleToggleActive = async (reply: QuickReply) => {
    const { error } = await supabase
      .from('whatsapp_quick_replies')
      .update({ is_active: !reply.is_active })
      .eq('id', reply.id);

    if (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } else {
      fetchReplies();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Respostas Rápidas</h1>
            <p className="text-muted-foreground">Templates de mensagens para atendimento</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Nova Resposta
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Templates Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : replies.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhuma resposta cadastrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Atalho</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {replies.map(reply => (
                    <TableRow key={reply.id}>
                      <TableCell className="font-medium">{reply.name}</TableCell>
                      <TableCell className="max-w-md truncate">{reply.content}</TableCell>
                      <TableCell>{reply.category}</TableCell>
                      <TableCell>{reply.shortcut || '-'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={reply.is_active}
                          onCheckedChange={() => handleToggleActive(reply)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(reply)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(reply.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de criação/edição */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingReply ? 'Editar Resposta' : 'Nova Resposta'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Boas vindas"
                />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Digite o conteúdo da mensagem..."
                  rows={5}
                  id="content-textarea"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Inserir variável:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
                      const start = textarea?.selectionStart || formData.content.length;
                      const before = formData.content.substring(0, start);
                      const after = formData.content.substring(start);
                      setFormData({ ...formData, content: before + '{nome}' + after });
                    }}
                  >
                    {'{nome}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
                      const start = textarea?.selectionStart || formData.content.length;
                      const before = formData.content.substring(0, start);
                      const after = formData.content.substring(start);
                      setFormData({ ...formData, content: before + '{numero_pedido}' + after });
                    }}
                  >
                    {'{numero_pedido}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
                      const start = textarea?.selectionStart || formData.content.length;
                      const before = formData.content.substring(0, start);
                      const after = formData.content.substring(start);
                      setFormData({ ...formData, content: before + '{codigo_produto}' + after });
                    }}
                  >
                    {'{codigo_produto}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
                      const start = textarea?.selectionStart || formData.content.length;
                      const before = formData.content.substring(0, start);
                      const after = formData.content.substring(start);
                      setFormData({ ...formData, content: before + '{data_pedido}' + after });
                    }}
                  >
                    {'{data_pedido}'}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: atendimento"
                  />
                </div>
                <div>
                  <Label>Atalho (opcional)</Label>
                  <Input
                    value={formData.shortcut}
                    onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                    placeholder="Ex: /oi"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Ativo</Label>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingReply ? 'Salvar Alterações' : 'Criar Resposta'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RespostasRapidas;
