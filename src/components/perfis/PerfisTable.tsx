import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import NovoPerfilDialog from "./NovoPerfilDialog";
import EditarPerfilDialog from "./EditarPerfilDialog";
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

const PerfisTable = () => {
  const queryClient = useQueryClient();
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const [editarDialogOpen, setEditarDialogOpen] = useState(false);
  const [selectedPerfil, setSelectedPerfil] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [perfilToDelete, setPerfilToDelete] = useState<any>(null);

  // Buscar perfis com contagem de permissões
  const { data: perfis, isLoading } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_profiles')
        .select(`
          *,
          profile_permissions (
            id,
            permission_id,
            permissions (
              id,
              code,
              name,
              category
            )
          )
        `)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (perfilId: string) => {
      const { error } = await supabase
        .from('access_profiles')
        .delete()
        .eq('id', perfilId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso'] });
      toast.success("Perfil excluído com sucesso!");
      setDeleteDialogOpen(false);
      setPerfilToDelete(null);
    },
    onError: (error) => {
      console.error("Erro ao excluir perfil:", error);
      toast.error("Erro ao excluir perfil");
    },
  });

  const handleEdit = (perfil: any) => {
    if (perfil.is_system) {
      toast.error("Perfis do sistema não podem ser editados");
      return;
    }
    setSelectedPerfil(perfil);
    setEditarDialogOpen(true);
  };

  const handleDelete = (perfil: any) => {
    if (perfil.is_system) {
      toast.error("Perfis do sistema não podem ser deletados");
      return;
    }
    setPerfilToDelete(perfil);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (perfilToDelete) {
      deleteMutation.mutate(perfilToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {perfis?.length || 0} perfil(is) cadastrado(s)
        </p>
        <Button onClick={() => setNovoDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Perfil
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perfis?.map((perfil) => (
              <TableRow key={perfil.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {perfil.name}
                    {perfil.is_system && (
                      <Badge variant="outline" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Sistema
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-sm bg-muted px-2 py-1 rounded">{perfil.code}</code>
                </TableCell>
                <TableCell className="max-w-md truncate">
                  {perfil.description || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {perfil.profile_permissions?.length || 0} permissões
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(perfil)}
                      disabled={perfil.is_system}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(perfil)}
                      disabled={perfil.is_system}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NovoPerfilDialog open={novoDialogOpen} onOpenChange={setNovoDialogOpen} />
      
      {selectedPerfil && (
        <EditarPerfilDialog
          open={editarDialogOpen}
          onOpenChange={setEditarDialogOpen}
          perfil={selectedPerfil}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil "{perfilToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPerfilToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PerfisTable;
