-- =============================================
-- SISTEMA DE ATENDIMENTO WHATSAPP - TABELAS
-- =============================================

-- 1. Tabela de Contatos/Leads
CREATE TABLE public.whatsapp_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  is_lead BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de Conversas
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_atendimento', 'aguardando_cliente', 'aguardando_interno', 'resolvido', 'pos_venda', 'finalizado')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, instance_id)
);

-- 3. Tabela de Mensagens
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video', 'sticker')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  caption TEXT,
  sender_phone TEXT,
  sender_name TEXT,
  sent_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  external_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Tabela de Notas Internas
CREATE TABLE public.whatsapp_internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Tabela de Respostas Rápidas
CREATE TABLE public.whatsapp_quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  shortcut TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Tabela de Auditoria
CREATE TABLE public.whatsapp_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_whatsapp_contacts_phone ON public.whatsapp_contacts(phone);
CREATE INDEX idx_whatsapp_contacts_last_message ON public.whatsapp_contacts(last_message_at DESC);

CREATE INDEX idx_whatsapp_conversations_contact ON public.whatsapp_conversations(contact_id);
CREATE INDEX idx_whatsapp_conversations_instance ON public.whatsapp_conversations(instance_id);
CREATE INDEX idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX idx_whatsapp_conversations_assigned ON public.whatsapp_conversations(assigned_to);
CREATE INDEX idx_whatsapp_conversations_last_message ON public.whatsapp_conversations(last_message_at DESC);

CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_external ON public.whatsapp_messages(external_id);
CREATE INDEX idx_whatsapp_messages_content_search ON public.whatsapp_messages USING gin(to_tsvector('portuguese', content));

CREATE INDEX idx_whatsapp_internal_notes_conversation ON public.whatsapp_internal_notes(conversation_id);
CREATE INDEX idx_whatsapp_internal_notes_contact ON public.whatsapp_internal_notes(contact_id);
CREATE INDEX idx_whatsapp_internal_notes_pedido ON public.whatsapp_internal_notes(pedido_id);

CREATE INDEX idx_whatsapp_audit_log_user ON public.whatsapp_audit_log(user_id);
CREATE INDEX idx_whatsapp_audit_log_entity ON public.whatsapp_audit_log(entity_type, entity_id);
CREATE INDEX idx_whatsapp_audit_log_created ON public.whatsapp_audit_log(created_at DESC);

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_whatsapp_quick_replies_updated_at
  BEFORE UPDATE ON public.whatsapp_quick_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas para whatsapp_contacts
CREATE POLICY "Authenticated users can view whatsapp_contacts"
  ON public.whatsapp_contacts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp_contacts"
  ON public.whatsapp_contacts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp_contacts"
  ON public.whatsapp_contacts FOR UPDATE
  USING (true);

-- Políticas para whatsapp_conversations
CREATE POLICY "Authenticated users can view whatsapp_conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp_conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp_conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (true);

-- Políticas para whatsapp_messages
CREATE POLICY "Authenticated users can view whatsapp_messages"
  ON public.whatsapp_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp_messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp_messages"
  ON public.whatsapp_messages FOR UPDATE
  USING (true);

-- Políticas para whatsapp_internal_notes
CREATE POLICY "Authenticated users can view whatsapp_internal_notes"
  ON public.whatsapp_internal_notes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp_internal_notes"
  ON public.whatsapp_internal_notes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp_internal_notes"
  ON public.whatsapp_internal_notes FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete whatsapp_internal_notes"
  ON public.whatsapp_internal_notes FOR DELETE
  USING (true);

-- Políticas para whatsapp_quick_replies
CREATE POLICY "Authenticated users can view whatsapp_quick_replies"
  ON public.whatsapp_quick_replies FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage whatsapp_quick_replies"
  ON public.whatsapp_quick_replies FOR ALL
  USING (is_admin(auth.uid()));

-- Políticas para whatsapp_audit_log
CREATE POLICY "Admins can view whatsapp_audit_log"
  ON public.whatsapp_audit_log FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can insert whatsapp_audit_log"
  ON public.whatsapp_audit_log FOR INSERT
  WITH CHECK (true);

-- =============================================
-- HABILITAR REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- =============================================
-- FUNÇÃO PARA VINCULAR CONTATOS A PEDIDOS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_contact_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando um contato é atualizado, verificar se tem pedidos vinculados
  UPDATE public.whatsapp_contacts
  SET is_lead = NOT EXISTS (
    SELECT 1 FROM public.pedidos 
    WHERE telefone IS NOT NULL 
    AND replace(replace(replace(telefone, ' ', ''), '-', ''), '+', '') 
      LIKE '%' || replace(replace(replace(NEW.phone, ' ', ''), '-', ''), '+', '') || '%'
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- FUNÇÃO PARA BUSCA GLOBAL
-- =============================================

CREATE OR REPLACE FUNCTION public.search_whatsapp_messages(search_query TEXT)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  contact_name TEXT,
  contact_phone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.conversation_id,
    m.content,
    m.created_at,
    c.name as contact_name,
    c.phone as contact_phone
  FROM public.whatsapp_messages m
  JOIN public.whatsapp_conversations conv ON conv.id = m.conversation_id
  JOIN public.whatsapp_contacts c ON c.id = conv.contact_id
  WHERE m.content ILIKE '%' || search_query || '%'
  ORDER BY m.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;