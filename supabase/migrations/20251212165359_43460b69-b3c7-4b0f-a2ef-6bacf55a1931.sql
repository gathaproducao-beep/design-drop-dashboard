-- Criar tabela para templates do WhatsApp (API Oficial Meta)
CREATE TABLE public.whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  template_name text NOT NULL,
  categoria text NOT NULL DEFAULT 'UTILITY',
  idioma text NOT NULL DEFAULT 'pt_BR',
  descricao text,
  variaveis text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT whatsapp_templates_categoria_check CHECK (categoria IN ('UTILITY', 'MARKETING', 'AUTHENTICATION'))
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Política permissiva para a tabela
CREATE POLICY "Permitir tudo em whatsapp_templates" 
ON public.whatsapp_templates 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Comentários
COMMENT ON TABLE public.whatsapp_templates IS 'Templates pré-aprovados do Meta para API Oficial do WhatsApp';
COMMENT ON COLUMN public.whatsapp_templates.template_name IS 'Nome do template no Meta Business Suite (ex: order_confirmation)';
COMMENT ON COLUMN public.whatsapp_templates.categoria IS 'Categoria do template: UTILITY (transacional), MARKETING ou AUTHENTICATION';
COMMENT ON COLUMN public.whatsapp_templates.variaveis IS 'Lista de variáveis do template em ordem (ex: {nome_cliente, numero_pedido})';