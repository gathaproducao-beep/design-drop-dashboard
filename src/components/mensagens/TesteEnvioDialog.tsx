import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { sendWhatsappMessage, validatePhone, formatPhone } from "@/lib/whatsapp";
import { Loader2 } from "lucide-react";

interface TesteEnvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensagemTexto: string;
  nomeMensagem: string;
}

export function TesteEnvioDialog({ 
  open, 
  onOpenChange, 
  mensagemTexto,
  nomeMensagem 
}: TesteEnvioDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEnviarTeste = async () => {
    // Validar número
    if (!validatePhone(phoneNumber)) {
      toast({
        title: "Número inválido",
        description: "Use o formato: 5546999999999 (código país + DDD + número)",
        variant: "destructive",
      });
      return;
    }

    // Validar mensagem
    if (!mensagemTexto || mensagemTexto.trim().length === 0) {
      toast({
        title: "Mensagem vazia",
        description: "A mensagem não pode estar vazia",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Enviar mensagem
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      await sendWhatsappMessage(cleanPhone, mensagemTexto);

      toast({
        title: "Mensagem enviada!",
        description: `Mensagem de teste enviada para ${formatPhone(cleanPhone)}`,
      });

      // Fechar modal e limpar
      onOpenChange(false);
      setPhoneNumber("");
    } catch (error) {
      console.error("Erro ao enviar teste:", error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem de teste",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Testar Envio - {nomeMensagem}</DialogTitle>
          <DialogDescription>
            Envie uma mensagem de teste para verificar a integração com WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input de telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <Input
              id="phone"
              placeholder="5546999999999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Formato: código país + DDD + número (ex: 5546999999999)
            </p>
          </div>

          {/* Prévia da mensagem */}
          <div className="space-y-2">
            <Label>Prévia da Mensagem</Label>
            <div className="bg-muted p-4 rounded-lg border">
              <p className="text-sm whitespace-pre-wrap">{mensagemTexto}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta é a mensagem literal que será enviada. Variáveis não serão substituídas no teste.
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarTeste}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Teste
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
