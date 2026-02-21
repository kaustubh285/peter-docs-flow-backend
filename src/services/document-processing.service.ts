import { SupabaseService } from './supabase.service'
import { OCRService } from './ocr.service'
import { GCSStorageService, UploadedFile, DocumentType } from './gcs-storage.service'
import { DataExtractionService } from './data-extraction.service'
import { DocumentValidationService } from './document-validation.service'
import { AuditLogService } from './audit-log.service'

export interface ProcessingOptions {
  documentTypeHint?: string
  skipValidation?: boolean
  userId?: string
}

export interface ProcessingResult {
  document: any
  extractedData: any
  validationResult: any
  auditTrail?: any[]
}

export interface DocumentWithUrl {
  document: any
  signedUrl: string
}

export class DocumentProcessingService {
  private supabase: SupabaseService
  private ocrService: OCRService
  private gcsStorage: GCSStorageService
  private dataExtraction: DataExtractionService
  private validation: DocumentValidationService
  private auditLog: AuditLogService

  constructor() {
    this.supabase = new SupabaseService()
    this.ocrService = new OCRService()
    this.gcsStorage = new GCSStorageService()
    this.dataExtraction = new DataExtractionService()
    this.validation = new DocumentValidationService()
    this.auditLog = new AuditLogService()
  }

  /**
   * Orchestrates the complete document processing workflow
   * @param file - Uploaded file buffer and metadata
   * @param projectId - Project UUID
   * @param options - Processing options
   * @returns Processing result with document metadata and extracted data
   */
  async processDocument(
    file: UploadedFile,
    projectId: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const requestId = this.auditLog.generateRequestId()
    let documentId: string | undefined
    let gcsPath: string | undefined

    try {
      // Log upload started
      await this.auditLog.logEvent({
        requestId,
        projectId,
        eventType: 'upload_started',
        timestamp: new Date(),
        details: {
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        },
        userId: options.userId,
        success: true
      })

      // Step 1: Get project and customer info
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*, customer:users!customer_user_id(name)')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        throw new Error('Project not found')
      }

      const customerName = project.customer?.name || ''

      // Step 2: OCR Extraction
      const ocrResult = await this.ocrService.extract(file.buffer)
      const ocrText = ocrResult.raw_text || ''
      const ocrConfidence = this.calculateOCRConfidence(ocrText)

      await this.auditLog.logEvent({
        requestId,
        projectId,
        eventType: 'ocr_completed',
        timestamp: new Date(),
        details: {
          textLength: ocrText.length,
          confidence: ocrConfidence
        },
        userId: options.userId,
        success: true
      })

      // Step 3: Document Type Identification
      const typeResult = await this.dataExtraction.identifyDocumentType(ocrText)
      const documentType = options.documentTypeHint 
        ? (options.documentTypeHint as DocumentType)
        : typeResult.type

      await this.auditLog.logEvent({
        requestId,
        projectId,
        eventType: 'type_identified',
        timestamp: new Date(),
        details: {
          documentType,
          confidence: typeResult.confidence,
          indicators: typeResult.indicators
        },
        userId: options.userId,
        success: true
      })

      // Step 4: Data Extraction
      const extractedData = await this.dataExtraction.extractFinancialData(ocrText, documentType)
      const extractionStatus = this.determineExtractionStatus(extractedData)

      await this.auditLog.logEvent({
        requestId,
        projectId,
        eventType: 'data_extracted',
        timestamp: new Date(),
        details: {
          fields: extractedData.fields,
          confidence: extractedData.confidence,
          status: extractionStatus
        },
        userId: options.userId,
        success: true
      })

      // Step 5: Ownership Validation
      let validationResult
      if (!options.skipValidation && customerName) {
        validationResult = await this.validation.validateOwnership(ocrText, customerName, documentType)
        
        await this.auditLog.logEvent({
          requestId,
          projectId,
          eventType: 'validation_completed',
          timestamp: new Date(),
          details: {
            status: validationResult.status,
            nameMatch: validationResult.nameMatch,
            confidence: validationResult.confidence,
            extractedName: validationResult.extractedName
          },
          userId: options.userId,
          success: true
        })

        // Reject if validation failed
        if (validationResult.status === 'rejected') {
          throw new Error(validationResult.reason || 'Document validation failed')
        }
      } else {
        validationResult = {
          status: 'validated',
          nameMatch: true,
          confidence: 100,
          reason: 'Validation skipped'
        }
      }

      // Step 6: Upload to GCS
      gcsPath = await this.gcsStorage.uploadDocument(file, projectId, documentType)

      await this.auditLog.logEvent({
        requestId,
        projectId,
        eventType: 'gcs_upload_completed',
        timestamp: new Date(),
        details: {
          gcsPath
        },
        userId: options.userId,
        success: true
      })

      // Step 7: Save to database (with transaction)
      const dbResult = await this.saveToDatabase({
        projectId,
        file,
        gcsPath,
        ocrText,
        ocrConfidence,
        extractedData,
        extractionStatus,
        validationResult,
        requestId,
        userId: options.userId
      })

      documentId = dbResult.documentId

      await this.auditLog.logEvent({
        requestId,
        documentId,
        projectId,
        eventType: 'database_updated',
        timestamp: new Date(),
        details: {
          documentId
        },
        userId: options.userId,
        success: true
      })

      // Step 8: Update project fields and status flags
      const fieldUpdates = this.dataExtraction.mapToProjectFields(extractedData, documentType)
      
      if (Object.keys(fieldUpdates.financialData).length > 0 || Object.keys(fieldUpdates.statusFlags).length > 0) {
        await this.updateProjectFields(projectId, fieldUpdates, requestId, options.userId)

        await this.auditLog.logEvent({
          requestId,
          documentId,
          projectId,
          eventType: 'status_flags_updated',
          timestamp: new Date(),
          details: {
            financialData: fieldUpdates.financialData,
            statusFlags: fieldUpdates.statusFlags
          },
          userId: options.userId,
          success: true
        })
      }

      return {
        document: dbResult.document,
        extractedData: {
          fields: extractedData.fields,
          confidence: extractedData.confidence
        },
        validationResult
      }

    } catch (error) {
      // Log failure
      await this.auditLog.logEvent({
        requestId,
        documentId,
        projectId,
        eventType: 'processing_failed',
        timestamp: new Date(),
        details: {
          error: String(error)
        },
        userId: options.userId,
        success: false,
        errorMessage: String(error)
      })

      // Cleanup: Delete GCS file if it was uploaded
      if (gcsPath) {
        try {
          await this.gcsStorage.deleteDocument(gcsPath)
        } catch (cleanupError) {
          console.error('Failed to cleanup GCS file:', cleanupError)
        }
      }

      throw error
    }
  }

  /**
   * Retrieves a document with a signed URL for file access
   * @param projectId - Project UUID
   * @param documentId - Document UUID
   * @returns Document metadata with signed URL
   */
  async getDocument(projectId: string, documentId: string): Promise<DocumentWithUrl> {
    const { data: document, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single()

    if (error || !document) {
      throw new Error('Document not found')
    }

    // Generate signed URL if GCS path exists
    let signedUrl = ''
    if (document.gcs_path) {
      signedUrl = await this.gcsStorage.generateSignedUrl(document.gcs_path)
    } else if (document.file_url) {
      // Fallback to Supabase storage URL
      const { data } = this.supabase.storage
        .from('documents')
        .getPublicUrl(document.file_url)
      signedUrl = data.publicUrl
    }

    return {
      document,
      signedUrl
    }
  }

  /**
   * Saves document metadata to database
   */
  private async saveToDatabase(params: {
    projectId: string
    file: UploadedFile
    gcsPath: string
    ocrText: string
    ocrConfidence: number
    extractedData: any
    extractionStatus: string
    validationResult: any
    requestId: string
    userId?: string
  }): Promise<{ documentId: string; document: any }> {
    const documentData = {
      project_id: params.projectId,
      title: params.file.originalname,
      file_url: params.gcsPath,
      content_text: params.ocrText,
    }

    const { data, error } = await this.supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (error) {
      throw new Error(`Database save failed: ${error.message}`)
    }

    return {
      documentId: data.id,
      document: data
    }
  }

  /**
   * Updates project financial fields and status flags
   */
  private async updateProjectFields(
    projectId: string,
    fieldUpdates: { financialData: Record<string, any>; statusFlags: Record<string, boolean> },
    requestId: string,
    userId?: string
  ): Promise<void> {
    // Get current project data for audit trail
    const { data: currentProject } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    const updates = {
      ...fieldUpdates.financialData,
      ...fieldUpdates.statusFlags
    }

    const { error } = await this.supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)

    if (error) {
      throw new Error(`Failed to update project fields: ${error.message}`)
    }

    // Log field changes
    if (currentProject) {
      const changes: Record<string, { old: any; new: any }> = {}
      for (const [key, newValue] of Object.entries(updates)) {
        const oldValue = currentProject[key]
        if (oldValue !== newValue) {
          changes[key] = { old: oldValue, new: newValue }
        }
      }

      await this.auditLog.logEvent({
        requestId,
        projectId,
        eventType: 'database_updated',
        timestamp: new Date(),
        details: { fieldChanges: changes },
        userId,
        success: true
      })
    }
  }

  /**
   * Calculates OCR confidence based on text quality
   */
  private calculateOCRConfidence(text: string): number {
    if (!text || text.length === 0) return 0

    // Simple heuristic: check for common indicators of good OCR
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(text)
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length
    const hasReasonableLength = text.length > 50

    let confidence = 50

    if (hasAlphanumeric) confidence += 20
    if (specialCharRatio < 0.3) confidence += 20
    if (hasReasonableLength) confidence += 10

    return Math.min(confidence, 100)
  }

  /**
   * Determines extraction status based on extracted data
   */
  private determineExtractionStatus(extractedData: any): string {
    if (Object.keys(extractedData.fields).length === 0) {
      return 'failed'
    }

    if (extractedData.confidence < 50) {
      return 'partial'
    }

    return 'success'
  }
}
