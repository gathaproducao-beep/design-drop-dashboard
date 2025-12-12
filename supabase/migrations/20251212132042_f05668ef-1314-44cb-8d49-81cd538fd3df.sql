-- Remove a constraint antiga do layout_aprovado e adiciona uma nova que inclui 'fazer_manual'
-- Primeiro, precisamos encontrar o nome da constraint
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Buscar o nome da constraint CHECK para a coluna layout_aprovado
    SELECT conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'pedidos'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%layout_aprovado%';
    
    -- Se encontrar a constraint, remover
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.pedidos DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Adicionar nova constraint com 'fazer_manual' incluído
ALTER TABLE public.pedidos 
ADD CONSTRAINT pedidos_layout_aprovado_check 
CHECK (layout_aprovado IN ('aprovado', 'reprovado', 'pendente', 'fazer_manual'));