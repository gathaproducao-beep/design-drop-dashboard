-- Create storage bucket for whatsapp media if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('whatsapp-media', 'whatsapp-media', true, 52428800, ARRAY['image/*', 'video/*', 'audio/*', 'application/*'])
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public access to whatsapp media files
CREATE POLICY "Public access to whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Create policy to allow service role to upload media
CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

-- Create policy to allow service role to delete media
CREATE POLICY "Service role can delete whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media');