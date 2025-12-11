import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { sendWhatsappMessage, validatePhone, formatPhone } from "@/lib/whatsapp";
import { Loader2, Plus, X, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface MensagemDisponivel {
  id: string;
  nome: string;
  mensagem: string;
  is_active: boolean;
}

interface MensagemSelecionada {
  id: string;
  nome: string;
  mensagem: string;
}

interface TesteEnvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensagemTexto: string;
  nomeMensagem: string;
  mensagemId?: string;
}

export function TesteEnvioDialog({ 
  open, 
  onOpenChange, 
  mensagemTexto,
  nomeMensagem,
  mensagemId
}: TesteEnvioDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagensDisponiveis, setMensagensDisponiveis] = useState<MensagemDisponivel[]>([]);
  const [mensagensSelecionadas, setMensagensSelecionadas] = useState<MensagemSelecionada[]>([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);

  // Carregar mensagens disponíveis
  useEffect(() => {
    if (open) {
      carregarMensagens();
      // Inicializar com a mensagem atual
      setMensagensSelecionadas([{
        id: mensagemId || 'current',
        nome: nomeMensagem,
        mensagem: mensagemTexto
      }]);
    }
  }, [open, mensagemId, nomeMensagem, mensagemTexto]);

  const carregarMensagens = async () => {
    setLoadingMensagens(true);
    try {
      const { data, error } = await supabase
        .from("mensagens_whatsapp")
        .select("*")
        .eq("is_active", true)
        .order("nome");

      if (error) throw error;
      setMensagensDisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    } finally {
      setLoadingMensagens(false);
    }
  };

  const adicionarMensagem = (msg: MensagemDisponivel) => {
    // Verificar se já está na lista
    if (mensagensSelecionadas.some(m => m.id === msg.id)) {
      toast({
        title: "Mensagem já adicionada",
        description: "Esta mensagem já está na lista de envio",
        variant: "destructive",
      });
      return;
    }

    setMensagensSelecionadas(prev => [...prev, {
      id: msg.id,
      nome: msg.nome,
      mensagem: msg.mensagem
    }]);
  };

  const removerMensagem = (index: number) => {
    setMensagensSelecionadas(prev => prev.filter((_, i) => i !== index));
  };

  const moverMensagem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= mensagensSelecionadas.length) return;

    setMensagensSelecionadas(prev => {
      const newList = [...prev];
      [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
      return newList;
    });
  };

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

    // Validar mensagens
    if (mensagensSelecionadas.length === 0) {
      toast({
        title: "Nenhuma mensagem",
        description: "Adicione pelo menos uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      let enviadas = 0;
      let erros = 0;

      // Enviar mensagens em sequência com delay
      for (let i = 0; i < mensagensSelecionadas.length; i++) {
        const msg = mensagensSelecionadas[i];
        
        try {
          await sendWhatsappMessage(cleanPhone, msg.mensagem);
          enviadas++;
          
          // Delay entre mensagens (exceto na última)
          if (i < mensagensSelecionadas.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Erro ao enviar mensagem ${msg.nome}:`, error);
          erros++;
        }
      }

      if (erros === 0) {
        toast({
          title: "Mensagens enviadas!",
          description: `${enviadas} mensagem(ns) enviada(s) para ${formatPhone(cleanPhone)}`,
        });
      } else {
        toast({
          title: "Envio parcial",
          description: `${enviadas} enviada(s), ${erros} erro(s)`,
          variant: "destructive",
        });
      }

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Testar Envio de Mensagens</DialogTitle>
          <DialogDescription>
            Envie uma ou mais mensagens em sequência para testar a integração
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

          {/* Mensagens selecionadas para envio */}
          <div className="space-y-2">
            <Label>Mensagens a Enviar (em ordem)</Label>
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              {mensagensSelecionadas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma mensagem selecionada
                </p>
              ) : (
                mensagensSelecionadas.map((msg, index) => (
                  <div 
                    key={`${msg.id}-${index}`}
                    className="flex items-center gap-2 bg-background border rounded-lg p-3"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{msg.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{msg.mensagem.substring(0, 80)}...</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moverMensagem(index, 'up')}
                        disabled={index === 0 || loading}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moverMensagem(index, 'down')}
                        disabled={index === mensagensSelecionadas.length - 1 || loading}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removerMensagem(index)}
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Adicionar mais mensagens */}
          <div className="space-y-2">
            <Label>Adicionar Mensagens</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
              {loadingMensagens ? (
                <div className="col-span-full flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : mensagensDisponiveis.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                  Nenhuma mensagem ativa disponível
                </p>
              ) : (
                mensagensDisponiveis.map((msg) => (
                  <Button
                    key={msg.id}
                    variant="outline"
                    size="sm"
                    className="justify-start h-auto py-2 px-3"
                    onClick={() => adicionarMensagem(msg)}
                    disabled={loading}
                  >
                    <Plus className="h-3 w-3 mr-2 flex-shrink-0" />
                    <span className="truncate">{msg.nome}</span>
                  </Button>
                ))
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarTeste}
              disabled={loading || mensagensSelecionadas.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar {mensagensSelecionadas.length} Mensagem(ns)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}