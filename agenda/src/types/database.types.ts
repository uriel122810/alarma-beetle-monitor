// ============================================================
// TIPOS GENERADOS MANUALMENTE PARA SUPABASE
// En producción: npx supabase gen types typescript --linked > src/types/database.types.ts
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type UserRole = 'admin' | 'employee';
export type EmailType = 'individual' | 'bulk' | 'meeting_invitation';

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string;
          role: UserRole;
          department_id: string | null;
          position: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      oauth_tokens: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          token_type: string;
          scope: string | null;
          expiry_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['oauth_tokens']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['oauth_tokens']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          assigned_to: string;
          assigned_by: string;
          department_id: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          due_date: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at' | 'completed_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      task_attachments: {
        Row: {
          id: string;
          task_id: string;
          file_name: string;
          file_url: string;
          file_size: number | null;
          mime_type: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['task_attachments']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['task_attachments']['Insert']>;
      };
      meetings: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          organizer_id: string;
          location: string | null;
          start_time: string;
          end_time: string;
          attendees: Json;
          notification_sent: boolean;
          google_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['meetings']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>;
      };
      email_logs: {
        Row: {
          id: string;
          sent_by: string | null;
          email_type: EmailType;
          recipients: Json;
          subject: string | null;
          status: string;
          gmail_message_id: string | null;
          error_message: string | null;
          related_meeting: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['email_logs']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['email_logs']['Insert']>;
      };
    };
    Views: {
      vw_department_task_stats: {
        Row: {
          department_id: string;
          department_name: string;
          color: string;
          total_tasks: number;
          completed_tasks: number;
          pending_tasks: number;
          in_progress_tasks: number;
          completion_percentage: number;
        };
      };
      vw_employee_task_progress: {
        Row: {
          user_id: string;
          full_name: string | null;
          email: string;
          avatar_url: string | null;
          department_name: string | null;
          total_tasks: number;
          completed_tasks: number;
          pending_tasks: number;
          in_progress_tasks: number;
          completion_percentage: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      task_status: TaskStatus;
      task_priority: TaskPriority;
      email_type: EmailType;
    };
  };
}

// ─── Tipos de conveniencia ────────────────────────────────────────────────────

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type Meeting = Database['public']['Tables']['meetings']['Row'];
export type Department = Database['public']['Tables']['departments']['Row'];
export type OAuthToken = Database['public']['Tables']['oauth_tokens']['Row'];
export type EmailLog = Database['public']['Tables']['email_logs']['Row'];
export type TaskAttachment = Database['public']['Tables']['task_attachments']['Row'];

export type DepartmentStat = Database['public']['Views']['vw_department_task_stats']['Row'];
export type EmployeeStat = Database['public']['Views']['vw_employee_task_progress']['Row'];
