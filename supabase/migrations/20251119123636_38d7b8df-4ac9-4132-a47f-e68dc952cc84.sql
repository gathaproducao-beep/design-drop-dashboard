-- Adicionar campo pedido_id na fila para vincular com pedidos
ALTER TABLE public.whatsapp_queue
ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_queue_pedido_id ON public.whatsapp_queue(pedido_id);