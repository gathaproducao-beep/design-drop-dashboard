-- Adicionar campos para status de aprovação e mídia de cabeçalho nos templates
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS has_header_media boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS header_media_field text DEFAULT NULL;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.whatsapp_templates.status IS 'Status de aprovação no Meta: pendente, aprovado, rejeitado';
COMMENT ON COLUMN public.whatsapp_templates.has_header_media IS 'Indica se o template tem imagem de cabeçalho';
COMMENT ON COLUMN public.whatsapp_templates.header_media_field IS 'Campo do pedido usado como mídia: foto_aprovacao, fotos_cliente';