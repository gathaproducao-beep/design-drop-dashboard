-- Adicionar campo para armazenar sequência de mensagens anteriores
ALTER TABLE public.mensagens_whatsapp 
ADD COLUMN mensagens_anteriores uuid[] DEFAULT '{}'::uuid[];

-- Comentário explicativo
COMMENT ON COLUMN public.mensagens_whatsapp.mensagens_anteriores IS 'IDs das mensagens que devem ser enviadas ANTES desta mensagem, em ordem';