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
