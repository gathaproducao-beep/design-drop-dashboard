import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface InstanciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instancia?: any;
  onSuccess: () => void;
}

type ApiType = 'evolution' | 'oficial';

export const InstanciaDialog = ({ open, onOpenChange, instancia, onSuccess }: InstanciaDialogProps) => {
  const [nome, setNome] = useState(instancia?.nome || "");
  const [apiType, setApiType] = useState<ApiType>(instancia?.api_type || "evolution");
  
  // Campos Evolution API
  const [evolutionApiUrl, setEvolutionApiUrl] = useState(instancia?.evolution_api_url || "");
  const [evolutionApiKey, setEvolutionApiKey] = useState(instancia?.evolution_api_key || "");
  const [evolutionInstance, setEvolutionInstance] = useState(instancia?.evolution_instance || "");
  
  // Campos API Oficial
  const [phoneNumberId, setPhoneNumberId] = useState(instancia?.phone_number_id || "");
  const [wabaId, setWabaId] = useState(instancia?.waba_id || "");
  const [accessToken, setAccessToken] = useState(instancia?.access_token || "");
  
  const [isActive, setIsActive] = useState(instancia?.is_active ?? true);
  const [ordem, setOrdem] = useState(instancia?.ordem || 0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (instancia) {
        setNome(instancia.nome || "");
        setApiType(instancia.api_type || "evolution");
        setEvolutionApiUrl(instancia.evolution_api_url || "");
        setEvolutionApiKey(instancia.evolution_api_key || "");
        setEvolutionInstance(instancia.evolution_instance || "");
        setPhoneNumberId(instancia.phone_number_id || "");
        setWabaId(instancia.waba_id || "");
        setAccessToken(instancia.access_token || "");
        setIsActive(instancia.is_active ?? true);
        setOrdem(instancia.ordem || 0);
      } else {
        setNome("");
        setApiType("evolution");
        setEvolutionApiUrl("");
        setEvolutionApiKey("");
        setEvolutionInstance("");
        setPhoneNumberId("");
        setWabaId("");
        setAccessToken("");
        setIsActive(true);
        setOrdem(0);
      }
    }
  }, [open, instancia]);

  const handleSave = async () => {
    if (!nome) {
      toast.error("Nome da instância é obrigatório");
      return;
    }

    // Validar campos obrigatórios com base no tipo de API
    if (apiType === 'evolution') {
      if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
        toast.error("Preencha todos os campos da Evolution API");
        return;
      }
    } else {
      if (!phoneNumberId || !accessToken) {
        toast.error("Phone Number ID e Access Token são obrigatórios para API Oficial");
        return;
      }
    }

    setIsLoading(true);

    try {
      const data: any = {
        nome: nome.trim(),
        api_type: apiType,
        is_active: isActive,
        ordem: parseInt(ordem.toString()) || 0,
      };

      // Adicionar campos conforme o tipo de API
      if (apiType === 'evolution') {
        data.evolution_api_url = evolutionApiUrl.trim();
        data.evolution_api_key = evolutionApiKey.trim();
        data.evolution_instance = evolutionInstance.trim();
        // Limpar campos da API Oficial
        data.phone_number_id = null;
        data.waba_id = null;
        data.access_token = null;
      } else {
        data.phone_number_id = phoneNumberId.trim();
        data.waba_id = wabaId.trim() || null;
        data.access_token = accessToken.trim();
        // Manter campos Evolution vazios mas não nulos (por causa do constraint NOT NULL)
        data.evolution_api_url = evolutionApiUrl.trim() || '-';
        data.evolution_api_key = evolutionApiKey.trim() || '-';
        data.evolution_instance = evolutionInstance.trim() || '-';
      }

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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {instancia ? "Editar Instância" : "Adicionar Instância"}
          </DialogTitle>
          <DialogDescription>
            Configure uma instância para envio de mensagens WhatsApp
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
            <Label htmlFor="api-type">Tipo de API *</Label>
            <Select value={apiType} onValueChange={(value: ApiType) => setApiType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de API" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evolution">
                  <div className="flex items-center gap-2">
                    <span>Evolution API</span>
                    <span className="text-xs text-muted-foreground">(não-oficial)</span>
                  </div>
                </SelectItem>
                <SelectItem value="oficial">
                  <div className="flex items-center gap-2">
                    <span>API Oficial Meta</span>
                    <span className="text-xs text-muted-foreground">(Coexistence)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campos Evolution API */}
          {apiType === 'evolution' && (
            <>
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
            </>
          )}

          {/* Campos API Oficial */}
          {apiType === 'oficial' && (
            <>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">API Oficial do WhatsApp (Coexistence)</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Com Coexistence, você pode enviar mensagens pela API Oficial e ainda usar o WhatsApp Web para responder.
                      Obtenha as credenciais no Meta Business Suite.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-number-id">Phone Number ID *</Label>
                <Input
                  id="phone-number-id"
                  placeholder="Ex: 123456789012345"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontrado em Meta Business Suite → WhatsApp → Configurações da API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="waba-id">WABA ID (opcional)</Label>
                <Input
                  id="waba-id"
                  placeholder="Ex: 123456789012345"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  ID da conta WhatsApp Business API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-token">Access Token *</Label>
                <Input
                  id="access-token"
                  type="password"
                  placeholder="Token permanente do System User"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Token de acesso permanente gerado no Meta Business Suite
                </p>
              </div>
            </>
          )}

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
