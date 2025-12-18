import { supabase } from "@/integrations/supabase/client";

export interface DriveUploadResult {
  folderId: string;
  folderUrl: string;
}

/**
 * Upload de imagens para Google Drive
 */
export async function uploadImagesToDrive(
  pedido: any,
  images: { url: string; name: string }[],
  onProgress?: (message: string) => void
): Promise<DriveUploadResult | null> {
  try {
    // Verificar se a integração está habilitada E auto-upload está habilitado
    const { data: settings } = await supabase
      .from("google_drive_settings")
      .select("auto_upload_enabled, root_folder_id, folder_structure, integration_enabled")
      .limit(1)
      .maybeSingle();

    // Verificar primeiro se a integração está habilitada
    if (!(settings as any)?.integration_enabled) {
      console.log("Integração com Google Drive desabilitada");
      return null;
    }

    if (!settings?.auto_upload_enabled) {
      console.log("Auto-upload do Drive desabilitado");
      return null;
    }

    onProgress?.("Criando pasta no Google Drive...");

    // Criar ou buscar pasta do pedido
    const folderName = `Pedido ${pedido.numero_pedido}`;
    const parentFolderId = settings.root_folder_id || "root";

    const { data: folderData, error: folderError } = await supabase.functions.invoke(
      "google-drive-operations",
      {
        body: {
          action: "create_folder",
          name: folderName,
          parent_folder_id: parentFolderId,
        },
      }
    );

    if (folderError) throw folderError;

    // Upload de cada imagem
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      onProgress?.(`Enviando ${image.name} para Drive (${i + 1}/${images.length})...`);

      // Buscar a imagem e converter para base64
      const response = await fetch(image.url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(",")[1]);
        };
        reader.readAsDataURL(blob);
      });

      // Upload para o Drive
      const { error: uploadError } = await supabase.functions.invoke(
        "google-drive-operations",
        {
          body: {
            action: "upload_file",
            file_name: image.name,
            file_data_base64: base64,
            mime_type: "image/png",
            folder_id: folderData.id,
          },
        }
      );

      if (uploadError) {
        console.error(`Erro ao enviar ${image.name}:`, uploadError);
        // Continua com os outros arquivos mesmo se um falhar
      }
    }

    onProgress?.("Arquivos enviados para Drive!");

    return {
      folderId: folderData.id,
      folderUrl: folderData.webViewLink,
    };
  } catch (error) {
    console.error("Erro ao enviar para Google Drive:", error);
    return null;
  }
}

/**
 * Helper para converter imagem para base64
 */
async function imageToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(",")[1]);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Helper para upload em lote com retry e limite de concorrência
 */
async function uploadFilesInBatches(
  files: Array<{ url: string; fileName: string; folderId: string }>,
  onProgress?: (message: string) => void,
  maxConcurrent = 3
): Promise<void> {
  const results: Array<{ success: boolean; fileName: string; error?: any }> = [];
  
  // Processar em lotes
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async (file, batchIndex) => {
      const fileIndex = i + batchIndex + 1;
      const totalFiles = files.length;
      
      try {
        onProgress?.(`Enviando ${file.fileName} (${fileIndex}/${totalFiles})...`);
        
        const base64 = await imageToBase64(file.url);
        
        const { error } = await supabase.functions.invoke("google-drive-operations", {
          body: {
            action: "upload_file",
            file_name: file.fileName,
            file_data_base64: base64,
            mime_type: "image/png",
            folder_id: file.folderId,
          },
        });
        
        if (error) throw error;
        
        results.push({ success: true, fileName: file.fileName });
      } catch (error) {
        console.error(`Erro ao enviar ${file.fileName}:`, error);
        results.push({ success: false, fileName: file.fileName, error });
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  const failedUploads = results.filter(r => !r.success);
  if (failedUploads.length > 0) {
    console.warn(`${failedUploads.length} arquivos falharam no upload:`, failedUploads);
  }
}

/**
 * Upload de pedido para Google Drive organizado por data (OTIMIZADO)
 */
export async function uploadPedidoToDriveByDate(
  pedido: any,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; folderUrl?: string }> {
  try {
    // 1. Validações iniciais
    if (pedido.layout_aprovado !== "aprovado") {
      throw new Error("Layout precisa estar aprovado para salvar no Drive");
    }

    if (!pedido.foto_aprovacao || pedido.foto_aprovacao.length === 0) {
      throw new Error("Nenhuma foto de aprovação para enviar");
    }

    // Verificar se a integração está habilitada
    const { data: integrationCheck } = await supabase
      .from("google_drive_settings")
      .select("integration_enabled")
      .limit(1)
      .maybeSingle();

    if (!(integrationCheck as any)?.integration_enabled) {
      throw new Error("Integração com Google Drive está desabilitada. Habilite nas configurações.");
    }

    // 2. Obter configurações
    const { data: settings } = await supabase
      .from("google_drive_settings")
      .select("root_folder_id")
      .limit(1)
      .maybeSingle();

    const rootFolderId = settings?.root_folder_id || "root";

    // 3. Formatar data
    const dataPedido = new Date(pedido.data_pedido);
    const dia = String(dataPedido.getDate()).padStart(2, '0');
    const mes = String(dataPedido.getMonth() + 1).padStart(2, '0');
    const ano = dataPedido.getFullYear();
    const dataFormatada = `${dia}-${mes}-${ano}`;

    onProgress?.(`Verificando pastas...`);

    // 4. Buscar/criar pastas em PARALELO (reduz de 3 chamadas sequenciais para 1)
    const [dateResult, fotoResult, moldeResult] = await Promise.all([
      // Buscar ou criar pasta da data
      supabase.functions.invoke("google-drive-operations", {
        body: {
          action: "find_folder_by_name",
          name: dataFormatada,
          parent_id: rootFolderId,
        },
      }).then(async ({ data }) => {
        if (data.found) {
          return { id: data.folder.id, url: data.folder.webViewLink };
        }
        const { data: newFolder } = await supabase.functions.invoke("google-drive-operations", {
          body: {
            action: "create_folder",
            name: dataFormatada,
            parent_folder_id: rootFolderId,
          },
        });
        return { id: newFolder.id, url: newFolder.webViewLink };
      }),
      
      // Preparar busca de "Foto Aprovação" (aguarda pasta da data)
      Promise.resolve(null),
      
      // Preparar busca de "Molde" (aguarda pasta da data)
      Promise.resolve(null),
    ]);

    const dateFolderId = dateResult.id;
    const dateFolderUrl = dateResult.url;

    // 5. Buscar/criar subpastas em PARALELO
    const needsMolde = pedido.molde_producao && pedido.molde_producao.length > 0;
    
    const [fotoFolder, moldeFolder] = await Promise.all([
      // Foto Aprovação
      supabase.functions.invoke("google-drive-operations", {
        body: {
          action: "find_folder_by_name",
          name: "Foto Aprovação",
          parent_id: dateFolderId,
        },
      }).then(async ({ data }) => {
        if (data.found) return data.folder.id;
        const { data: newFolder } = await supabase.functions.invoke("google-drive-operations", {
          body: {
            action: "create_folder",
            name: "Foto Aprovação",
            parent_folder_id: dateFolderId,
          },
        });
        return newFolder.id;
      }),
      
      // Molde (só se necessário)
      needsMolde
        ? supabase.functions.invoke("google-drive-operations", {
            body: {
              action: "find_folder_by_name",
              name: "Molde",
              parent_id: dateFolderId,
            },
          }).then(async ({ data }) => {
            if (data.found) return data.folder.id;
            const { data: newFolder } = await supabase.functions.invoke("google-drive-operations", {
              body: {
                action: "create_folder",
                name: "Molde",
                parent_folder_id: dateFolderId,
              },
            });
            return newFolder.id;
          })
        : Promise.resolve(null),
    ]);

    // 6. Upload de TODOS os arquivos em lotes paralelos (3 por vez)
    const allFiles: Array<{ url: string; fileName: string; folderId: string }> = [];
    
    // Fotos de aprovação
    pedido.foto_aprovacao.forEach((url: string, i: number) => {
      allFiles.push({
        url,
        fileName: `${pedido.numero_pedido}-aprovacao-${i + 1}.png`,
        folderId: fotoFolder,
      });
    });
    
    // Moldes
    if (needsMolde && moldeFolder) {
      pedido.molde_producao.forEach((url: string, i: number) => {
        allFiles.push({
          url,
          fileName: `${pedido.numero_pedido}-molde-${i + 1}.png`,
          folderId: moldeFolder,
        });
      });
    }
    
    await uploadFilesInBatches(allFiles, onProgress, 3);

    // 7. Atualizar pedido no banco
    await supabase
      .from("pedidos")
      .update({
        drive_folder_id: dateFolderId,
        drive_folder_url: dateFolderUrl,
      })
      .eq("id", pedido.id);

    onProgress?.("✓ Arquivos salvos no Drive!");

    return { success: true, folderUrl: dateFolderUrl };
  } catch (error: any) {
    console.error("Erro ao enviar para Drive:", error);
    throw error;
  }
}
