import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Check, X, Loader2 } from "lucide-react";
import TesteDriveDialog from "@/components/drive/TesteDriveDialog";

export default function ConfiguracoesDrive() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [autoUploadEnabled, setAutoUploadEnabled] = useState(false);
  const [folderStructure, setFolderStructure] = useState("pedido");

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

          {/* Card de Configurações de Upload */}
          <Card>
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
        </div>
      </div>

      {showTestDialog && (
        <TesteDriveDialog
          open={showTestDialog}
          onOpenChange={setShowTestDialog}
        />
      )}
    </div>
  );
}
