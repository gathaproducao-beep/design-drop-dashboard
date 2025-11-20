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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditarPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: any;
  onSuccess: () => void;
}

export function EditarPedidoDialog({
  open,
  onOpenChange,
  pedido,
  onSuccess,
}: EditarPedidoDialogProps) {
  const [formData, setFormData] = useState({
    numero_pedido: pedido?.numero_pedido || "",
    nome_cliente: pedido?.nome_cliente || "",
    codigo_produto: pedido?.codigo_produto || "",
    telefone: pedido?.telefone || "",
    data_pedido: pedido?.data_pedido || "",
    data_impressao: pedido?.data_impressao || "",
    observacao: pedido?.observacao || "",
    pasta_drive_url: pedido?.pasta_drive_url || "",
  });
  const [saving, setSaving] = useState(false);

  // Sincronizar formData quando o pedido mudar
  useEffect(() => {
    if (pedido) {
      setFormData({
        numero_pedido: pedido.numero_pedido || "",
        nome_cliente: pedido.nome_cliente || "",
        codigo_produto: pedido.codigo_produto || "",
        telefone: pedido.telefone || "",
        data_pedido: pedido.data_pedido || "",
        data_impressao: pedido.data_impressao || "",
        observacao: pedido.observacao || "",
        pasta_drive_url: pedido.pasta_drive_url || "",
      });
    }
  }, [pedido]);

  const handleSave = async () => {
    if (!formData.numero_pedido || !formData.nome_cliente || !formData.codigo_produto) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("pedidos")
        .update({
          numero_pedido: formData.numero_pedido,
          nome_cliente: formData.nome_cliente,
          codigo_produto: formData.codigo_produto,
          telefone: formData.telefone || null,
          data_pedido: formData.data_pedido || null,
          data_impressao: formData.data_impressao || null,
          observacao: formData.observacao || null,
          pasta_drive_url: formData.pasta_drive_url || null,
        })
        .eq("id", pedido.id);

      if (error) throw error;

      toast.success("Pedido atualizado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      toast.error("Erro ao atualizar pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_pedido">Número do Pedido *</Label>
              <Input
                id="numero_pedido"
                value={formData.numero_pedido}
                onChange={(e) =>
                  setFormData({ ...formData, numero_pedido: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo_produto">Código do Produto *</Label>
              <Input
                id="codigo_produto"
                value={formData.codigo_produto}
                onChange={(e) =>
                  setFormData({ ...formData, codigo_produto: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_cliente">Nome do Cliente *</Label>
            <Input
              id="nome_cliente"
              value={formData.nome_cliente}
              onChange={(e) =>
                setFormData({ ...formData, nome_cliente: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_pedido">Data do Pedido</Label>
              <Input
                id="data_pedido"
                type="date"
                value={formData.data_pedido}
                onChange={(e) =>
                  setFormData({ ...formData, data_pedido: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_impressao">Data de Impressão</Label>
              <Input
                id="data_impressao"
                type="date"
                value={formData.data_impressao}
                onChange={(e) =>
                  setFormData({ ...formData, data_impressao: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(e) =>
                setFormData({ ...formData, observacao: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pasta_drive_url">URL da Pasta Drive</Label>
            <Input
              id="pasta_drive_url"
              value={formData.pasta_drive_url}
              onChange={(e) =>
                setFormData({ ...formData, pasta_drive_url: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
