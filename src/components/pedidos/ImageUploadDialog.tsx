import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: any;
  onSuccess: () => void;
  gerarFotoAuto?: boolean;
  onFotosUpdated?: (pedido: any) => void;
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  pedido,
  onSuccess,
  gerarFotoAuto = false,
  onFotosUpdated,
}: ImageUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<string[]>(pedido?.fotos_cliente || []);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload para o storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${pedido.id}-cliente-${Date.now()}.${fileExt}`;
      const filePath = `clientes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("mockup-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("mockup-images")
        .getPublicUrl(filePath);

      // Atualizar pedido com array de fotos
      const novasFotos = [...previews, urlData.publicUrl];
      const { error: updateError } = await (supabase as any)
        .from("pedidos")
        .update({ fotos_cliente: novasFotos })
        .eq("id", pedido.id);

      if (updateError) throw updateError;

      toast.success("Foto enviada com sucesso!");
      setPreviews(novasFotos);
      
      // Chamar callback para geração automática se configurado
      if (gerarFotoAuto && onFotosUpdated) {
        const pedidoAtualizado = { ...pedido, fotos_cliente: novasFotos };
        onFotosUpdated(pedidoAtualizado);
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFoto = async () => {
    if (deleteIndex === null) return;

    try {
      const fotoUrl = previews[deleteIndex];
      const fileName = fotoUrl.split("/").pop();

      if (fileName) {
        const filePath = `clientes/${fileName}`;
        await supabase.storage.from("mockup-images").remove([filePath]);
      }

      const novasFotos = previews.filter((_, idx) => idx !== deleteIndex);
      const { error } = await (supabase as any)
        .from("pedidos")
        .update({ fotos_cliente: novasFotos })
        .eq("id", pedido.id);

      if (error) throw error;

      toast.success("Foto removida com sucesso!");
      setPreviews(novasFotos);
      onSuccess();
    } catch (error) {
      console.error("Erro ao deletar foto:", error);
      toast.error("Erro ao deletar foto");
    } finally {
      setDeleteIndex(null);
    }
  };

  return (
    <>
      <AlertDialog open={deleteIndex !== null} onOpenChange={() => setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFoto}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload da Foto do Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {previews.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {previews.map((url, idx) => (
                <div key={idx} className="relative w-full h-32 bg-muted rounded-lg overflow-hidden group">
                  <img
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteIndex(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="cursor-pointer"
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <p className="text-sm text-muted-foreground">
            Adicione múltiplas fotos do cliente
          </p>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
