-- Adicionar campo para armazenar múltiplas partes da mensagem
ALTER TABLE public.mensagens_whatsapp 
ADD COLUMN partes_mensagem text[] DEFAULT '{}'::text[];

-- Comentário explicativo
COMMENT ON COLUMN public.mensagens_whatsapp.partes_mensagem IS 'Array de partes da mensagem que serão enviadas em sequência';