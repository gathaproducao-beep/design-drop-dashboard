import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NovoMockupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovoMockupDialog({
  open,
  onOpenChange,
  onSuccess,
}: NovoMockupDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    codigo_mockup: "",
    tipo: "aprovacao" as "aprovacao" | "molde",
    mockup_aprovacao_vinculado_id: null as string | null,
  });
  const [mockupsAprovacao, setMockupsAprovacao] = useState<any[]>([]);

  useEffect(() => {
    if (open && formData.tipo === "molde") {
      carregarMockupsAprovacao();
    }
  }, [open, formData.tipo]);

  const carregarMockupsAprovacao = async () => {
    try {
      const { data, error } = await supabase
        .from("mockups")
        .select("id, codigo_mockup")
        .eq("tipo", "aprovacao")
        .order("codigo_mockup");

      if (error) throw error;
      setMockupsAprovacao(data || []);
    } catch (error) {
      console.error("Erro ao carregar mockups de aprovação:", error);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      // Criar mockup
      const { data: mockupData, error: mockupError } = await supabase
        .from("mockups")
        .insert([
          {
            codigo_mockup: formData.codigo_mockup,
            tipo: formData.tipo,
            mockup_aprovacao_vinculado_id: formData.mockup_aprovacao_vinculado_id,
            imagem_base: "", // Será atualizado pelo canvas padrão
          },
        ])
        .select()
        .single();

      if (mockupError) throw mockupError;

      // Criar canvas padrão "Frente"
      const { error: canvasError } = await (supabase as any).from("mockup_canvases").insert([
        {
          mockup_id: mockupData.id,
          nome: "Frente",
          imagem_base: "",
          ordem: 0,
        },
      ]);

      if (canvasError) throw canvasError;

      toast.success("Mockup criado com sucesso!");
      onSuccess();
      onOpenChange(false);
      setFormData({ 
        codigo_mockup: "", 
        tipo: "aprovacao",
        mockup_aprovacao_vinculado_id: null 
      });
    } catch (error: any) {
      console.error("Erro ao criar mockup:", error);
      toast.error(error.message || "Erro ao criar mockup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Mockup</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codigo_mockup">Código do Mockup *</Label>
            <Input
              id="codigo_mockup"
              value={formData.codigo_mockup}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, codigo_mockup: e.target.value }))
              }
              required
              placeholder="Ex: PIFEM-1364-PERSO-CURTO-P"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value: "aprovacao" | "molde") =>
                setFormData((prev) => ({ ...prev, tipo: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aprovacao">Aprovação</SelectItem>
                <SelectItem value="molde">Molde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.tipo === "molde" && (
            <div className="space-y-2">
              <Label htmlFor="vinculado">Mockup de Aprovação Vinculado (Opcional)</Label>
              <Select
                value={formData.mockup_aprovacao_vinculado_id || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ 
                    ...prev, 
                    mockup_aprovacao_vinculado_id: value === "none" ? null : value 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um mockup de aprovação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {mockupsAprovacao.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.codigo_mockup}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao gerar, criará também o mockup de aprovação vinculado
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-primary to-primary/80"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Mockup"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
