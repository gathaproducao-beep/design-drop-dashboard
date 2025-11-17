import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings, MessageSquare, AlertCircle } from "lucide-react";
import { TesteEnvioDialog } from "@/components/mensagens/TesteEnvioDialog";

interface WhatsappSettings {
  id: string;
  default_instance: string;
  test_phone: string | null;
  auto_send_enabled: boolean;
}

interface MensagemWhatsapp {
  id: string;
  nome: string;
  mensagem: string;
  type: string;
  is_active: boolean;
}

const ConfiguracoesWhatsapp = () => {
  const queryClient = useQueryClient();
  const [defaultInstance, setDefaultInstance] = useState("personalizado");
  const [testPhone, setTestPhone] = useState("");
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [testeDialogOpen, setTesteDialogOpen] = useState(false);
  const [mensagemSelecionada, setMensagemSelecionada] = useState<MensagemWhatsapp | null>(null);

  // Buscar configurações
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data as WhatsappSettings | null;
    },
  });

  // Buscar mensagens
  const { data: mensagens, isLoading: loadingMensagens } = useQuery({
    queryKey: ["mensagens-whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MensagemWhatsapp[];
    },
  });

  // Atualizar estados quando carregar settings
  useEffect(() => {
    if (settings) {
      setDefaultInstance(settings.default_instance);
      setTestPhone(settings.test_phone || "");
      setAutoSendEnabled(settings.auto_send_enabled);
    }
  }, [settings]);

  // Mutation para salvar configurações
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<WhatsappSettings>) => {
      if (!settings?.id) {
        // Criar novo registro
        const { error } = await supabase
          .from("whatsapp_settings")
          .insert([data]);
        if (error) throw error;
      } else {
        // Atualizar registro existente
        const { error } = await supabase
          .from("whatsapp_settings")
          .update(data)
          .eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações do WhatsApp foram atualizadas com sucesso",
      });
    },
    onError: (error) => {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    },
  });

  const handleSalvar = () => {
    saveMutation.mutate({
      default_instance: defaultInstance,
      test_phone: testPhone || null,
      auto_send_enabled: autoSendEnabled,
    });
  };

  const handleTestarMensagem = (mensagem: MensagemWhatsapp) => {
    setMensagemSelecionada(mensagem);
    setTesteDialogOpen(true);
  };

  const getTypeBadge = (type: string) => {
    if (type === "aprovacao") {
      return <Badge variant="default">Aprovação</Badge>;
    }
    return <Badge variant="secondary">Conclusão</Badge>;
  };

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto py-8 px-4 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configurações WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Configure a integração com a Evolution API e gerencie mensagens automáticas
          </p>
        </div>

        {/* Card de Configurações */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Configuração da Evolution API</CardTitle>
            <CardDescription>
              Configure os parâmetros de conexão com a Evolution API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Instância */}
            <div className="space-y-2">
              <Label htmlFor="instance">Instância Evolution</Label>
              <Input
                id="instance"
                value={defaultInstance}
                onChange={(e) => setDefaultInstance(e.target.value)}
                placeholder="personalizado"
              />
              <p className="text-xs text-muted-foreground">
                Nome da instância configurada na Evolution API
              </p>
            </div>

            {/* Telefone de Teste */}
            <div className="space-y-2">
              <Label htmlFor="testPhone">Telefone Padrão para Teste (Opcional)</Label>
              <Input
                id="testPhone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5546999999999"
              />
              <p className="text-xs text-muted-foreground">
                Número usado como padrão ao testar mensagens (formato: 5546999999999)
              </p>
            </div>

            {/* Envio Automático */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="autoSend">Envio Automático</Label>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  ⚠️ Envio automático ainda não implementado. Mantenha desativado.
                </p>
              </div>
              <Switch
                id="autoSend"
                checked={autoSendEnabled}
                onCheckedChange={setAutoSendEnabled}
                disabled
              />
            </div>

            {/* Botão Salvar */}
            <div className="pt-4">
              <Button 
                onClick={handleSalvar} 
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto"
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configurações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card de Templates de Mensagens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Templates de Mensagens
            </CardTitle>
            <CardDescription>
              Mensagens configuradas para envio via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMensagens ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : mensagens && mensagens.length > 0 ? (
              <div className="space-y-3">
                {mensagens.map((mensagem) => (
                  <div
                    key={mensagem.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{mensagem.nome}</h3>
                        {getTypeBadge(mensagem.type)}
                        {!mensagem.is_active && (
                          <Badge variant="outline" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {mensagem.mensagem}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestarMensagem(mensagem)}
                    >
                      Testar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum template de mensagem cadastrado
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Teste */}
      {mensagemSelecionada && (
        <TesteEnvioDialog
          open={testeDialogOpen}
          onOpenChange={setTesteDialogOpen}
          mensagemTexto={mensagemSelecionada.mensagem}
          nomeMensagem={mensagemSelecionada.nome}
        />
      )}
    </div>
  );
};

export default ConfiguracoesWhatsapp;
