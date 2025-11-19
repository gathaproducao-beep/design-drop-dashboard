-- Remover constraint antiga que impedia os novos status
ALTER TABLE public.pedidos 
DROP CONSTRAINT IF EXISTS pedidos_mensagem_enviada_check;

-- Adicionar nova constraint com todos os status
ALTER TABLE public.pedidos 
ADD CONSTRAINT pedidos_mensagem_enviada_check 
CHECK (mensagem_enviada IN ('pendente', 'enviando', 'enviada', 'erro', 'reenviar'));