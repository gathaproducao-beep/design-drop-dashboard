import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { NovaMensagemDialog } from "./NovaMensagemDialog";
import { TesteEnvioDialog } from "./TesteEnvioDialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MensagemWhatsapp {
  id: string;
  nome: string;
  mensagem: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  partes_mensagem?: string[];
}

export const MensagensWhatsappTable = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testeDialogOpen, setTesteDialogOpen] = useState(false);
  const [editingMensagem, setEditingMensagem] = useState<MensagemWhatsapp | null>(null);
  const [testingMensagem, setTestingMensagem] = useState<MensagemWhatsapp | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ["mensagens-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MensagemWhatsapp[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mensagens_whatsapp")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensagens-whatsapp"] });
      toast.success("Mensagem excluída com sucesso!");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir mensagem");
      console.error(error);
    },
  });

  const handleEdit = (mensagem: MensagemWhatsapp) => {
    setEditingMensagem(mensagem);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMensagem(null);
  };

  const handleTestar = (mensagem: MensagemWhatsapp) => {
    setTestingMensagem(mensagem);
    setTesteDialogOpen(true);
  };

  const getTypeBadge = (type: string) => {
    if (type === "aprovacao") {
      return <Badge variant="default">Aprovação</Badge>;
    }
    return <Badge variant="secondary">Conclusão</Badge>;
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Templates de Mensagens</h2>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Mensagem
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prévia da Mensagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : mensagens?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma mensagem cadastrada. Clique em "Nova Mensagem" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                mensagens?.map((mensagem) => (
                  <TableRow key={mensagem.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {mensagem.nome}
                        {mensagem.partes_mensagem && mensagem.partes_mensagem.length > 1 && (
                          <Badge variant="outline" className="text-xs" title="Número de partes/mensagens">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {mensagem.partes_mensagem.length} partes
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(mensagem.type)}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {mensagem.mensagem}
                    </TableCell>
                    <TableCell>
                      {mensagem.is_active ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-500/10 text-gray-700 border-gray-500/20">
                          Inativa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleTestar(mensagem)}
                          title="Testar envio"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(mensagem)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(mensagem.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <NovaMensagemDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        editingMensagem={editingMensagem}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["mensagens-whatsapp"] });
          handleCloseDialog();
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Teste */}
      {testingMensagem && (
        <TesteEnvioDialog
          open={testeDialogOpen}
          onOpenChange={setTesteDialogOpen}
          mensagemTexto={testingMensagem.mensagem}
          nomeMensagem={testingMensagem.nome}
          mensagemId={testingMensagem.id}
        />
      )}
    </>
  );
};
