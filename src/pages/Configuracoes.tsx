import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Settings, Trash2, Loader2, HardDrive, Download } from "lucide-react";
import CleanupPedidosDialog from "@/components/drive/CleanupPedidosDialog";
import { StorageDownloadDialog } from "@/components/backup/StorageDownloadDialog";

export default function Configuracoes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [storageDownloadOpen, setStorageDownloadOpen] = useState(false);

  // Configurações de limpeza automática
  const [storageCleanupDays, setStorageCleanupDays] = useState(15);
  const [cleanupFotoAprovacao, setCleanupFotoAprovacao] = useState(true);
  const [cleanupMoldeProducao, setCleanupMoldeProducao] = useState(true);

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{
    totalFiles: number;
    orphanFiles: number;
  } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);

  useEffect(() => {
    carregarConfiguracoes();
    carregarInfoStorage();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from("google_drive_settings")
        .select("storage_cleanup_days, cleanup_foto_aprovacao, cleanup_molde_producao")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar configurações:", error);
        return;
      }

      if (data) {
        setStorageCleanupDays((data as any).storage_cleanup_days ?? 15);
        setCleanupFotoAprovacao((data as any).cleanup_foto_aprovacao ?? true);
        setCleanupMoldeProducao((data as any).cleanup_molde_producao ?? true);
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const carregarInfoStorage = async () => {
    setLoadingStorage(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-files", {
        body: { action: "list" },
      });

      if (error) throw error;

      setStorageInfo({
        totalFiles: data.totalFiles || 0,
        orphanFiles: data.orphanCount || 0,
      });
    } catch (error: any) {
      console.error("Erro ao carregar info storage:", error);
    } finally {
      setLoadingStorage(false);
    }
  };

  const salvarConfiguracoes = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("google_drive_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("google_drive_settings")
          .update({
            storage_cleanup_days: storageCleanupDays,
            cleanup_foto_aprovacao: cleanupFotoAprovacao,
            cleanup_molde_producao: cleanupMoldeProducao,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Criar registro mínimo se não existir
        const { error } = await supabase
          .from("google_drive_settings")
          .insert({
            client_id: "",
            client_secret: "",
            refresh_token: "",
            storage_cleanup_days: storageCleanupDays,
            cleanup_foto_aprovacao: cleanupFotoAprovacao,
            cleanup_molde_producao: cleanupMoldeProducao,
          });

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As preferências de limpeza foram atualizadas",
      });
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
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Configurações</h1>
          </div>
          <p className="text-muted-foreground">
            Configurações gerais do sistema
          </p>
        </div>

        <div className="grid gap-6 max-w-4xl">
          {/* Card de Info Storage */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Uso do Storage</CardTitle>
                  <CardDescription>
                    Informações sobre o uso do armazenamento de imagens
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStorage ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando informações...
                </div>
              ) : storageInfo ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{storageInfo.totalFiles}</p>
                    <p className="text-sm text-muted-foreground">Arquivos no Storage</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-3xl font-bold text-orange-500">{storageInfo.orphanFiles}</p>
                    <p className="text-sm text-muted-foreground">Arquivos Órfãos</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Não foi possível carregar informações do storage</p>
              )}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={carregarInfoStorage} disabled={loadingStorage}>
                  {loadingStorage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Atualizar
                </Button>
                <Button variant="outline" onClick={() => setStorageDownloadOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Storage
                </Button>
              </div>
            </CardContent>
          </Card>

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
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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

      <CleanupPedidosDialog
        open={showCleanupDialog}
        onOpenChange={setShowCleanupDialog}
        config={{
          days: storageCleanupDays,
          cleanupFotoAprovacao,
          cleanupMoldeProducao,
        }}
      />

      <StorageDownloadDialog
        open={storageDownloadOpen}
        onOpenChange={setStorageDownloadOpen}
      />
    </div>
  );
}
