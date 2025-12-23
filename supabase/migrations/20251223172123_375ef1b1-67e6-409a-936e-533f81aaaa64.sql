-- Adicionar campo arquivado_em para rastrear quando o pedido foi arquivado
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMP WITH TIME ZONE;

-- Criar um trigger para preencher arquivado_em automaticamente quando arquivado mudar para true
CREATE OR REPLACE FUNCTION public.handle_pedido_arquivado()
RETURNS TRIGGER AS $$
BEGIN
  -- Se arquivado mudou de false/null para true, setar arquivado_em
  IF (OLD.arquivado IS NULL OR OLD.arquivado = false) AND NEW.arquivado = true THEN
    NEW.arquivado_em = NOW();
  -- Se arquivado mudou de true para false, limpar arquivado_em
  ELSIF OLD.arquivado = true AND (NEW.arquivado = false OR NEW.arquivado IS NULL) THEN
    NEW.arquivado_em = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para execução automática
DROP TRIGGER IF EXISTS trigger_pedido_arquivado ON public.pedidos;
CREATE TRIGGER trigger_pedido_arquivado
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.handle_pedido_arquivado();

-- Atualizar pedidos já arquivados para ter uma data (usando updated_at como referência)
UPDATE public.pedidos 
SET arquivado_em = COALESCE(updated_at, created_at, NOW())
WHERE arquivado = true AND arquivado_em IS NULL;