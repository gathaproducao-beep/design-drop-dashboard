-- Adicionar coluna rotation na tabela mockup_areas
ALTER TABLE mockup_areas 
ADD COLUMN rotation numeric DEFAULT 0;

COMMENT ON COLUMN mockup_areas.rotation IS 'Ângulo de rotação em graus (0-360)';