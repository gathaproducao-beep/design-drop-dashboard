export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_profiles: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      area_template_items: {
        Row: {
          color: string | null
          created_at: string
          field_key: string
          font_family: string | null
          font_size: number | null
          font_weight: string | null
          height: number
          id: string
          kind: string
          letter_spacing: number | null
          line_height: number | null
          rotation: number | null
          template_id: string
          text_align: string | null
          width: number
          x: number
          y: number
          z_index: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          field_key: string
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height: number
          id?: string
          kind?: string
          letter_spacing?: number | null
          line_height?: number | null
          rotation?: number | null
          template_id: string
          text_align?: string | null
          width: number
          x: number
          y: number
          z_index?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          field_key?: string
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height?: number
          id?: string
          kind?: string
          letter_spacing?: number | null
          line_height?: number | null
          rotation?: number | null
          template_id?: string
          text_align?: string | null
          width?: number
          x?: number
          y?: number
          z_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "area_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "area_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      area_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_drive_settings: {
        Row: {
          auto_upload_enabled: boolean
          client_id: string
          client_secret: string
          created_at: string | null
          folder_structure: string
          id: string
          integration_enabled: boolean
          refresh_token: string
          root_folder_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_upload_enabled?: boolean
          client_id: string
          client_secret: string
          created_at?: string | null
          folder_structure?: string
          id?: string
          integration_enabled?: boolean
          refresh_token: string
          root_folder_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_upload_enabled?: boolean
          client_id?: string
          client_secret?: string
          created_at?: string | null
          folder_structure?: string
          id?: string
          integration_enabled?: boolean
          refresh_token?: string
          root_folder_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mensagens_whatsapp: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          mensagem: string
          mensagens_anteriores: string[] | null
          nome: string
          partes_mensagem: string[] | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mensagem: string
          mensagens_anteriores?: string[] | null
          nome: string
          partes_mensagem?: string[] | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mensagem?: string
          mensagens_anteriores?: string[] | null
          nome?: string
          partes_mensagem?: string[] | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mockup_areas: {
        Row: {
          canvas_id: string | null
          color: string | null
          created_at: string | null
          field_key: string
          font_family: string | null
          font_size: number | null
          font_weight: string | null
          height: number
          id: string
          kind: string
          letter_spacing: number | null
          line_height: number | null
          mockup_id: string
          rotation: number | null
          text_align: string | null
          width: number
          x: number
          y: number
          z_index: number | null
        }
        Insert: {
          canvas_id?: string | null
          color?: string | null
          created_at?: string | null
          field_key: string
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height: number
          id?: string
          kind?: string
          letter_spacing?: number | null
          line_height?: number | null
          mockup_id: string
          rotation?: number | null
          text_align?: string | null
          width: number
          x: number
          y: number
          z_index?: number | null
        }
        Update: {
          canvas_id?: string | null
          color?: string | null
          created_at?: string | null
          field_key?: string
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height?: number
          id?: string
          kind?: string
          letter_spacing?: number | null
          line_height?: number | null
          mockup_id?: string
          rotation?: number | null
          text_align?: string | null
          width?: number
          x?: number
          y?: number
          z_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mockup_areas_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "mockup_canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mockup_areas_mockup_id_fkey"
            columns: ["mockup_id"]
            isOneToOne: false
            referencedRelation: "mockups"
            referencedColumns: ["id"]
          },
        ]
      }
      mockup_canvases: {
        Row: {
          altura_original: number | null
          created_at: string | null
          escala_calculada: number | null
          id: string
          imagem_base: string
          largura_original: number | null
          mockup_id: string
          nome: string
          ordem: number
          updated_at: string | null
        }
        Insert: {
          altura_original?: number | null
          created_at?: string | null
          escala_calculada?: number | null
          id?: string
          imagem_base: string
          largura_original?: number | null
          mockup_id: string
          nome: string
          ordem?: number
          updated_at?: string | null
        }
        Update: {
          altura_original?: number | null
          created_at?: string | null
          escala_calculada?: number | null
          id?: string
          imagem_base?: string
          largura_original?: number | null
          mockup_id?: string
          nome?: string
          ordem?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mockup_canvases_mockup_id_fkey"
            columns: ["mockup_id"]
            isOneToOne: false
            referencedRelation: "mockups"
            referencedColumns: ["id"]
          },
        ]
      }
      mockups: {
        Row: {
          codigo_mockup: string
          created_at: string | null
          id: string
          imagem_base: string
          mockup_aprovacao_vinculado_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          codigo_mockup: string
          created_at?: string | null
          id?: string
          imagem_base: string
          mockup_aprovacao_vinculado_id?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          codigo_mockup?: string
          created_at?: string | null
          id?: string
          imagem_base?: string
          mockup_aprovacao_vinculado_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mockups_mockup_aprovacao_vinculado_id_fkey"
            columns: ["mockup_aprovacao_vinculado_id"]
            isOneToOne: false
            referencedRelation: "mockups"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          arquivado: boolean | null
          codigo_produto: string
          created_at: string | null
          data_impressao: string | null
          data_pedido: string
          drive_folder_id: string | null
          drive_folder_url: string | null
          foto_aprovacao: string[] | null
          foto_cliente: string | null
          fotos_cliente: string[] | null
          id: string
          layout_aprovado: string | null
          mensagem_enviada: string | null
          molde_producao: string[] | null
          nome_cliente: string
          numero_pedido: string
          observacao: string | null
          pasta_drive_url: string | null
          salvar_drive: boolean | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          arquivado?: boolean | null
          codigo_produto: string
          created_at?: string | null
          data_impressao?: string | null
          data_pedido?: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          foto_aprovacao?: string[] | null
          foto_cliente?: string | null
          fotos_cliente?: string[] | null
          id?: string
          layout_aprovado?: string | null
          mensagem_enviada?: string | null
          molde_producao?: string[] | null
          nome_cliente: string
          numero_pedido: string
          observacao?: string | null
          pasta_drive_url?: string | null
          salvar_drive?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          arquivado?: boolean | null
          codigo_produto?: string
          created_at?: string | null
          data_impressao?: string | null
          data_pedido?: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          foto_aprovacao?: string[] | null
          foto_cliente?: string | null
          fotos_cliente?: string[] | null
          id?: string
          layout_aprovado?: string | null
          mensagem_enviada?: string | null
          molde_producao?: string[] | null
          nome_cliente?: string
          numero_pedido?: string
          observacao?: string | null
          pasta_drive_url?: string | null
          salvar_drive?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profile_permissions: {
        Row: {
          access_profile_id: string
          id: string
          permission_id: string
        }
        Insert: {
          access_profile_id: string
          id?: string
          permission_id: string
        }
        Update: {
          access_profile_id?: string
          id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          access_profile_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          access_profile_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          access_profile_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          access_token: string | null
          api_type: string
          created_at: string | null
          evolution_api_key: string
          evolution_api_url: string
          evolution_instance: string
          id: string
          is_active: boolean | null
          nome: string
          ordem: number | null
          phone_number_id: string | null
          updated_at: string | null
          waba_id: string | null
          webhook_headers: Json | null
          webhook_url: string | null
        }
        Insert: {
          access_token?: string | null
          api_type?: string
          created_at?: string | null
          evolution_api_key: string
          evolution_api_url: string
          evolution_instance: string
          id?: string
          is_active?: boolean | null
          nome: string
          ordem?: number | null
          phone_number_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
          webhook_headers?: Json | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string | null
          api_type?: string
          created_at?: string | null
          evolution_api_key?: string
          evolution_api_url?: string
          evolution_instance?: string
          id?: string
          is_active?: boolean | null
          nome?: string
          ordem?: number | null
          phone_number_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
          webhook_headers?: Json | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_queue: {
        Row: {
          attempts: number | null
          cancelled_at: string | null
          caption: string | null
          created_at: string | null
          error_message: string | null
          id: string
          instance_id: string | null
          max_attempts: number | null
          media_type: string | null
          media_url: string | null
          message: string
          pedido_id: string | null
          phone: string
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          cancelled_at?: string | null
          caption?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          max_attempts?: number | null
          media_type?: string | null
          media_url?: string | null
          message: string
          pedido_id?: string | null
          phone: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          cancelled_at?: string | null
          caption?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          max_attempts?: number | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          pedido_id?: string | null
          phone?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_queue_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          auto_send_enabled: boolean
          created_at: string | null
          default_instance: string
          delay_maximo: number | null
          delay_minimo: number | null
          envio_pausado: boolean
          id: string
          mensagens_por_instancia: number | null
          rotacao_contador: number | null
          rotacao_instancia_atual: string | null
          test_phone: string | null
          updated_at: string | null
          usar_todas_instancias: boolean | null
        }
        Insert: {
          auto_send_enabled?: boolean
          created_at?: string | null
          default_instance?: string
          delay_maximo?: number | null
          delay_minimo?: number | null
          envio_pausado?: boolean
          id?: string
          mensagens_por_instancia?: number | null
          rotacao_contador?: number | null
          rotacao_instancia_atual?: string | null
          test_phone?: string | null
          updated_at?: string | null
          usar_todas_instancias?: boolean | null
        }
        Update: {
          auto_send_enabled?: boolean
          created_at?: string | null
          default_instance?: string
          delay_maximo?: number | null
          delay_minimo?: number | null
          envio_pausado?: boolean
          id?: string
          mensagens_por_instancia?: number | null
          rotacao_contador?: number | null
          rotacao_instancia_atual?: string | null
          test_phone?: string | null
          updated_at?: string | null
          usar_todas_instancias?: boolean | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          categoria: string
          created_at: string | null
          descricao: string | null
          has_header_media: boolean | null
          header_media_field: string | null
          id: string
          idioma: string
          is_active: boolean | null
          nome: string
          status: string | null
          template_name: string
          updated_at: string | null
          variaveis: string[] | null
        }
        Insert: {
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          has_header_media?: boolean | null
          header_media_field?: string | null
          id?: string
          idioma?: string
          is_active?: boolean | null
          nome: string
          status?: string | null
          template_name: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          has_header_media?: boolean | null
          header_media_field?: string | null
          id?: string
          idioma?: string
          is_active?: boolean | null
          nome?: string
          status?: string | null
          template_name?: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_and_lock_pending_messages: {
        Args: { batch_size: number; check_time: string }
        Returns: {
          attempts: number | null
          cancelled_at: string | null
          caption: string | null
          created_at: string | null
          error_message: string | null
          id: string
          instance_id: string | null
          max_attempts: number | null
          media_type: string | null
          media_url: string | null
          message: string
          pedido_id: string | null
          phone: string
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      user_has_permission: {
        Args: { check_user_id: string; permission_code: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
