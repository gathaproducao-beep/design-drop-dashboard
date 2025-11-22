-- Adicionar coluna arquivado na tabela pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_pedidos_arquivado 
ON pedidos(arquivado);

-- Adicionar comentário
COMMENT ON COLUMN pedidos.arquivado IS 
'Indica se o pedido foi arquivado (true) ou está ativo (false)';