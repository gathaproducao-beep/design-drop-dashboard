import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: any;
  onSuccess: () => void;
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  pedido,
  onSuccess,
}: ImageUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(pedido?.foto_cliente || null);

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

      // Atualizar pedido
      const { error: updateError } = await supabase
        .from("pedidos")
        .update({ foto_cliente: urlData.publicUrl })
        .eq("id", pedido.id);

      if (updateError) throw updateError;

      toast.success("Foto enviada com sucesso!");
      setPreview(urlData.publicUrl);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload da Foto do Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {preview && (
            <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
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
            Selecione uma imagem para fazer upload
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
