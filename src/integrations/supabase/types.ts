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
      mensagens_whatsapp: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          mensagem: string
          nome: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mensagem: string
          nome: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mensagem?: string
          nome?: string
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
          created_at: string | null
          id: string
          imagem_base: string
          mockup_id: string
          nome: string
          ordem: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          imagem_base: string
          mockup_id: string
          nome: string
          ordem?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          imagem_base?: string
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
          codigo_produto: string
          created_at: string | null
          data_impressao: string | null
          data_pedido: string
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
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_produto: string
          created_at?: string | null
          data_impressao?: string | null
          data_pedido?: string
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
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_produto?: string
          created_at?: string | null
          data_impressao?: string | null
          data_pedido?: string
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
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          evolution_api_key: string
          evolution_api_url: string
          evolution_instance: string
          id: string
          is_active: boolean | null
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          evolution_api_key: string
          evolution_api_url: string
          evolution_instance: string
          id?: string
          is_active?: boolean | null
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          evolution_api_key?: string
          evolution_api_url?: string
          evolution_instance?: string
          id?: string
          is_active?: boolean | null
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          instance_id: string | null
          max_attempts: number | null
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
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          max_attempts?: number | null
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
          created_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          max_attempts?: number | null
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
          id: string
          test_phone: string | null
          updated_at: string | null
        }
        Insert: {
          auto_send_enabled?: boolean
          created_at?: string | null
          default_instance?: string
          delay_maximo?: number | null
          delay_minimo?: number | null
          id?: string
          test_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_send_enabled?: boolean
          created_at?: string | null
          default_instance?: string
          delay_maximo?: number | null
          delay_minimo?: number | null
          id?: string
          test_phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
