import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate folder name - alphanumeric, spaces, hyphens, underscores, dots, and accented characters
const isValidFolderName = (name: string): boolean => {
  if (!name || name.length > 255) return false;
  // Allow alphanumeric, spaces, hyphens, underscores, dots, and common accented characters
  return /^[\p{L}\p{N}\s_.\-]+$/u.test(name);
};

// Validate Google Drive ID format
const isValidDriveId = (id: string): boolean => {
  if (!id) return false;
  if (id === 'root') return true;
  // Google Drive IDs are alphanumeric with hyphens and underscores
  return /^[a-zA-Z0-9_-]+$/.test(id);
};

// Escape single quotes for Drive API queries
const escapeForDriveQuery = (str: string): string => {
  return str.replace(/'/g, "\\'");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[google-drive-operations] No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's auth token to verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[google-drive-operations] Invalid user token:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[google-drive-operations] Authenticated user: ${user.email}`);

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log('Operação solicitada:', action);

    // Obter access token
    const { data: authData, error: authError } = await supabase.functions.invoke('google-drive-auth');
    
    if (authError || !authData?.access_token) {
      console.error('Erro ao obter access token:', authError);
      return new Response(
        JSON.stringify({ error: 'Falha ao autenticar com Google Drive' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = authData.access_token;

    // Executar ação solicitada
    switch (action) {
      case 'list_files': {
        const folderId = params.folder_id || 'root';
        
        // Validate folder ID
        if (!isValidDriveId(folderId)) {
          console.error('[google-drive-operations] Invalid folder ID:', folderId);
          return new Response(
            JSON.stringify({ error: 'Invalid folder ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('Listando arquivos da pasta:', folderId);

        const listResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,createdTime,webViewLink)&orderBy=createdTime desc`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error('Erro ao listar arquivos:', errorText);
          return new Response(
            JSON.stringify({ error: 'Erro ao listar arquivos', details: errorText }),
            { status: listResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const listData = await listResponse.json();
        console.log(`${listData.files?.length || 0} arquivos encontrados`);

        return new Response(
          JSON.stringify({ files: listData.files || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_folder': {
        const { name, parent_folder_id } = params;
        
        // Validate folder name
        if (!isValidFolderName(name)) {
          console.error('[google-drive-operations] Invalid folder name:', name);
          return new Response(
            JSON.stringify({ error: 'Invalid folder name format. Use alphanumeric characters, spaces, hyphens, underscores, or dots.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Validate parent folder ID if provided
        if (parent_folder_id && parent_folder_id !== 'root' && !isValidDriveId(parent_folder_id)) {
          console.error('[google-drive-operations] Invalid parent folder ID:', parent_folder_id);
          return new Response(
            JSON.stringify({ error: 'Invalid parent folder ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('Criando pasta:', name);

        const metadata: any = {
          name,
          mimeType: 'application/vnd.google-apps.folder',
        };

        if (parent_folder_id && parent_folder_id !== 'root') {
          metadata.parents = [parent_folder_id];
        }

        const createResponse = await fetch(
          'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(metadata),
          }
        );

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('Erro ao criar pasta:', errorText);
          return new Response(
            JSON.stringify({ error: 'Erro ao criar pasta', details: errorText }),
            { status: createResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const folderData = await createResponse.json();
        console.log('Pasta criada:', folderData.id);

        return new Response(
          JSON.stringify(folderData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'find_folder_by_name': {
        const { name, parent_id } = params;
        
        // Validate folder name
        if (!isValidFolderName(name)) {
          console.error('[google-drive-operations] Invalid folder name:', name);
          return new Response(
            JSON.stringify({ error: 'Invalid folder name format. Use alphanumeric characters, spaces, hyphens, underscores, or dots.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Validate parent ID
        if (!isValidDriveId(parent_id)) {
          console.error('[google-drive-operations] Invalid parent ID:', parent_id);
          return new Response(
            JSON.stringify({ error: 'Invalid parent folder ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('Buscando pasta:', name, 'no parent:', parent_id);

        // Escape single quotes in name for Drive API query
        const escapedName = escapeForDriveQuery(name);
        
        // Montar query de busca with escaped values
        const searchQuery = parent_id === 'root' 
          ? `name='${escapedName}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
          : `name='${escapedName}' and '${parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,webViewLink)`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error('Erro ao buscar pasta:', errorText);
          return new Response(
            JSON.stringify({ error: 'Erro ao buscar pasta', details: errorText }),
            { status: searchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const searchData = await searchResponse.json();
        const found = searchData.files && searchData.files.length > 0;
        
        console.log(found ? 'Pasta encontrada!' : 'Pasta não encontrada');

        return new Response(
          JSON.stringify({ 
            found,
            folder: found ? searchData.files[0] : null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload_file': {
        const { file_name, file_data_base64, mime_type, folder_id } = params;
        
        // Validate file name
        if (!file_name || file_name.length > 255) {
          console.error('[google-drive-operations] Invalid file name:', file_name);
          return new Response(
            JSON.stringify({ error: 'Invalid file name' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Validate folder ID if provided
        if (folder_id && folder_id !== 'root' && !isValidDriveId(folder_id)) {
          console.error('[google-drive-operations] Invalid folder ID:', folder_id);
          return new Response(
            JSON.stringify({ error: 'Invalid folder ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('Fazendo upload do arquivo:', file_name);

        // Converter base64 para bytes
        const fileData = Uint8Array.from(atob(file_data_base64), c => c.charCodeAt(0));

        // Metadata do arquivo
        const metadata: any = {
          name: file_name,
          mimeType: mime_type,
        };

        if (folder_id && folder_id !== 'root') {
          metadata.parents = [folder_id];
        }

        // Criar boundary para multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        // Construir body multipart
        const metadataPart = delimiter + 
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata);

        const dataPart = delimiter +
          `Content-Type: ${mime_type}\r\n` +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          file_data_base64;

        const multipartBody = new TextEncoder().encode(
          metadataPart + dataPart + closeDelimiter
        );

        const uploadResponse = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('Erro ao fazer upload:', errorText);
          return new Response(
            JSON.stringify({ error: 'Erro ao fazer upload do arquivo', details: errorText }),
            { status: uploadResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const uploadData = await uploadResponse.json();
        console.log('Upload concluído:', uploadData.id);

        return new Response(
          JSON.stringify(uploadData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação não reconhecida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Erro na função google-drive-operations:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});