import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InstanciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instancia?: any;
  onSuccess: () => void;
}

export const InstanciaDialog = ({ open, onOpenChange, instancia, onSuccess }: InstanciaDialogProps) => {
  const [nome, setNome] = useState(instancia?.nome || "");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState(instancia?.evolution_api_url || "");
  const [evolutionApiKey, setEvolutionApiKey] = useState(instancia?.evolution_api_key || "");
  const [evolutionInstance, setEvolutionInstance] = useState(instancia?.evolution_instance || "");
  const [isActive, setIsActive] = useState(instancia?.is_active ?? true);
  const [ordem, setOrdem] = useState(instancia?.ordem || 0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (instancia) {
        setNome(instancia.nome || "");
        setEvolutionApiUrl(instancia.evolution_api_url || "");
        setEvolutionApiKey(instancia.evolution_api_key || "");
        setEvolutionInstance(instancia.evolution_instance || "");
        setIsActive(instancia.is_active ?? true);
        setOrdem(instancia.ordem || 0);
      } else {
        setNome("");
        setEvolutionApiUrl("");
        setEvolutionApiKey("");
        setEvolutionInstance("");
        setIsActive(true);
        setOrdem(0);
      }
    }
  }, [open, instancia]);

  const handleSave = async () => {
    if (!nome || !evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        nome,
        evolution_api_url: evolutionApiUrl,
        evolution_api_key: evolutionApiKey,
        evolution_instance: evolutionInstance,
        is_active: isActive,
        ordem: parseInt(ordem.toString()) || 0,
      };

      if (instancia?.id) {
        // Atualizar
        const { error } = await supabase
          .from("whatsapp_instances")
          .update(data)
          .eq("id", instancia.id);

        if (error) throw error;
        toast.success("Instância atualizada com sucesso!");
      } else {
        // Criar
        const { error } = await supabase
          .from("whatsapp_instances")
          .insert([data]);

        if (error) throw error;
        toast.success("Instância criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar instância:", error);
      toast.error("Erro ao salvar instância: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {instancia ? "Editar Instância" : "Adicionar Instância"}
          </DialogTitle>
          <DialogDescription>
            Configure uma instância Evolution API para envio de mensagens
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Instância *</Label>
            <Input
              id="nome"
              placeholder="Ex: Principal, Backup"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL da Evolution API *</Label>
            <Input
              id="url"
              placeholder="https://..."
              value={evolutionApiUrl}
              onChange={(e) => setEvolutionApiUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apikey">API Key *</Label>
            <Input
              id="apikey"
              type="password"
              value={evolutionApiKey}
              onChange={(e) => setEvolutionApiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance">Nome da Instância Evolution *</Label>
            <Input
              id="instance"
              placeholder="personalizado"
              value={evolutionInstance}
              onChange={(e) => setEvolutionInstance(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ordem">Ordem de Prioridade</Label>
            <Input
              id="ordem"
              type="number"
              min="0"
              value={ordem}
              onChange={(e) => setOrdem(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Menor número = maior prioridade
            </p>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="active" className="cursor-pointer">
              Instância ativa
            </Label>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
