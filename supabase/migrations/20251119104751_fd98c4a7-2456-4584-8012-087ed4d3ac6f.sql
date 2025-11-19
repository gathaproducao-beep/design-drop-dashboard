-- Adicionar campos de delay na tabela whatsapp_settings
ALTER TABLE public.whatsapp_settings
ADD COLUMN IF NOT EXISTS delay_minimo integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS delay_maximo integer DEFAULT 15;

-- Criar tabela de instâncias WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  evolution_api_url text NOT NULL,
  evolution_api_key text NOT NULL,
  evolution_instance text NOT NULL,
  is_active boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar RLS para whatsapp_instances
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo em whatsapp_instances"
ON public.whatsapp_instances FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para updated_at em whatsapp_instances
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Criar tabela de fila de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending', -- pending, processing, sent, failed
  instance_id uuid REFERENCES public.whatsapp_instances(id),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  scheduled_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_queue_status ON public.whatsapp_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON public.whatsapp_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_created ON public.whatsapp_queue(created_at);

-- RLS para whatsapp_queue
ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo em whatsapp_queue"
ON public.whatsapp_queue FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para updated_at em whatsapp_queue
CREATE TRIGGER update_whatsapp_queue_updated_at
BEFORE UPDATE ON public.whatsapp_queue
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();