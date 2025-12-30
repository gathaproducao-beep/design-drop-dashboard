-- Adicionar coluna observacao_interna para anotações internas da equipe
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS observacao_interna TEXT;