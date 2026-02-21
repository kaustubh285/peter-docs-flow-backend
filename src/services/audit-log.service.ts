import { SupabaseService } from './supabase.service'
import { v4 as uuidv4 } from 'uuid'

export type AuditEventType =
  | 'upload_started'
  | 'ocr_completed'
  | 'type_identified'
  | 'data_extracted'
  | 'validation_completed'
  | 'gcs_upload_completed'
  | 'database_updated'
  | 'status_flags_updated'
  | 'processing_failed'

export interface AuditEvent {
  requestId: string
  documentId?: string
  projectId: string
  eventType: AuditEventType
  timestamp: Date
  details: Record<string, any>
  userId?: string
  success: boolean
  errorMessage?: string
}

export interface AuditEntry {
  id: string
  request_id: string
  document_id?: string
  project_id: string
  event_type: AuditEventType
  timestamp: string
  details: Record<string, any>
  success: boolean
  error_message?: string
  user_id?: string
}

export class AuditLogService {
  private supabase: SupabaseService

  constructor() {
    this.supabase = new SupabaseService()
  }

  /**
   * Generates a unique request ID for correlating audit events
   */
  generateRequestId(): string {
    return uuidv4()
  }

  /**
   * Logs a document processing event
   * @param event - Audit event details
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      const auditEntry = {
        request_id: event.requestId,
        document_id: event.documentId,
        project_id: event.projectId,
        event_type: event.eventType,
        timestamp: event.timestamp.toISOString(),
        details: event.details,
        success: event.success,
        error_message: event.errorMessage,
        user_id: event.userId
      }

      const { error } = await this.supabase
        .from('audit_logs')
        .insert(auditEntry)

      if (error) {
        console.error('Failed to log audit event:', error)
        // Don't throw - audit logging should not break the main flow
      }
    } catch (error) {
      console.error('Audit logging error:', error)
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Retrieves audit trail for a document
   * @param documentId - Document UUID
   * @returns Audit entries
   */
  async getAuditTrail(documentId: string): Promise<AuditEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('document_id', documentId)
        .order('timestamp', { ascending: true })

      if (error) {
        console.error('Failed to retrieve audit trail:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to retrieve audit trail:', error)
      return []
    }
  }

  /**
   * Retrieves audit trail for a request
   * @param requestId - Request UUID
   * @returns Audit entries
   */
  async getAuditTrailByRequest(requestId: string): Promise<AuditEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('timestamp', { ascending: true })

      if (error) {
        console.error('Failed to retrieve audit trail:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to retrieve audit trail:', error)
      return []
    }
  }
}
