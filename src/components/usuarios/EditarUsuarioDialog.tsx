import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditarUsuarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

const EditarUsuarioDialog = ({ open, onOpenChange, user }: EditarUsuarioDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    whatsapp: "",
    is_active: true,
    access_profile_ids: [] as string[],
  });

  // Buscar perfis de acesso
  const { data: profiles } = useQuery({
    queryKey: ['access-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_profiles')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Inicializar formulário com dados do usuário
  useEffect(() => {
    if (user && open) {
      setFormData({
        email: user.email || "",
        password: "",
        full_name: user.full_name || "",
        whatsapp: user.whatsapp || "",
        is_active: user.is_active ?? true,
        access_profile_ids: user.user_roles?.map((role: any) => role.access_profile_id) || [],
      });
    }
  }, [user, open]);

  // Mutation para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const updateData: any = {
        user_id: user.id,
        email: formData.email,
        full_name: formData.full_name,
        whatsapp: formData.whatsapp,
        is_active: formData.is_active,
        access_profile_ids: formData.access_profile_ids,
      };

      // Só enviar senha se foi preenchida
      if (formData.password) {
        updateData.password = formData.password;
      }

      const { error } = await supabase.functions.invoke('update-user', {
        body: updateData,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success("Usuário atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar usuário");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.full_name) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.access_profile_ids.length === 0) {
      toast.error("Selecione pelo menos um perfil de acesso");
      return;
    }

    updateUserMutation.mutate();
  };

  const toggleProfile = (profileId: string) => {
    setFormData(prev => ({
      ...prev,
      access_profile_ids: prev.access_profile_ids.includes(profileId)
        ? prev.access_profile_ids.filter(id => id !== profileId)
        : [...prev.access_profile_ids, profileId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados do usuário. Deixe a senha em branco para mantê-la.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="usuario@exemplo.com"
              />
              <p className="text-xs text-muted-foreground">
                ⚠️ Alterar o email pode requerer nova verificação
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-full_name">Nome Completo *</Label>
              <Input
                id="edit-full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="João Silva"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp">WhatsApp</Label>
              <Input
                id="edit-whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="(11) 98765-4321"
              />
            </div>

            <div className="space-y-2">
              <Label>Perfis de Acesso *</Label>
              <div className="border rounded-lg p-4 space-y-2">
                {profiles?.map((profile) => (
                  <div key={profile.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${profile.id}`}
                      checked={formData.access_profile_ids.includes(profile.id)}
                      onCheckedChange={() => toggleProfile(profile.id)}
                    />
                    <Label htmlFor={`edit-${profile.id}`} className="cursor-pointer flex-1">
                      <div>
                        <p className="font-medium">{profile.name}</p>
                        {profile.description && (
                          <p className="text-sm text-muted-foreground">
                            {profile.description}
                          </p>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditarUsuarioDialog;
