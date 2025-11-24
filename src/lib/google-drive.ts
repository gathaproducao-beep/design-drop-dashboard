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
    // Verificar se auto-upload está habilitado
    const { data: settings } = await supabase
      .from("google_drive_settings")
      .select("auto_upload_enabled, root_folder_id, folder_structure")
      .limit(1)
      .maybeSingle();

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
 * Upload de pedido para Google Drive organizado por data
 */
export async function uploadPedidoToDriveByDate(
  pedido: any,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; folderUrl?: string }> {
  try {
    // 1. Validar se layout está aprovado
    if (pedido.layout_aprovado !== "aprovado") {
      throw new Error("Layout precisa estar aprovado para salvar no Drive");
    }

    // 2. Validar se tem fotos
    if (!pedido.foto_aprovacao || pedido.foto_aprovacao.length === 0) {
      throw new Error("Nenhuma foto de aprovação para enviar");
    }

    // 3. Obter configurações do Drive
    const { data: settings } = await supabase
      .from("google_drive_settings")
      .select("root_folder_id")
      .limit(1)
      .maybeSingle();

    const rootFolderId = settings?.root_folder_id || "root";

    // 4. Formatar data (DD-MM-YYYY)
    const dataPedido = new Date(pedido.data_pedido);
    const dia = String(dataPedido.getDate()).padStart(2, '0');
    const mes = String(dataPedido.getMonth() + 1).padStart(2, '0');
    const ano = dataPedido.getFullYear();
    const dataFormatada = `${dia}-${mes}-${ano}`;

    onProgress?.(`Verificando pasta ${dataFormatada}...`);

    // 5. Buscar ou criar pasta da data
    const { data: searchData } = await supabase.functions.invoke(
      "google-drive-operations",
      {
        body: {
          action: "find_folder_by_name",
          name: dataFormatada,
          parent_id: rootFolderId,
        },
      }
    );

    let dateFolderId;
    let dateFolderUrl;

    if (searchData.found) {
      dateFolderId = searchData.folder.id;
      dateFolderUrl = searchData.folder.webViewLink;
    } else {
      onProgress?.(`Criando pasta ${dataFormatada}...`);
      const { data: newFolder } = await supabase.functions.invoke(
        "google-drive-operations",
        {
          body: {
            action: "create_folder",
            name: dataFormatada,
            parent_folder_id: rootFolderId,
          },
        }
      );
      dateFolderId = newFolder.id;
      dateFolderUrl = newFolder.webViewLink;
    }

    // 6. Criar/buscar subpasta "Foto Aprovação"
    onProgress?.("Verificando subpasta Foto Aprovação...");
    const { data: fotoSearchData } = await supabase.functions.invoke(
      "google-drive-operations",
      {
        body: {
          action: "find_folder_by_name",
          name: "Foto Aprovação",
          parent_id: dateFolderId,
        },
      }
    );

    let fotoFolderId;
    if (fotoSearchData.found) {
      fotoFolderId = fotoSearchData.folder.id;
    } else {
      const { data: fotoFolder } = await supabase.functions.invoke(
        "google-drive-operations",
        {
          body: {
            action: "create_folder",
            name: "Foto Aprovação",
            parent_folder_id: dateFolderId,
          },
        }
      );
      fotoFolderId = fotoFolder.id;
    }

    // 7. Upload das fotos de aprovação
    for (let i = 0; i < pedido.foto_aprovacao.length; i++) {
      const imageUrl = pedido.foto_aprovacao[i];
      onProgress?.(`Enviando foto ${i + 1}/${pedido.foto_aprovacao.length}...`);

      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(",")[1]);
        };
        reader.readAsDataURL(blob);
      });

      await supabase.functions.invoke("google-drive-operations", {
        body: {
          action: "upload_file",
          file_name: `${pedido.numero_pedido}-aprovacao-${i + 1}.png`,
          file_data_base64: base64,
          mime_type: "image/png",
          folder_id: fotoFolderId,
        },
      });
    }

    // 8. Criar/buscar subpasta "Molde"
    if (pedido.molde_producao && pedido.molde_producao.length > 0) {
      onProgress?.("Verificando subpasta Molde...");
      const { data: moldeSearchData } = await supabase.functions.invoke(
        "google-drive-operations",
        {
          body: {
            action: "find_folder_by_name",
            name: "Molde",
            parent_id: dateFolderId,
          },
        }
      );

      let moldeFolderId;
      if (moldeSearchData.found) {
        moldeFolderId = moldeSearchData.folder.id;
      } else {
        const { data: moldeFolder } = await supabase.functions.invoke(
          "google-drive-operations",
          {
            body: {
              action: "create_folder",
              name: "Molde",
              parent_folder_id: dateFolderId,
            },
          }
        );
        moldeFolderId = moldeFolder.id;
      }

      // 9. Upload dos moldes
      for (let i = 0; i < pedido.molde_producao.length; i++) {
        const imageUrl = pedido.molde_producao[i];
        onProgress?.(`Comprimindo molde ${i + 1}/${pedido.molde_producao.length}...`);

        const base64 = await compressImage(imageUrl);

        onProgress?.(`Enviando molde ${i + 1}/${pedido.molde_producao.length}...`);

        await supabase.functions.invoke("google-drive-operations", {
          body: {
            action: "upload_file",
            file_name: `${pedido.numero_pedido}-molde-${i + 1}.png`,
            file_data_base64: base64,
            mime_type: "image/png",
            folder_id: moldeFolderId,
          },
        });
      }
    }

    // 10. Atualizar pedido no banco
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
