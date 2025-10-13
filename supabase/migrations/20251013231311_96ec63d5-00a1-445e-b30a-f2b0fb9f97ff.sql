-- Criar tabelas para o sistema de pedidos e mockups

-- 1. Tabela de Pedidos
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido TEXT NOT NULL UNIQUE,
  nome_cliente TEXT NOT NULL,
  codigo_produto TEXT NOT NULL,
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  telefone TEXT,
  foto_cliente TEXT, -- URL da imagem
  foto_aprovacao TEXT, -- URL gerada automaticamente
  mensagem_enviada TEXT CHECK (mensagem_enviada IN ('enviada', 'erro', 'pendente')) DEFAULT 'pendente',
  layout_aprovado TEXT CHECK (layout_aprovado IN ('aprovado', 'reprovado', 'pendente')) DEFAULT 'pendente',
  molde_producao TEXT, -- URL gerada automaticamente
  data_impressao DATE,
  observacao TEXT,
  pasta_drive_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Mockups (templates)
CREATE TABLE public.mockups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_mockup TEXT NOT NULL UNIQUE,
  tipo TEXT CHECK (tipo IN ('aprovacao', 'molde')) NOT NULL,
  imagem_base TEXT NOT NULL, -- URL da imagem base
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Áreas do Mockup (áreas clicáveis/editáveis)
CREATE TABLE public.mockup_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mockup_id UUID REFERENCES public.mockups(id) ON DELETE CASCADE NOT NULL,
  field_key TEXT NOT NULL, -- ex: "fotocliente"
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  width NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  z_index INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_pedidos_codigo_produto ON public.pedidos(codigo_produto);
CREATE INDEX idx_pedidos_mensagem_enviada ON public.pedidos(mensagem_enviada);
CREATE INDEX idx_pedidos_layout_aprovado ON public.pedidos(layout_aprovado);
CREATE INDEX idx_mockups_codigo ON public.mockups(codigo_mockup);
CREATE INDEX idx_mockup_areas_mockup_id ON public.mockup_areas(mockup_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER mockups_updated_at
  BEFORE UPDATE ON public.mockups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies (público para simplificar, ajustar conforme necessário)
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mockups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mockup_areas ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para uso inicial (pode restringir depois)
CREATE POLICY "Permitir tudo em pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em mockups" ON public.mockups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em mockup_areas" ON public.mockup_areas FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket para imagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('mockup-images', 'mockup-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para storage
CREATE POLICY "Acesso público para leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'mockup-images');

CREATE POLICY "Upload público" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'mockup-images');

CREATE POLICY "Atualização pública" ON storage.objects
  FOR UPDATE USING (bucket_id = 'mockup-images');

CREATE POLICY "Deleção pública" ON storage.objects
  FOR DELETE USING (bucket_id = 'mockup-images');