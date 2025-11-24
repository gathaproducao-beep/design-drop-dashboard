-- Adicionar colunas para armazenar dimensões originais e escala calculada dos canvas
ALTER TABLE mockup_canvases
ADD COLUMN largura_original INTEGER,
ADD COLUMN altura_original INTEGER,
ADD COLUMN escala_calculada DECIMAL(10, 6);

-- Comentários para documentar as colunas
COMMENT ON COLUMN mockup_canvases.largura_original IS 'Largura original da imagem em pixels (naturalWidth)';
COMMENT ON COLUMN mockup_canvases.altura_original IS 'Altura original da imagem em pixels (naturalHeight)';
COMMENT ON COLUMN mockup_canvases.escala_calculada IS 'Escala calculada (largura_original / largura_renderizada) para conversão de coordenadas';