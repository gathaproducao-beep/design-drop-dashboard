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
import { Loader2, Settings, MessageSquare, AlertCircle, Plus, Edit, Trash2 } from "lucide-react";
import { TesteEnvioDialog } from "@/components/mensagens/TesteEnvioDialog";
import { InstanciaDialog } from "@/components/mensagens/InstanciaDialog";
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

interface WhatsappSettings {
  id: string;
  default_instance: string;
  test_phone: string | null;
  auto_send_enabled: boolean;
  delay_minimo: number;
  delay_maximo: number;
}

interface MensagemWhatsapp {
  id: string;
  nome: string;
  mensagem: string;
  type: string;
  is_active: boolean;
}

interface WhatsappInstance {
  id: string;
  nome: string;
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  is_active: boolean;
  ordem: number;
}

const ConfiguracoesWhatsapp = () => {
  const queryClient = useQueryClient();
  const [defaultInstance, setDefaultInstance] = useState("personalizado");
  const [testPhone, setTestPhone] = useState("");
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [delayMinimo, setDelayMinimo] = useState(5);
  const [delayMaximo, setDelayMaximo] = useState(15);
  const [testeDialogOpen, setTesteDialogOpen] = useState(false);
  const [mensagemSelecionada, setMensagemSelecionada] = useState<MensagemWhatsapp | null>(null);
  const [instanciaDialogOpen, setInstanciaDialogOpen] = useState(false);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<WhatsappInstance | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanciaParaDeletar, setInstanciaParaDeletar] = useState<string | null>(null);

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

  // Buscar instâncias
  const { data: instances, isLoading: loadingInstances } = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as WhatsappInstance[];
    },
  });

  // Atualizar estados quando carregar settings
  useEffect(() => {
    if (settings) {
      setDefaultInstance(settings.default_instance);
      setTestPhone(settings.test_phone || "");
      setAutoSendEnabled(settings.auto_send_enabled);
      setDelayMinimo(settings.delay_minimo || 5);
      setDelayMaximo(settings.delay_maximo || 15);
    }
  }, [settings]);

  // Mutation para salvar configurações
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<WhatsappSettings>) => {
      if (!settings?.id) {
        const { error } = await supabase
          .from("whatsapp_settings")
          .insert([data]);
        if (error) throw error;
      } else {
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

  // Mutation para alternar status da instância
  const toggleInstanceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "Status atualizado",
        description: "O status da instância foi alterado",
      });
    },
  });

  // Mutation para deletar instância
  const deleteInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({
        title: "Instância excluída",
        description: "A instância foi removida com sucesso",
      });
      setDeleteDialogOpen(false);
      setInstanciaParaDeletar(null);
    },
  });

  const handleSalvar = () => {
    saveMutation.mutate({
      default_instance: defaultInstance,
      test_phone: testPhone || null,
      auto_send_enabled: autoSendEnabled,
      delay_minimo: delayMinimo,
      delay_maximo: delayMaximo,
    });
  };

  const handleTestarMensagem = (mensagem: MensagemWhatsapp) => {
    setMensagemSelecionada(mensagem);
    setTesteDialogOpen(true);
  };

  const handleAddInstancia = () => {
    setInstanciaSelecionada(null);
    setInstanciaDialogOpen(true);
  };

  const handleEditInstancia = (instancia: WhatsappInstance) => {
    setInstanciaSelecionada(instancia);
    setInstanciaDialogOpen(true);
  };

  const handleDeleteInstancia = (id: string) => {
    setInstanciaParaDeletar(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (instanciaParaDeletar) {
      deleteInstanceMutation.mutate(instanciaParaDeletar);
    }
  };

  if (loadingSettings || loadingMensagens || loadingInstances) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Configurações WhatsApp</h1>
          <p className="text-muted-foreground">
            Configure instâncias, delays e templates de mensagens
          </p>
        </div>

        <div className="space-y-6">
          {/* Controle de Delay */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Controle de Delay entre Mensagens
              </CardTitle>
              <CardDescription>
                Defina o tempo de espera entre cada mensagem para evitar detecção como spam
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delay-min">Delay Mínimo (segundos)</Label>
                  <Input
                    id="delay-min"
                    type="number"
                    min="1"
                    max="60"
                    value={delayMinimo}
                    onChange={(e) => setDelayMinimo(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delay-max">Delay Máximo (segundos)</Label>
                  <Input
                    id="delay-max"
                    type="number"
                    min="1"
                    max="60"
                    value={delayMaximo}
                    onChange={(e) => setDelayMaximo(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                O sistema escolherá um tempo aleatório entre {delayMinimo}s e {delayMaximo}s para evitar padrões detectáveis
              </p>
            </CardContent>
          </Card>

          {/* Gerenciar Instâncias */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Instâncias Evolution API
                  </CardTitle>
                  <CardDescription>
                    Configure múltiplas instâncias para envio com fallback automático
                  </CardDescription>
                </div>
                <Button onClick={handleAddInstancia}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!instances || instances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma instância configurada</p>
                  <p className="text-sm mt-2">Adicione uma instância para começar a enviar mensagens</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {instances.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={inst.is_active}
                          onCheckedChange={(checked) =>
                            toggleInstanceMutation.mutate({ id: inst.id, isActive: checked })
                          }
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{inst.nome}</p>
                            <Badge variant={inst.is_active ? "default" : "secondary"}>
                              {inst.is_active ? "Ativa" : "Inativa"}
                            </Badge>
                            <Badge variant="outline">Ordem: {inst.ordem}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {inst.evolution_instance}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditInstancia(inst)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInstancia(inst.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações Antigas (mantidas para compatibilidade) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações Evolution API (Legado)
              </CardTitle>
              <CardDescription>
                Configurações antigas mantidas para compatibilidade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instance">Instância Padrão</Label>
                <Input
                  id="instance"
                  value={defaultInstance}
                  onChange={(e) => setDefaultInstance(e.target.value)}
                  placeholder="personalizado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-phone">Telefone para Testes</Label>
                <Input
                  id="test-phone"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="5546999999999"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Envio Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativar envio automático de mensagens (desabilitado)
                  </p>
                </div>
                <Switch
                  checked={autoSendEnabled}
                  onCheckedChange={setAutoSendEnabled}
                  disabled
                />
              </div>
            </CardContent>
          </Card>

          {/* Templates de Mensagens */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Templates de Mensagens
              </CardTitle>
              <CardDescription>
                Mensagens pré-configuradas disponíveis para envio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!mensagens || mensagens.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma mensagem cadastrada
                </p>
              ) : (
                <div className="space-y-3">
                  {mensagens.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{msg.nome}</p>
                          <Badge
                            variant={
                              msg.type === "aprovacao"
                                ? "default"
                                : msg.type === "molde"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {msg.type}
                          </Badge>
                          {msg.is_active && <Badge variant="outline">Ativo</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {msg.mensagem}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestarMensagem(msg)}
                      >
                        Testar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSalvar}
              disabled={saveMutation.isPending}
              size="lg"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Configurações"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {mensagemSelecionada && (
        <TesteEnvioDialog
          open={testeDialogOpen}
          onOpenChange={setTesteDialogOpen}
          mensagemTexto={mensagemSelecionada.mensagem}
          nomeMensagem={mensagemSelecionada.nome}
        />
      )}

      <InstanciaDialog
        open={instanciaDialogOpen}
        onOpenChange={setInstanciaDialogOpen}
        instancia={instanciaSelecionada}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta instância? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConfiguracoesWhatsapp;
