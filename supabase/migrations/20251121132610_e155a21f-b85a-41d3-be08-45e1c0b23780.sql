-- Criar tabela de templates de áreas
CREATE TABLE public.area_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de itens dos templates
CREATE TABLE public.area_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.area_templates(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  width NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  z_index INTEGER DEFAULT 1,
  font_size INTEGER DEFAULT 16,
  font_family TEXT DEFAULT 'Arial',
  font_weight TEXT DEFAULT 'normal',
  color TEXT DEFAULT '#000000',
  text_align TEXT DEFAULT 'left',
  letter_spacing NUMERIC DEFAULT 0,
  line_height NUMERIC DEFAULT 1.2,
  rotation NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.area_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_template_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso total (similar aos mockups)
CREATE POLICY "Permitir tudo em area_templates" 
ON public.area_templates 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir tudo em area_template_items" 
ON public.area_template_items 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_area_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER update_area_templates_updated_at
BEFORE UPDATE ON public.area_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_area_templates_updated_at();

-- Índices para performance
CREATE INDEX idx_area_template_items_template_id ON public.area_template_items(template_id);
CREATE INDEX idx_area_templates_name ON public.area_templates(name);