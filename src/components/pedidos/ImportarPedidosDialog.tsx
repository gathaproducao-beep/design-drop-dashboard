import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDataBrasilia } from "@/lib/utils";

interface ImportarPedidosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PedidoExcel {
  numero_pedido: string;
  nome_cliente: string;
  codigo_produto: string;
  telefone?: string;
  data_pedido?: string;
  observacao?: string;
}

export function ImportarPedidosDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportarPedidosDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PedidoExcel[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de arquivo
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Por favor, selecione um arquivo Excel válido (.xlsx ou .xls)");
      return;
    }

    setFile(selectedFile);
    processarArquivo(selectedFile);
  };

  const processarArquivo = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Mapear os dados da planilha
      const pedidosProcessados = jsonData.map((row: any) => ({
        numero_pedido: String(row["Número"] || row["Numero"] || row["numero_pedido"] || "").trim(),
        nome_cliente: String(row["Cliente"] || row["Nome Cliente"] || row["nome_cliente"] || "").trim(),
        codigo_produto: String(row["Código Produto"] || row["Codigo Produto"] || row["codigo_produto"] || row["Produto"] || "").trim(),
        telefone: String(row["Telefone"] || row["telefone"] || "").trim() || undefined,
        data_pedido: row["Data"] || row["Data Pedido"] || row["data_pedido"] || undefined,
        observacao: row["Observação"] || row["Observacao"] || row["observacao"] || undefined,
      }));

      // Filtrar linhas vazias
      const pedidosValidos = pedidosProcessados.filter(
        (p) => p.numero_pedido && p.nome_cliente && p.codigo_produto
      );

      if (pedidosValidos.length === 0) {
        toast.error("Nenhum pedido válido encontrado na planilha");
        setFile(null);
        return;
      }

      setPreview(pedidosValidos);
      toast.success(`${pedidosValidos.length} pedido(s) prontos para importar`);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo Excel");
      setFile(null);
    }
  };

  const handleImportar = async () => {
    if (preview.length === 0) return;

    setLoading(true);
    try {
      // Preparar dados para inserção
      const pedidosParaInserir = preview.map((p) => ({
        numero_pedido: p.numero_pedido,
        nome_cliente: p.nome_cliente,
        codigo_produto: p.codigo_produto,
        telefone: p.telefone || null,
        data_pedido: p.data_pedido || getDataBrasilia(),
        observacao: p.observacao || null,
        mensagem_enviada: "pendente",
        layout_aprovado: "pendente",
      }));

      const { error } = await supabase.from("pedidos").insert(pedidosParaInserir);

      if (error) throw error;

      toast.success(`${pedidosParaInserir.length} pedido(s) importado(s) com sucesso!`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Erro ao importar pedidos:", error);
      toast.error(error.message || "Erro ao importar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Pedidos</DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha Excel com os dados dos pedidos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A planilha deve conter as colunas: <strong>Número</strong>, <strong>Cliente</strong> e{" "}
              <strong>Código Produto</strong>. Opcionalmente: Telefone, Data e Observação.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {file ? file.name : "Selecione uma planilha Excel"}
              </p>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Escolher arquivo
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Preview ({preview.length} pedidos)</h4>
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Número</th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-left">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((pedido, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{pedido.numero_pedido}</td>
                        <td className="p-2">{pedido.nome_cliente}</td>
                        <td className="p-2">{pedido.codigo_produto}</td>
                        <td className="p-2">{pedido.telefone || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    ... e mais {preview.length - 10} pedido(s)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImportar} disabled={preview.length === 0 || loading}>
            {loading ? "Importando..." : `Importar ${preview.length} pedido(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
