import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NovoPerfilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NovoPerfilDialog = ({ open, onOpenChange }: NovoPerfilDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    permission_ids: [] as string[],
  });

  // Buscar permissões agrupadas por categoria
  const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category')
        .order('name');

      if (error) throw error;

      // Agrupar por categoria
      const grouped = data.reduce((acc: any, perm: any) => {
        if (!acc[perm.category]) {
          acc[perm.category] = [];
        }
        acc[perm.category].push(perm);
        return acc;
      }, {});

      return grouped;
    }
  });

  // Mutation para criar perfil
  const createPerfilMutation = useMutation({
    mutationFn: async () => {
      // 1. Criar perfil
      const { data: perfil, error: perfilError } = await supabase
        .from('access_profiles')
        .insert({
          code: formData.code.toLowerCase().replace(/\s+/g, '_'),
          name: formData.name,
          description: formData.description,
        })
        .select()
        .single();

      if (perfilError) throw perfilError;

      // 2. Associar permissões
      if (formData.permission_ids.length > 0) {
        const permsToInsert = formData.permission_ids.map(permId => ({
          access_profile_id: perfil.id,
          permission_id: permId,
        }));

        const { error: permsError } = await supabase
          .from('profile_permissions')
          .insert(permsToInsert);

        if (permsError) throw permsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso'] });
      toast.success("Perfil criado com sucesso!");
      onOpenChange(false);
      setFormData({
        code: "",
        name: "",
        description: "",
        permission_ids: [],
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar perfil");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createPerfilMutation.mutate();
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permId)
        ? prev.permission_ids.filter(id => id !== permId)
        : [...prev.permission_ids, permId]
    }));
  };

  const toggleCategory = (categoryPerms: any[]) => {
    const categoryPermIds = categoryPerms.map(p => p.id);
    const allSelected = categoryPermIds.every(id => formData.permission_ids.includes(id));

    setFormData(prev => ({
      ...prev,
      permission_ids: allSelected
        ? prev.permission_ids.filter(id => !categoryPermIds.includes(id))
        : [...new Set([...prev.permission_ids, ...categoryPermIds])]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Perfil de Acesso</DialogTitle>
            <DialogDescription>
              Crie um novo perfil e defina suas permissões
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="gerente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Gerente"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva as responsabilidades deste perfil"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="border rounded-lg p-4 space-y-4">
                {permissions && Object.entries(permissions).map(([category, perms]: [string, any]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox
                        id={`cat-${category}`}
                        checked={perms.every((p: any) => formData.permission_ids.includes(p.id))}
                        onCheckedChange={() => toggleCategory(perms)}
                      />
                      <Label htmlFor={`cat-${category}`} className="font-semibold cursor-pointer">
                        {category}
                      </Label>
                    </div>
                    <div className="pl-6 space-y-2">
                      {perms.map((perm: any) => (
                        <div key={perm.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={perm.id}
                            checked={formData.permission_ids.includes(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                          />
                          <Label htmlFor={perm.id} className="cursor-pointer flex-1">
                            <div>
                              <p className="text-sm font-medium">{perm.name}</p>
                              {perm.description && (
                                <p className="text-xs text-muted-foreground">
                                  {perm.description}
                                </p>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createPerfilMutation.isPending}>
              {createPerfilMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar Perfil
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NovoPerfilDialog;
