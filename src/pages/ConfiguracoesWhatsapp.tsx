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
import { Loader2, Settings, MessageSquare, AlertCircle, Plus, Edit, Trash2, Copy, Wifi, WifiOff, RefreshCw } from "lucide-react";
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
  envio_pausado: boolean;
  usar_todas_instancias: boolean;
  mensagens_por_instancia: number;
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
  api_type: 'evolution' | 'oficial';
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  phone_number_id?: string;
  waba_id?: string;
  access_token?: string;
  is_active: boolean;
  ordem: number;
}

interface InstanceStatus {
  id: string;
  nome: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'checking';
  message?: string;
}

const ConfiguracoesWhatsapp = () => {
  const queryClient = useQueryClient();
  const [defaultInstance, setDefaultInstance] = useState("personalizado");
  const [testPhone, setTestPhone] = useState("");
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [envioPausado, setEnvioPausado] = useState(false);
  const [delayMinimo, setDelayMinimo] = useState(5);
  const [delayMaximo, setDelayMaximo] = useState(15);
  const [usarTodasInstancias, setUsarTodasInstancias] = useState(false);
  const [mensagensPorInstancia, setMensagensPorInstancia] = useState(5);
  const [testeDialogOpen, setTesteDialogOpen] = useState(false);
  const [mensagemSelecionada, setMensagemSelecionada] = useState<MensagemWhatsapp | null>(null);
  const [instanciaDialogOpen, setInstanciaDialogOpen] = useState(false);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<WhatsappInstance | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanciaParaDeletar, setInstanciaParaDeletar] = useState<string | null>(null);
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, InstanceStatus>>({});
  const [checkingStatuses, setCheckingStatuses] = useState(false);

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

  // Verificar status de conexão das instâncias
  const checkInstancesStatus = async () => {
    if (!instances || instances.length === 0) return;
    
    setCheckingStatuses(true);
    
    // Marcar todas como "checking"
    const checking: Record<string, InstanceStatus> = {};
    instances.forEach(inst => {
      checking[inst.id] = { id: inst.id, nome: inst.nome, status: 'checking' };
    });
    setInstanceStatuses(checking);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-instance-status');
      
      if (error) {
        console.error('Erro ao verificar status:', error);
        toast({
          title: "Erro ao verificar conexões",
          description: "Não foi possível verificar o status das instâncias",
          variant: "destructive",
        });
        return;
      }
      
      const statuses: Record<string, InstanceStatus> = {};
      if (data?.statuses) {
        data.statuses.forEach((s: InstanceStatus) => {
          statuses[s.id] = s;
        });
      }
      setInstanceStatuses(statuses);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setCheckingStatuses(false);
    }
  };

  // Atualizar estados quando carregar settings
  useEffect(() => {
    if (settings) {
      setDefaultInstance(settings.default_instance);
      setTestPhone(settings.test_phone || "");
      setAutoSendEnabled(settings.auto_send_enabled);
      setEnvioPausado(settings.envio_pausado || false);
      setDelayMinimo(settings.delay_minimo || 5);
      setDelayMaximo(settings.delay_maximo || 15);
      setUsarTodasInstancias(settings.usar_todas_instancias || false);
      setMensagensPorInstancia(settings.mensagens_por_instancia || 5);
    }
  }, [settings]);

  // Verificar status automaticamente ao carregar instâncias
  useEffect(() => {
    if (instances && instances.length > 0) {
      checkInstancesStatus();
    }
  }, [instances]);

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
      envio_pausado: envioPausado,
      delay_minimo: delayMinimo,
      delay_maximo: delayMaximo,
      usar_todas_instancias: usarTodasInstancias,
      mensagens_por_instancia: mensagensPorInstancia,
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

  const handleDuplicarInstancia = (instancia: WhatsappInstance) => {
    // Criar cópia sem o ID para que seja tratada como nova instância
    const copia = {
      ...instancia,
      id: undefined,
      nome: `${instancia.nome} (cópia)`,
      ordem: (instancia.ordem || 0) + 1,
    };
    setInstanciaSelecionada(copia as any);
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

          {/* Controle de Pausa */}
          <Card className={envioPausado ? "border-destructive" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className={`h-5 w-5 ${envioPausado ? "text-destructive" : ""}`} />
                Controle de Envio
              </CardTitle>
              <CardDescription>
                {envioPausado 
                  ? "⏸️ Envio pausado - Nenhuma mensagem será enviada até reativar"
                  : "▶️ Envio ativo - Mensagens na fila serão processadas normalmente"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="pausar-envio" className="text-base">
                    Pausar Envio de Mensagens
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Pausa imediatamente o processamento da fila. Use em caso de emergência ou problemas.
                  </p>
                </div>
                <Switch
                  id="pausar-envio"
                  checked={envioPausado}
                  onCheckedChange={setEnvioPausado}
                />
              </div>
              {envioPausado && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ Atenção: Todas as mensagens na fila estão pausadas. 
                    Nenhuma mensagem será enviada até você desativar esta opção.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gerenciar Instâncias */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Instâncias WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Configure múltiplas instâncias (Evolution API ou API Oficial Meta) para envio com fallback automático
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={checkInstancesStatus} disabled={checkingStatuses}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${checkingStatuses ? 'animate-spin' : ''}`} />
                    Verificar Conexões
                  </Button>
                  <Button onClick={handleAddInstancia}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alerta de instâncias desconectadas */}
              {Object.values(instanceStatuses).some(s => 
                s.status === 'disconnected' && instances?.find(i => i.id === s.id)?.is_active
              ) && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
                  <WifiOff className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Instância desconectada detectada!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Uma ou mais instâncias ativas estão desconectadas. Verifique o QR Code na Evolution API.
                    </p>
                  </div>
                </div>
              )}

              {/* Opção de rotação entre instâncias */}
              <div className="border rounded-lg p-4 bg-accent/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-1">
                    <Label htmlFor="usar-todas-instancias" className="text-base font-medium">
                      Usar todas as instâncias ativas
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Distribui as mensagens entre todas as instâncias ativas, rotacionando após enviar o número definido de mensagens em cada uma
                    </p>
                  </div>
                  <Switch
                    id="usar-todas-instancias"
                    checked={usarTodasInstancias}
                    onCheckedChange={setUsarTodasInstancias}
                  />
                </div>
                
                {usarTodasInstancias && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="mensagens-por-instancia">Mensagens por instância antes de rotacionar</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="mensagens-por-instancia"
                        type="number"
                        min="1"
                        max="50"
                        value={mensagensPorInstancia}
                        onChange={(e) => setMensagensPorInstancia(parseInt(e.target.value) || 1)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        mensagens
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Em caso de erro, o sistema automaticamente tenta na próxima instância ativa
                    </p>
                  </div>
                )}
              </div>
              {!instances || instances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma instância configurada</p>
                  <p className="text-sm mt-2">Adicione uma instância para começar a enviar mensagens</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {instances.map((inst) => {
                    const connectionStatus = instanceStatuses[inst.id];
                    const getConnectionBadge = () => {
                      if (!connectionStatus || connectionStatus.status === 'checking') {
                        return (
                          <Badge variant="outline" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Verificando...
                          </Badge>
                        );
                      }
                      switch (connectionStatus.status) {
                        case 'connected':
                          return (
                            <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                              <Wifi className="h-3 w-3" />
                              Conectado
                            </Badge>
                          );
                        case 'disconnected':
                          return (
                            <Badge variant="destructive" className="gap-1">
                              <WifiOff className="h-3 w-3" />
                              Desconectado
                            </Badge>
                          );
                        case 'connecting':
                          return (
                            <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Conectando...
                            </Badge>
                          );
                        default:
                          return (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Erro
                            </Badge>
                          );
                      }
                    };

                    return (
                      <div
                        key={inst.id}
                        className={`flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors ${
                          connectionStatus?.status === 'disconnected' && inst.is_active 
                            ? 'border-destructive/50' 
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={inst.is_active}
                            onCheckedChange={(checked) =>
                              toggleInstanceMutation.mutate({ id: inst.id, isActive: checked })
                            }
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{inst.nome}</p>
                              <Badge 
                                variant={inst.api_type === 'oficial' ? 'default' : 'secondary'}
                                className={inst.api_type === 'oficial' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                              >
                                {inst.api_type === 'oficial' ? 'API Oficial' : 'Evolution'}
                              </Badge>
                              <Badge variant={inst.is_active ? "outline" : "secondary"}>
                                {inst.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                              {getConnectionBadge()}
                              <Badge variant="outline">Ordem: {inst.ordem}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {inst.api_type === 'oficial' 
                                ? `Phone ID: ${inst.phone_number_id || '-'}`
                                : inst.evolution_instance
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditInstancia(inst)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicarInstancia(inst)}
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInstancia(inst.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações Antigas (mantidas para compatibilidade) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configurações Evolution API (Legado)
                  </CardTitle>
                  <CardDescription>
                    Configurações antigas mantidas para compatibilidade
                  </CardDescription>
                </div>
                {autoSendEnabled && (
                  <Badge variant="default" className="gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Auto-envio Ativo
                  </Badge>
                )}
              </div>
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

              <div className="flex items-center justify-between py-4">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-send">Envio Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, mensagens de aprovação são enviadas automaticamente 
                    assim que a foto de aprovação for gerada.
                    <br />
                    <span className="text-xs text-orange-600 font-medium">
                      ⚠️ Apenas envia se o status "Mensagem" não for "enviada"
                    </span>
                  </p>
                </div>
                <Switch
                  id="auto-send"
                  checked={autoSendEnabled}
                  onCheckedChange={setAutoSendEnabled}
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
