-- Criar tabela para templates de mensagens do WhatsApp
CREATE TABLE public.mensagens_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;

-- Criar política (permitir tudo por enquanto, seguindo o padrão do projeto)
CREATE POLICY "Permitir tudo em mensagens_whatsapp" 
ON public.mensagens_whatsapp 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Criar trigger para updated_at
CREATE TRIGGER update_mensagens_whatsapp_updated_at
BEFORE UPDATE ON public.mensagens_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();