import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getDataBrasilia } from "@/lib/utils";

interface NovoPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovoPedidoDialog({
  open,
  onOpenChange,
  onSuccess,
}: NovoPedidoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    numero_pedido: "",
    nome_cliente: "",
    codigo_produto: "",
    telefone: "",
    data_pedido: getDataBrasilia(),
    observacao: "",
    pasta_drive_url: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("pedidos").insert([formData]);

      if (error) throw error;

      toast.success("Pedido criado com sucesso!");
      onSuccess();
      onOpenChange(false);
      setFormData({
        numero_pedido: "",
        nome_cliente: "",
        codigo_produto: "",
        telefone: "",
        data_pedido: getDataBrasilia(),
        observacao: "",
        pasta_drive_url: "",
      });
    } catch (error: any) {
      console.error("Erro ao criar pedido:", error);
      toast.error(error.message || "Erro ao criar pedido");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_pedido">Número do Pedido *</Label>
              <Input
                id="numero_pedido"
                name="numero_pedido"
                value={formData.numero_pedido}
                onChange={handleChange}
                required
                placeholder="Ex: PED-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_pedido">Data do Pedido *</Label>
              <Input
                id="data_pedido"
                name="data_pedido"
                type="date"
                value={formData.data_pedido}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_cliente">Nome do Cliente *</Label>
            <Input
              id="nome_cliente"
              name="nome_cliente"
              value={formData.nome_cliente}
              onChange={handleChange}
              required
              placeholder="Nome completo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo_produto">Código do Produto *</Label>
              <Input
                id="codigo_produto"
                name="codigo_produto"
                value={formData.codigo_produto}
                onChange={handleChange}
                required
                placeholder="Ex: PIFEM-1364-PERSO-CURTO-P"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pasta_drive_url">URL da Pasta do Drive</Label>
            <Input
              id="pasta_drive_url"
              name="pasta_drive_url"
              type="url"
              value={formData.pasta_drive_url}
              onChange={handleChange}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              placeholder="Informações adicionais sobre o pedido"
              rows={3}
            />
          </div>

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
                "Criar Pedido"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
