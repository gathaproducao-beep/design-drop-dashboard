-- Alterar colunas para suportar múltiplas imagens (arrays)
ALTER TABLE pedidos 
  ALTER COLUMN foto_aprovacao TYPE text[] USING CASE 
    WHEN foto_aprovacao IS NULL THEN NULL
    WHEN foto_aprovacao = '' THEN '{}'::text[]
    ELSE ARRAY[foto_aprovacao]
  END,
  ALTER COLUMN molde_producao TYPE text[] USING CASE 
    WHEN molde_producao IS NULL THEN NULL
    WHEN molde_producao = '' THEN '{}'::text[]
    ELSE ARRAY[molde_producao]
  END;