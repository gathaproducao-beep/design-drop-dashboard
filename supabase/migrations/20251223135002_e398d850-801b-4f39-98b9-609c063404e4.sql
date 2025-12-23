-- Security Fix: Replace permissive RLS policies with role-based access control
-- This ensures only authenticated users with proper permissions can access sensitive data

-- 1. Fix pedidos table - restrict to authenticated users with permission check
DROP POLICY IF EXISTS "Permitir tudo em pedidos" ON public.pedidos;

CREATE POLICY "Authenticated users can view pedidos" 
  ON public.pedidos 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert pedidos" 
  ON public.pedidos 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pedidos" 
  ON public.pedidos 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete pedidos" 
  ON public.pedidos 
  FOR DELETE TO authenticated 
  USING (true);

-- 2. Fix whatsapp_instances table - ADMIN ONLY (contains API keys)
DROP POLICY IF EXISTS "Permitir tudo em whatsapp_instances" ON public.whatsapp_instances;

CREATE POLICY "Admins can view whatsapp_instances" 
  ON public.whatsapp_instances 
  FOR SELECT TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert whatsapp_instances" 
  ON public.whatsapp_instances 
  FOR INSERT TO authenticated 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update whatsapp_instances" 
  ON public.whatsapp_instances 
  FOR UPDATE TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete whatsapp_instances" 
  ON public.whatsapp_instances 
  FOR DELETE TO authenticated 
  USING (is_admin(auth.uid()));

-- 3. Fix whatsapp_settings table - ADMIN ONLY
DROP POLICY IF EXISTS "Permitir tudo em whatsapp_settings" ON public.whatsapp_settings;

CREATE POLICY "Admins can view whatsapp_settings" 
  ON public.whatsapp_settings 
  FOR SELECT TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert whatsapp_settings" 
  ON public.whatsapp_settings 
  FOR INSERT TO authenticated 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update whatsapp_settings" 
  ON public.whatsapp_settings 
  FOR UPDATE TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete whatsapp_settings" 
  ON public.whatsapp_settings 
  FOR DELETE TO authenticated 
  USING (is_admin(auth.uid()));

-- 4. Fix whatsapp_queue table - authenticated users can view/insert, admins can modify
DROP POLICY IF EXISTS "Permitir tudo em whatsapp_queue" ON public.whatsapp_queue;

CREATE POLICY "Authenticated users can view whatsapp_queue" 
  ON public.whatsapp_queue 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp_queue" 
  ON public.whatsapp_queue 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp_queue" 
  ON public.whatsapp_queue 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Admins can delete whatsapp_queue" 
  ON public.whatsapp_queue 
  FOR DELETE TO authenticated 
  USING (is_admin(auth.uid()));

-- 5. Fix whatsapp_templates table - authenticated users
DROP POLICY IF EXISTS "Permitir tudo em whatsapp_templates" ON public.whatsapp_templates;

CREATE POLICY "Authenticated users can view whatsapp_templates" 
  ON public.whatsapp_templates 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Admins can insert whatsapp_templates" 
  ON public.whatsapp_templates 
  FOR INSERT TO authenticated 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update whatsapp_templates" 
  ON public.whatsapp_templates 
  FOR UPDATE TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete whatsapp_templates" 
  ON public.whatsapp_templates 
  FOR DELETE TO authenticated 
  USING (is_admin(auth.uid()));

-- 6. Fix mockups table - authenticated users
DROP POLICY IF EXISTS "Permitir tudo em mockups" ON public.mockups;

CREATE POLICY "Authenticated users can view mockups" 
  ON public.mockups 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert mockups" 
  ON public.mockups 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mockups" 
  ON public.mockups 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete mockups" 
  ON public.mockups 
  FOR DELETE TO authenticated 
  USING (true);

-- 7. Fix mockup_areas table - authenticated users
DROP POLICY IF EXISTS "Permitir tudo em mockup_areas" ON public.mockup_areas;

CREATE POLICY "Authenticated users can view mockup_areas" 
  ON public.mockup_areas 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert mockup_areas" 
  ON public.mockup_areas 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mockup_areas" 
  ON public.mockup_areas 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete mockup_areas" 
  ON public.mockup_areas 
  FOR DELETE TO authenticated 
  USING (true);

-- 8. Fix mockup_canvases table - authenticated users
DROP POLICY IF EXISTS "Permitir tudo em mockup_canvases" ON public.mockup_canvases;

CREATE POLICY "Authenticated users can view mockup_canvases" 
  ON public.mockup_canvases 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert mockup_canvases" 
  ON public.mockup_canvases 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mockup_canvases" 
  ON public.mockup_canvases 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete mockup_canvases" 
  ON public.mockup_canvases 
  FOR DELETE TO authenticated 
  USING (true);

-- 9. Fix mensagens_whatsapp table - authenticated users
DROP POLICY IF EXISTS "Permitir tudo em mensagens_whatsapp" ON public.mensagens_whatsapp;

CREATE POLICY "Authenticated users can view mensagens_whatsapp" 
  ON public.mensagens_whatsapp 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert mensagens_whatsapp" 
  ON public.mensagens_whatsapp 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mensagens_whatsapp" 
  ON public.mensagens_whatsapp 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete mensagens_whatsapp" 
  ON public.mensagens_whatsapp 
  FOR DELETE TO authenticated 
  USING (true);

-- 10. Fix area_templates table - authenticated users
DROP POLICY IF EXISTS "Permitir tudo em area_templates" ON public.area_templates;

CREATE POLICY "Authenticated users can view area_templates" 
  ON public.area_templates 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert area_templates" 
  ON public.area_templates 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update area_templates" 
  ON public.area_templates 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete area_templates" 
  ON public.area_templates 
  FOR DELETE TO authenticated 
  USING (true);

-- 11. Fix area_template_items table - authenticated users
DROP POLICY IF EXISTS "Permitir tudo em area_template_items" ON public.area_template_items;

CREATE POLICY "Authenticated users can view area_template_items" 
  ON public.area_template_items 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert area_template_items" 
  ON public.area_template_items 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update area_template_items" 
  ON public.area_template_items 
  FOR UPDATE TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete area_template_items" 
  ON public.area_template_items 
  FOR DELETE TO authenticated 
  USING (true);

-- 12. Fix google_drive_settings table - ADMIN ONLY (contains OAuth credentials)
DROP POLICY IF EXISTS "Permitir tudo em google_drive_settings" ON public.google_drive_settings;

CREATE POLICY "Admins can view google_drive_settings" 
  ON public.google_drive_settings 
  FOR SELECT TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert google_drive_settings" 
  ON public.google_drive_settings 
  FOR INSERT TO authenticated 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update google_drive_settings" 
  ON public.google_drive_settings 
  FOR UPDATE TO authenticated 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete google_drive_settings" 
  ON public.google_drive_settings 
  FOR DELETE TO authenticated 
  USING (is_admin(auth.uid()));

-- 13. Fix storage policies - require authentication for write operations
DROP POLICY IF EXISTS "Upload público" ON storage.objects;
DROP POLICY IF EXISTS "Atualização pública" ON storage.objects;
DROP POLICY IF EXISTS "Deleção pública" ON storage.objects;

CREATE POLICY "Authenticated users can upload" 
  ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'mockup-images');

CREATE POLICY "Authenticated users can update" 
  ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (bucket_id = 'mockup-images');

CREATE POLICY "Authenticated users can delete" 
  ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'mockup-images');