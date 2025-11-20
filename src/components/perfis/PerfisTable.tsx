import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import NovoPerfilDialog from "./NovoPerfilDialog";
import EditarPerfilDialog from "./EditarPerfilDialog";

const PerfisTable = () => {
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const [editarDialogOpen, setEditarDialogOpen] = useState(false);
  const [selectedPerfil, setSelectedPerfil] = useState<any>(null);

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
    toast.info("Funcionalidade em desenvolvimento");
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
    </div>
  );
};

export default PerfisTable;
