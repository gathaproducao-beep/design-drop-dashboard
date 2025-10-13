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
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    codigo_mockup: "",
    tipo: "aprovacao" as "aprovacao" | "molde",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error("Selecione uma imagem base");
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      // Upload da imagem
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${formData.codigo_mockup}-${Date.now()}.${fileExt}`;
      const filePath = `mockups/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("mockup-images")
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("mockup-images")
        .getPublicUrl(filePath);

      setUploading(false);

      // Criar mockup
      const { error } = await supabase.from("mockups").insert([
        {
          ...formData,
          imagem_base: urlData.publicUrl,
        },
      ]);

      if (error) throw error;

      toast.success("Mockup criado com sucesso!");
      onSuccess();
      onOpenChange(false);
      setFormData({ codigo_mockup: "", tipo: "aprovacao" });
      setImageFile(null);
      setPreview(null);
    } catch (error: any) {
      console.error("Erro ao criar mockup:", error);
      toast.error(error.message || "Erro ao criar mockup");
    } finally {
      setLoading(false);
      setUploading(false);
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

          <div className="space-y-2">
            <Label htmlFor="imagem">Imagem Base *</Label>
            {preview && (
              <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden mb-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <Input
              id="imagem"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required
              disabled={uploading}
            />
            {uploading && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fazendo upload...
              </p>
            )}
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
                "Criar Mockup"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
