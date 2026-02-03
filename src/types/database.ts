export interface Database {
  public: {
    Tables: {
      centros_costo: {
        Row: {
          id: string;
          nombre: string;
          codigo: string;
          descripcion: string;
          activo: boolean;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          codigo: string;
          descripcion?: string;
          activo?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          codigo?: string;
          descripcion?: string;
          activo?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [];
      };
      asociados: {
        Row: {
          id: string;
          centro_costo_id: string;
          nombre: string;
          documento: string;
          telefono: string;
          correo: string;
          direccion: string;
          dias_gracia: number;
          activo: boolean;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          centro_costo_id: string;
          nombre: string;
          documento: string;
          telefono: string;
          correo?: string;
          direccion?: string;
          dias_gracia?: number;
          activo?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Update: {
          id?: string;
          centro_costo_id?: string;
          nombre?: string;
          documento?: string;
          telefono?: string;
          correo?: string;
          direccion?: string;
          dias_gracia?: number;
          activo?: boolean;
          creado_en?: string;
          actualizado_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asociados_centro_costo_id_fkey";
            columns: ["centro_costo_id"];
            referencedRelation: "centros_costo";
            referencedColumns: ["id"];
          }
        ];
      };
      motorcycles: {
        Row: {
          id: string;
          asociado_id: string;
          brand: string;
          model: string;
          year: number;
          plate: string;
          daily_rate: number;
          plan_months: number;
          status: 'ACTIVE' | 'DEACTIVATED';
          created_at: string;
          updated_at: string;
          dias_gracia: number;
        };
        Insert: {
          id?: string;
          asociado_id: string;
          brand: string;
          model: string;
          year: number;
          plate: string;
          daily_rate: number;
          plan_months?: number;
          status?: 'ACTIVE' | 'DEACTIVATED';
          created_at?: string;
          updated_at?: string;
          dias_gracia?: number;
        };
        Update: {
          id?: string;
          asociado_id?: string;
          brand?: string;
          model?: string;
          year?: number;
          plate?: string;
          daily_rate?: number;
          plan_months?: number;
          status?: 'ACTIVE' | 'DEACTIVATED';
          created_at?: string;
          updated_at?: string;
          dias_gracia?: number;
        };
        Relationships: [
          {
            foreignKeyName: "motorcycles_asociado_id_fkey";
            columns: ["asociado_id"];
            referencedRelation: "asociados";
            referencedColumns: ["id"];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          motorcycle_id: string;
          asociado_id: string;
          amount: number;
          payment_date: string;
          receipt_number: string;
          notes: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          motorcycle_id: string;
          asociado_id: string;
          amount: number;
          payment_date: string;
          receipt_number: string;
          notes?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          motorcycle_id?: string;
          asociado_id?: string;
          amount?: number;
          payment_date?: string;
          receipt_number?: string;
          notes?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_asociado_id_fkey";
            columns: ["asociado_id"];
            referencedRelation: "asociados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          }
        ];
      };
      payment_distributions: {
        Row: {
          id: string;
          payment_id: string;
          associate_amount: number;
          company_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          associate_amount: number;
          company_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          associate_amount?: number;
          company_amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_distributions_payment_id_fkey";
            columns: ["payment_id"];
            referencedRelation: "payments";
            referencedColumns: ["id"];
          }
        ];
      };
      deactivations: {
        Row: {
          id: string;
          motorcycle_id: string;
          asociado_id: string;
          deactivation_date: string;
          days_overdue: number;
          reason: string;
          reactivation_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          motorcycle_id: string;
          asociado_id: string;
          deactivation_date: string;
          days_overdue: number;
          reason: string;
          reactivation_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          motorcycle_id?: string;
          asociado_id?: string;
          deactivation_date?: string;
          days_overdue?: number;
          reason?: string;
          reactivation_date?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deactivations_asociado_id_fkey";
            columns: ["asociado_id"];
            referencedRelation: "asociados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deactivations_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          asociado_id: string;
          motorcycle_id: string;
          type: 'WARNING' | 'DEACTIVATION';
          message: string;
          sent_at: string | null;
          status: 'PENDING' | 'SENT' | 'FAILED';
          channel: 'SMS' | 'WHATSAPP';
          created_at: string;
        };
        Insert: {
          id?: string;
          asociado_id: string;
          motorcycle_id: string;
          type: 'WARNING' | 'DEACTIVATION';
          message: string;
          sent_at?: string | null;
          status?: 'PENDING' | 'SENT' | 'FAILED';
          channel?: 'SMS' | 'WHATSAPP';
          created_at?: string;
        };
        Update: {
          id?: string;
          asociado_id?: string;
          motorcycle_id?: string;
          type: 'WARNING' | 'DEACTIVATION';
          message?: string;
          sent_at?: string | null;
          status?: 'PENDING' | 'SENT' | 'FAILED';
          channel?: 'SMS' | 'WHATSAPP';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_asociado_id_fkey";
            columns: ["asociado_id"];
            referencedRelation: "asociados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          }
        ];
      };
      daily_status: {
        Row: {
          id: string;
          motorcycle_id: string;
          asociado_id: string;
          status_date: string;
          days_overdue: number;
          balance: number;
          status: 'CURRENT' | 'OVERDUE' | 'DEACTIVATED';
          created_at: string;
        };
        Insert: {
          id?: string;
          motorcycle_id: string;
          asociado_id: string;
          status_date: string;
          days_overdue?: number;
          balance?: number;
          status?: 'CURRENT' | 'OVERDUE' | 'DEACTIVATED';
          created_at?: string;
        };
        Update: {
          id?: string;
          motorcycle_id?: string;
          asociado_id?: string;
          status_date?: string;
          days_overdue?: number;
          balance?: number;
          status?: 'CURRENT' | 'OVERDUE' | 'DEACTIVATED';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_status_asociado_id_fkey";
            columns: ["asociado_id"];
            referencedRelation: "asociados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_status_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
  };
}

export type CostCenter = Database['public']['Tables']['centros_costo']['Row'];
export type Asociado = Database['public']['Tables']['asociados']['Row'];
export type Motorcycle = Database['public']['Tables']['motorcycles']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentDistribution = Database['public']['Tables']['payment_distributions']['Row'];
export type Deactivation = Database['public']['Tables']['deactivations']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type DailyStatus = Database['public']['Tables']['daily_status']['Row'];
