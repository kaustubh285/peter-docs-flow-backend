import { SupabaseService } from './supabase.service'

export interface UploadedFile {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

export type DocumentType = 
  | 'p60'
  | 'payslip'
  | 'tax_return'
  | 'bank_statement'
  | 'proof_of_earning'
  | 'unknown'

export class GCSStorageService {
  private supabase: SupabaseService
  private bucketName: string

  constructor() {
    this.supabase = new SupabaseService()
    this.bucketName = 'documents'
  }

  /**
   * Uploads a file to Supabase Storage
   * @param file - File buffer and metadata
   * @param projectId - Project UUID
   * @param documentType - Document type for path organization
   * @returns Storage file path
   */
  async uploadDocument(
    file: UploadedFile,
    projectId: string,
    documentType: DocumentType
  ): Promise<string> {
    try {
      const timestamp = Date.now()
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `projects/${projectId}/${documentType}/${timestamp}-${sanitizedFilename}`

      console.log(`Uploading to Supabase Storage: ${storagePath}`)

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (error) {
        console.error('Supabase storage upload error:', error)
        throw new Error(`Failed to upload to Supabase Storage: ${error.message}`)
      }

      console.log(`Upload successful: ${data.path}`)
      return data.path
    } catch (error) {
      console.error('Storage upload failed:', error)
      throw new Error(`Failed to upload document to storage: ${error}`)
    }
  }

  /**
   * Generates a public URL for file access
   * @param storagePath - Storage file path
   * @param expirationMinutes - Not used for Supabase public URLs
   * @returns Public URL
   */
  async generateSignedUrl(
    storagePath: string,
    expirationMinutes: number = 60
  ): Promise<string> {
    try {
      const { data } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath)

      return data.publicUrl
    } catch (error) {
      console.error('Failed to generate public URL:', error)
      throw new Error(`Failed to generate URL: ${error}`)
    }
  }

  /**
   * Deletes a file from Supabase Storage
   * @param storagePath - Storage file path
   */
  async deleteDocument(storagePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([storagePath])

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('Failed to delete document from storage:', error)
      throw new Error(`Failed to delete document: ${error}`)
    }
  }

  /**
   * Checks if a file exists in Supabase Storage
   * @param storagePath - Storage file path
   * @returns True if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(storagePath.substring(0, storagePath.lastIndexOf('/')))

      if (error) {
        return false
      }

      const filename = storagePath.substring(storagePath.lastIndexOf('/') + 1)
      return data?.some(file => file.name === filename) || false
    } catch (error) {
      console.error('Failed to check file existence:', error)
      return false
    }
  }
}


/*
import { Storage } from '@google-cloud/storage'

export interface UploadedFile {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

export type DocumentType = 
  | 'p60'
  | 'payslip'
  | 'tax_return'
  | 'bank_statement'
  | 'proof_of_earning'
  | 'unknown'

export class GCSStorageService {
  private storage: Storage
  private bucketName: string

  constructor() {
    // Initialize GCS client with credentials from environment
    const credentials = process.env.GCS_CREDENTIALS 
      ? JSON.parse(process.env.GCS_CREDENTIALS)
      : undefined

    this.storage = new Storage({
      credentials,
      projectId: process.env.GCS_PROJECT_ID
    })

    this.bucketName = process.env.GCS_BUCKET_NAME || 'financial-advisor-documents'
  }

  async uploadDocument(
    file: UploadedFile,
    projectId: string,
    documentType: DocumentType
  ): Promise<string> {
    try {
      const timestamp = Date.now()
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
      const gcsPath = `projects/${projectId}/${documentType}/${timestamp}-${sanitizedFilename}`

      const bucket = this.storage.bucket(this.bucketName)
      const fileHandle = bucket.file(gcsPath)

      await fileHandle.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadTimestamp: timestamp.toString(),
          projectId,
          documentType
        }
      })

      return gcsPath
    } catch (error) {
      console.error('GCS upload failed:', error)
      throw new Error(`Failed to upload document to GCS: ${error}`)
    }
  }


  async generateSignedUrl(
    gcsPath: string,
    expirationMinutes: number = 60
  ): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expirationMinutes * 60 * 1000
      })

      return url
    } catch (error) {
      console.error('Failed to generate signed URL:', error)
      throw new Error(`Failed to generate signed URL: ${error}`)
    }
  }


  async deleteDocument(gcsPath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)
      await file.delete()
    } catch (error) {
      console.error('Failed to delete document from GCS:', error)
      throw new Error(`Failed to delete document: ${error}`)
    }
  }


  async fileExists(gcsPath: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(gcsPath)
      const [exists] = await file.exists()
      return exists
    } catch (error) {
      console.error('Failed to check file existence:', error)
      return false
    }
  }
}
*/