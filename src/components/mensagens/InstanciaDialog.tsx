import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, Webhook } from "lucide-react";

interface InstanciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instancia?: any;
  onSuccess: () => void;
}

type ApiType = 'evolution' | 'webhook';

export const InstanciaDialog = ({ open, onOpenChange, instancia, onSuccess }: InstanciaDialogProps) => {
  const [nome, setNome] = useState(instancia?.nome || "");
  const [apiType, setApiType] = useState<ApiType>(instancia?.api_type || "evolution");
  
  // Campos Evolution API
  const [evolutionApiUrl, setEvolutionApiUrl] = useState(instancia?.evolution_api_url || "");
  const [evolutionApiKey, setEvolutionApiKey] = useState(instancia?.evolution_api_key || "");
  const [evolutionInstance, setEvolutionInstance] = useState(instancia?.evolution_instance || "");
  
  // Campos Webhook
  const [webhookUrl, setWebhookUrl] = useState(instancia?.webhook_url || "");
  const [webhookHeaders, setWebhookHeaders] = useState(
    instancia?.webhook_headers ? JSON.stringify(instancia.webhook_headers, null, 2) : ""
  );
  
  const [isActive, setIsActive] = useState(instancia?.is_active ?? true);
  const [ordem, setOrdem] = useState(instancia?.ordem || 0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (instancia) {
        setNome(instancia.nome || "");
        // Migrar instâncias antigas do tipo "oficial" para "evolution"
        const currentApiType = instancia.api_type === 'oficial' ? 'evolution' : (instancia.api_type || "evolution");
        setApiType(currentApiType as ApiType);
        setEvolutionApiUrl(instancia.evolution_api_url || "");
        setEvolutionApiKey(instancia.evolution_api_key || "");
        setEvolutionInstance(instancia.evolution_instance || "");
        setWebhookUrl(instancia.webhook_url || "");
        setWebhookHeaders(
          instancia.webhook_headers ? JSON.stringify(instancia.webhook_headers, null, 2) : ""
        );
        setIsActive(instancia.is_active ?? true);
        setOrdem(instancia.ordem || 0);
      } else {
        setNome("");
        setApiType("evolution");
        setEvolutionApiUrl("");
        setEvolutionApiKey("");
        setEvolutionInstance("");
        setWebhookUrl("");
        setWebhookHeaders("");
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
    } else if (apiType === 'webhook') {
      if (!webhookUrl) {
        toast.error("URL do Webhook é obrigatória");
        return;
      }
      
      // Validar headers JSON se preenchido
      if (webhookHeaders.trim()) {
        try {
          JSON.parse(webhookHeaders);
        } catch (e) {
          toast.error("Headers customizados devem ser um JSON válido");
          return;
        }
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
        data.webhook_url = null;
        data.webhook_headers = null;
      } else if (apiType === 'webhook') {
        data.webhook_url = webhookUrl.trim();
        data.webhook_headers = webhookHeaders.trim() ? JSON.parse(webhookHeaders) : {};
        // Manter campos Evolution com valores placeholder (constraint NOT NULL)
        data.evolution_api_url = '-';
        data.evolution_api_key = '-';
        data.evolution_instance = '-';
      }

      if (instancia?.id) {
        const { error } = await supabase
          .from("whatsapp_instances")
          .update(data)
          .eq("id", instancia.id);

        if (error) throw error;
        toast.success("Instância atualizada com sucesso!");
      } else {
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
                    <span className="text-xs text-muted-foreground">(WhatsApp não-oficial)</span>
                  </div>
                </SelectItem>
                <SelectItem value="webhook">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    <span>Webhook</span>
                    <span className="text-xs text-muted-foreground">(Ferramenta externa)</span>
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

          {/* Campos Webhook */}
          {apiType === 'webhook' && (
            <>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Envio via Webhook</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Os dados da mensagem serão enviados para a URL configurada. 
                      Use ferramentas como n8n, Zapier ou Make para processar e enviar via WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL do Webhook *</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://seu-webhook.com/endpoint"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL que receberá os dados via POST
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-headers">Headers Customizados (opcional)</Label>
                <Textarea
                  id="webhook-headers"
                  placeholder={'{\n  "Authorization": "Bearer seu_token",\n  "X-Custom-Header": "valor"\n}'}
                  value={webhookHeaders}
                  onChange={(e) => setWebhookHeaders(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  JSON com headers adicionais para autenticação
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-2">Dados enviados no webhook:</p>
                <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
{`{
  "phone": "5511999999999",
  "message": "Texto da mensagem",
  "image_url": "https://...",
  "pedido": {
    "numero_pedido": "12345",
    "nome_cliente": "João Silva",
    "codigo_produto": "CANECA-001",
    "data_pedido": "2024-12-12"
  },
  "instance_name": "Nome da instância"
}`}
                </pre>
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
