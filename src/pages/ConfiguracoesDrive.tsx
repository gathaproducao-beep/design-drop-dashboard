import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Check, X, Loader2, Trash2 } from "lucide-react";
import TesteDriveDialog from "@/components/drive/TesteDriveDialog";
import CleanupPedidosDialog from "@/components/drive/CleanupPedidosDialog";
export default function ConfiguracoesDrive() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [autoUploadEnabled, setAutoUploadEnabled] = useState(false);
  const [folderStructure, setFolderStructure] = useState("pedido");
  const [integrationEnabled, setIntegrationEnabled] = useState(false);

  // Configurações de limpeza automática
  const [storageCleanupDays, setStorageCleanupDays] = useState(15);
  const [cleanupFotoAprovacao, setCleanupFotoAprovacao] = useState(true);
  const [cleanupMoldeProducao, setCleanupMoldeProducao] = useState(true);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from("google_drive_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar configurações:", error);
        return;
      }

      if (data) {
        setClientId(data.client_id);
        setClientSecret(data.client_secret);
        setRefreshToken(data.refresh_token);
        setRootFolderId(data.root_folder_id || "");
        setAutoUploadEnabled(data.auto_upload_enabled);
        setFolderStructure(data.folder_structure);
        setIntegrationEnabled((data as any).integration_enabled ?? false);
        // Carregar configurações de limpeza
        setStorageCleanupDays((data as any).storage_cleanup_days ?? 15);
        setCleanupFotoAprovacao((data as any).cleanup_foto_aprovacao ?? true);
        setCleanupMoldeProducao((data as any).cleanup_molde_producao ?? true);
        setConnected(true);
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const testarConexao = async () => {
    if (!clientId || !clientSecret || !refreshToken) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todas as credenciais OAuth2",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verificar se já existe uma configuração
      const { data: existing } = await supabase
        .from("google_drive_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      // Salvar ou atualizar as credenciais
      if (existing) {
        // Atualizar o registro existente
        const { error: updateError } = await supabase
          .from("google_drive_settings")
          .update({
          client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            root_folder_id: rootFolderId || null,
            auto_upload_enabled: autoUploadEnabled,
            folder_structure: folderStructure,
            integration_enabled: integrationEnabled,
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        // Criar novo registro
        const { error: insertError } = await supabase
          .from("google_drive_settings")
          .insert({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            root_folder_id: rootFolderId || null,
            auto_upload_enabled: autoUploadEnabled,
            folder_structure: folderStructure,
            integration_enabled: integrationEnabled,
          });

        if (insertError) throw insertError;
      }

      // Testar a conexão
      const { data, error } = await supabase.functions.invoke("google-drive-auth");

      if (error || !data?.access_token) {
        throw new Error(error?.message || "Falha ao autenticar");
      }

      setConnected(true);
      toast({
        title: "Conexão bem-sucedida!",
        description: "Google Drive conectado com sucesso",
      });
    } catch (error: any) {
      console.error("Erro ao testar conexão:", error);
      setConnected(false);
      toast({
        title: "Erro na conexão",
        description: error.message || "Verifique suas credenciais",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracoes = async () => {
    if (!clientId || !clientSecret || !refreshToken) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todas as credenciais OAuth2",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verificar se já existe uma configuração
      const { data: existing } = await supabase
        .from("google_drive_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Atualizar o registro existente
        const { error } = await supabase
          .from("google_drive_settings")
          .update({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            root_folder_id: rootFolderId || null,
            auto_upload_enabled: autoUploadEnabled,
            folder_structure: folderStructure,
            integration_enabled: integrationEnabled,
            storage_cleanup_days: storageCleanupDays,
            cleanup_foto_aprovacao: cleanupFotoAprovacao,
            cleanup_molde_producao: cleanupMoldeProducao,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await supabase
          .from("google_drive_settings")
          .insert({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            root_folder_id: rootFolderId || null,
            auto_upload_enabled: autoUploadEnabled,
            folder_structure: folderStructure,
            integration_enabled: integrationEnabled,
            storage_cleanup_days: storageCleanupDays,
            cleanup_foto_aprovacao: cleanupFotoAprovacao,
            cleanup_molde_producao: cleanupMoldeProducao,
          });

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações do Google Drive foram atualizadas",
      });

      await carregarConfiguracoes();
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Cloud className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Configurações do Google Drive</h1>
          </div>
          <p className="text-muted-foreground">
            Configure a integração com Google Drive para salvar mockups automaticamente
          </p>
        </div>

        <div className="grid gap-6 max-w-4xl">
          {/* Card de Credenciais OAuth2 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Credenciais OAuth2</CardTitle>
                  <CardDescription>
                    Configure suas credenciais do Google Cloud Console
                  </CardDescription>
                </div>
                <Badge variant={connected ? "default" : "secondary"}>
                  {connected ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3 mr-1" />
                      Desconectado
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  id="client-id"
                  type="password"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Digite o Client ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Digite o Client Secret"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh-token">Refresh Token</Label>
                <Input
                  id="refresh-token"
                  type="password"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="Digite o Refresh Token"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={testarConexao} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    "Testar Conexão"
                  )}
                </Button>
                <Button variant="outline" onClick={salvarConfiguracoes} disabled={loading}>
                  Salvar Credenciais
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card de Ativação da Integração */}
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle>Ativação da Integração</CardTitle>
              <CardDescription>
                Habilite ou desabilite a integração com Google Drive para economizar recursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Integração Habilitada</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando desabilitada, nenhuma operação será feita no Google Drive
                  </p>
                </div>
                <Switch
                  checked={integrationEnabled}
                  onCheckedChange={setIntegrationEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card de Configurações de Upload */}
          <Card className={!integrationEnabled ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader>
              <CardTitle>Configurações de Upload</CardTitle>
              <CardDescription>
                Defina como os arquivos serão organizados no Drive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Upload Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar mockups automaticamente para o Drive
                  </p>
                </div>
                <Switch
                  checked={autoUploadEnabled}
                  onCheckedChange={setAutoUploadEnabled}
                  disabled={!integrationEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="folder-structure">Estrutura de Pastas</Label>
                <Select value={folderStructure} onValueChange={setFolderStructure}>
                  <SelectTrigger id="folder-structure">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pedido">Uma pasta por pedido</SelectItem>
                    <SelectItem value="data">Pasta por data</SelectItem>
                    <SelectItem value="unica">Pasta única (raiz)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="root-folder">ID da Pasta Raiz (opcional)</Label>
                <Input
                  id="root-folder"
                  value={rootFolderId}
                  onChange={(e) => setRootFolderId(e.target.value)}
                  placeholder="Deixe vazio para usar a raiz do Drive"
                />
                <p className="text-xs text-muted-foreground">
                  Cole o ID da pasta do Drive onde deseja organizar os arquivos
                </p>
              </div>

              <Button onClick={salvarConfiguracoes} disabled={loading} className="w-full">
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>

          {/* Card de Teste */}
          {connected && (
            <Card>
              <CardHeader>
                <CardTitle>Teste de Integração</CardTitle>
                <CardDescription>
                  Teste as operações do Google Drive
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowTestDialog(true)}>
                  Abrir Painel de Testes
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Card de Limpeza de Arquivos */}
          <Card className="border-orange-500/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-orange-500" />
                <div>
                  <CardTitle>Limpeza de Arquivos de Pedidos Antigos</CardTitle>
                  <CardDescription>
                    Remova fotos de aprovação e moldes de pedidos antigos para liberar espaço
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Dias de retenção: {storageCleanupDays} dias</Label>
                <Slider
                  value={[storageCleanupDays]}
                  onValueChange={(value) => setStorageCleanupDays(value[0])}
                  min={7}
                  max={90}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Pedidos com mais de {storageCleanupDays} dias terão os arquivos selecionados removidos
                </p>
              </div>

              <div className="space-y-3">
                <Label>Arquivos a limpar</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cleanup-foto-aprovacao"
                      checked={cleanupFotoAprovacao}
                      onCheckedChange={(checked) => setCleanupFotoAprovacao(checked as boolean)}
                    />
                    <label
                      htmlFor="cleanup-foto-aprovacao"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Fotos de Aprovação
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cleanup-molde"
                      checked={cleanupMoldeProducao}
                      onCheckedChange={(checked) => setCleanupMoldeProducao(checked as boolean)}
                    />
                    <label
                      htmlFor="cleanup-molde"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Moldes de Produção
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 opacity-50">
                    <Checkbox id="cleanup-foto-cliente" disabled checked={false} />
                    <label
                      htmlFor="cleanup-foto-cliente"
                      className="text-sm font-medium leading-none text-muted-foreground"
                    >
                      Fotos do Cliente (sempre mantidas)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={salvarConfiguracoes}
                  disabled={loading}
                >
                  Salvar Preferências
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowCleanupDialog(true)}
                  disabled={!cleanupFotoAprovacao && !cleanupMoldeProducao}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Agora
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showTestDialog && (
        <TesteDriveDialog
          open={showTestDialog}
          onOpenChange={setShowTestDialog}
        />
      )}

      <CleanupPedidosDialog
        open={showCleanupDialog}
        onOpenChange={setShowCleanupDialog}
        config={{
          days: storageCleanupDays,
          cleanupFotoAprovacao,
          cleanupMoldeProducao,
        }}
      />
    </div>
  );
}
