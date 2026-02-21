import { Context } from 'hono'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { SupabaseService } from '../services/supabase.service'
import { DeepMindService } from '../services/deepmind.service'
import { OCRService } from '../services/ocr.service'
import { DocumentProcessingService } from '../services/document-processing.service'
import { authGuard, advisorOnly } from '../middleware/auth.middleware'
import { parseMultipartForm } from '../utils/upload.util'
import {
  LoginSchema,
  CreateProjectSchema,
  UpdateProjectFinancialsSchema,
  UpdateDocumentStatusSchema,
  type LoginDto,
  type CreateProjectDto
} from '../types'

export class AppController {
  private supabase: SupabaseService
  private deepmind: DeepMindService
  private ocrService: OCRService
  private documentProcessing: DocumentProcessingService

  constructor() {
    this.supabase = new SupabaseService()
    this.deepmind = new DeepMindService()
    this.ocrService = new OCRService()
    this.documentProcessing = new DocumentProcessingService()
  }

  async login(c: Context) {
    try {
      const body = await c.req.json()
      const { email, password, role } = LoginSchema.parse(body)

      // Get user from your users table
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, email, password_hash, role')
        .eq('email', email)
        .eq('role', role)
        .single()

      if (error || !user) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash)
      if (!isValidPassword) {
        return c.json({ error: 'Invalid credentials' }, 401)
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET!
      const access_token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '24h' }
      )

      return c.json({
        access_token,
        userId: user.id,
        role: user.role
      })
    } catch (error) {
      console.error('Login error:', error)
      return c.json({ error: 'Login failed' }, 500)
    }
  }

  // Get customer project view - renamed from viewCustomer
  async viewProject(c: Context) {
    try {
      await authGuard(c, async () => {})

      const projectId = c.req.param('projectId')
      const user = c.get('user')

      // Get project details with access control
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select(`
          *,
          customer:users!customer_user_id(id, name, email),
          advisor:users!advisor_user_id(id, name, email)
        `)
        .eq('id', projectId)
        .or(`customer_user_id.eq.${user.userId},advisor_user_id.eq.${user.userId}`)
        .single()

      if (projectError || !project) {
        return c.json({ error: 'Project not found or access denied' }, 404)
      }

      // Get documents for this project
      const { data: documents, error: docsError } = await this.supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)

      if (docsError) {
        return c.json({ error: 'Failed to fetch documents' }, 500)
      }

      return c.json({ project, documents })
    } catch (error) {
      console.error('View project error:', error)
      return c.json({ error: 'Failed to view project data' }, 500)
    }
  }

  // Create new project - renamed from createRequest
  async createProject(c: Context) {
    try {
      await authGuard(c, async () => {})
      await advisorOnly(c, async () => {})

      const customerId = c.req.param('customerId')
      const user = c.get('user')
      const body = await c.req.json()
      const projectData = CreateProjectSchema.parse(body)

      const { data, error } = await this.supabase
        .from('projects')
        .insert({
          ...projectData,
          customer_user_id: customerId,
          advisor_user_id: user.userId,
          // Initialize all document collection flags to false
          payslips_collected: false,
          p60_collected: false,
          tax_returns_collected: false,
          other_hmrc_docs_collected: false,
          bank_statements_collected: false,
          proof_of_earning_collected: false,
          document_2_collected: false,
          document_3_collected: false,
          document_4_collected: false
        })
        .select()

      if (error) {
        return c.json({ error: 'Failed to create project' }, 500)
      }

      return c.json(data)
    } catch (error) {
      console.error('Create project error:', error)
      return c.json({ error: 'Failed to create project' }, 500)
    }
  }

  // Upload document to project with intelligent processing
  // Upload document to project with intelligent processing
async upload(c: Context) {
  const startTime = Date.now()
  const requestId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  console.log('\n========================================')
  console.log(`[${requestId}] 📤 UPLOAD REQUEST STARTED`)
  console.log('========================================')
  
  try {
    // Parse multipart form
    console.log(`[${requestId}] 📋 Parsing multipart form data...`)
    const { file, fields } = await parseMultipartForm(c)
    
    // Log what we received
    console.log(`[${requestId}] 📥 RAW REQUEST DATA:`)
    console.log(`  - File received: ${file ? 'YES' : 'NO'}`)
    console.log(`  - Fields received:`, JSON.stringify(fields, null, 2))
    
    if (file) {
      console.log(`[${requestId}] 📄 FILE DETAILS:`)
      console.log(`  - Name: ${file.originalname}`)
      console.log(`  - Size: ${(file.size / 1024).toFixed(2)} KB`)
      console.log(`  - MIME: ${file.mimetype}`)
    }
    
    const { title, documentType, projectId: requestedProjectId } = fields
    // const projectId = "803158dc-df2a-4409-a3c5-883e4cd3dbc0"
    // Get user from context
    const user = c.get('user')
    const userId = user?.userId
    console.log(`[${requestId}] 👤 USER INFO:`)
    console.log(`  - User ID: ${userId || 'NOT AUTHENTICATED'}`)
    console.log(`  - User Role: ${user?.role || 'N/A'}`)

    // Validation - File
    if (!file) {
      console.log(`[${requestId}] ❌ VALIDATION FAILED: No file provided`)
      const errorResponse = { error: 'File is required' }
      console.log(`[${requestId}] 📤 RESPONSE (400):`, JSON.stringify(errorResponse, null, 2))
      console.log('========================================\n')
      return c.json(errorResponse, 400)
    }

    // Validation - Project ID
    // Auto-create project if not provided or doesn't exist
let projectId = requestedProjectId

if (!projectId) {
  console.log(`[${requestId}] 📝 No project ID provided, creating new project...`)
  
  // Create new project with default values
  const { data: newProject, error: createError } = await this.supabase
    .from('projects')
    .insert({
      name: `Project ${new Date().toISOString().split('T')[0]}`,
      status: 'active',
      customer_user_id: user?.role === 'customer' ? userId : null,
      advisor_user_id: user?.role === 'advisor' ? userId : null
    })
    .select()
    .single()

  if (createError || !newProject) {
    console.log(`[${requestId}] ❌ Failed to create project:`, createError)
    return c.json({ error: 'Failed to create project' }, 500)
  }

  projectId = newProject.id
  console.log(`[${requestId}] ✅ Created new project: ${projectId}`)
} else {
  // Check if project exists, create if it doesn't
  console.log(`[${requestId}] 🔍 Checking if project exists: ${projectId}`)
  
  const { data: existingProject, error: checkError } = await this.supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (checkError || !existingProject) {
    console.log(`[${requestId}] 📝 Project doesn't exist, creating with provided ID...`)
    
    const { data: newProject, error: createError } = await this.supabase
      .from('projects')
      .insert({
        id: projectId,
        name: `Project ${new Date().toISOString().split('T')[0]}`,
        status: 'active',
        customer_user_id: user?.role === 'customer' ? userId : null,
        advisor_user_id: user?.role === 'advisor' ? userId : null
      })
      .select()
      .single()

    if (createError || !newProject) {
      console.log(`[${requestId}] ❌ Failed to create project with ID:`, createError)
      return c.json({ error: 'Failed to create project' }, 500)
    }

    console.log(`[${requestId}] ✅ Created new project with provided ID: ${projectId}`)
  } else {
    console.log(`[${requestId}] ✅ Project exists: ${projectId}`)
  }
}


    console.log(`[${requestId}] ✅ Basic validation passed`)
    console.log(`[${requestId}] 📋 Processing with:`)
    console.log(`  - Project ID: ${projectId}`)
    console.log(`  - Document Type: ${documentType || 'auto-detect'}`)
    console.log(`  - Title: ${title || 'N/A'}`)

    // Validate file format
    console.log(`[${requestId}] 🔍 Validating file format...`)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/pdf'
    ]

    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.log(`[${requestId}] ❌ Invalid file format: ${file.mimetype}`)
      const errorResponse = {
        error: 'Invalid file format',
        details: 'Only JPEG, PNG, TIFF, and PDF files are allowed'
      }
      console.log(`[${requestId}] 📤 RESPONSE (400):`, JSON.stringify(errorResponse, null, 2))
      console.log('========================================\n')
      return c.json(errorResponse, 400)
    }
    console.log(`[${requestId}] ✅ File format valid`)

    // Validate file size
    console.log(`[${requestId}] 🔍 Validating file size...`)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      console.log(`[${requestId}] ❌ File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
      const errorResponse = {
        error: 'File size exceeds limit',
        details: 'Maximum file size is 10MB'
      }
      console.log(`[${requestId}] 📤 RESPONSE (400):`, JSON.stringify(errorResponse, null, 2))
      console.log('========================================\n')
      return c.json(errorResponse, 400)
    }
    console.log(`[${requestId}] ✅ File size valid`)

    // Process document
    console.log(`[${requestId}] 🚀 Starting document processing...`)
    const result = await this.documentProcessing.processDocument(
      file,
      projectId,
      {
        documentTypeHint: documentType,
        skipValidation: false,
        userId
      }
    )

    console.log(`[${requestId}] ✅ Processing completed successfully`)
    console.log(`[${requestId}] 📊 RESULTS:`)
    console.log(`  - Document ID: ${result.document?.id}`)
    console.log(`  - Type: ${result.document?.document_type}`)
    console.log(`  - Extraction: ${result.document?.extraction_status}`)
    console.log(`  - Validation: ${result.validationResult?.status}`)

    const responseData = {
      project_id: projectId,
      document: result.document,
      extracted_data: result.extractedData,
      validation_result: result.validationResult
    }

    const duration = Date.now() - startTime
    console.log(`[${requestId}] ⏱️  Duration: ${duration}ms`)
    console.log(`[${requestId}] ✅ SUCCESS (200)`)
    console.log(`[${requestId}] 📤 RESPONSE:`, JSON.stringify(responseData, null, 2))
    console.log('========================================\n')

    return c.json(responseData)

  } catch (error) {
    const duration = Date.now() - startTime
    console.log(`[${requestId}] ❌ ERROR after ${duration}ms`)
    console.log(`[${requestId}] 🔥 ERROR DETAILS:`)
    console.error(error)
    
    const errorMessage = String(error)
    let statusCode = 500
    let errorResponse: any = { error: 'Upload failed', details: errorMessage }

    if (errorMessage.includes('validation failed') || errorMessage.includes('Name mismatch')) {
      statusCode = 422
      errorResponse = {
        error: 'Document validation failed',
        reason: 'validation_failed',
        details: errorMessage
      }
    } else if (errorMessage.includes('extraction failed')) {
      statusCode = 422
      errorResponse = {
        error: 'Data extraction failed',
        reason: 'extraction_failed',
        details: errorMessage
      }
    } else if (errorMessage.includes('GCS') || errorMessage.includes('storage')) {
      statusCode = 422
      errorResponse = {
        error: 'Storage operation failed',
        reason: 'storage_failed',
        details: errorMessage
      }
    }

    console.log(`[${requestId}] 📤 ERROR RESPONSE (${statusCode}):`, JSON.stringify(errorResponse, null, 2))
    console.log('========================================\n')

    return c.json(errorResponse, statusCode)
  }
}


  // Generate AI insights for a project
  async generateInsights(c: Context) {
    try {
      await authGuard(c, async () => {})
      await advisorOnly(c, async () => {})

      const projectId = c.req.param('projectId')
      const user = c.get('user')

      // Fetch project with all financial data and documents
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select(`
          *,
          documents(*)
        `)
        .eq('id', projectId)
        .eq('advisor_user_id', user.userId)
        .single()

      if (projectError || !project) {
        return c.json({ error: 'Project not found or access denied' }, 404)
      }

      // Prepare data for AI analysis
      const analysisData = {
        project_info: {
          name: project.name,
          description: project.description,
          status: project.status
        },
        financial_data: {
          in_hand_salary: project.in_hand_salary,
          tax_paid: project.tax_paid,
          home_loan: project.home_loan,
          education_loan: project.education_loan,
          employed: project.employed,
          employed_salary: project.employed_salary,
          self_employed_other_income: project.self_employed_other_income,
          rental_income: project.rental_income,
          total_mortgage_amount: project.total_mortgage_amount,
          total_mortgage_interest: project.total_mortgage_interest
        },
        documents_collected: {
          payslips: project.payslips_collected,
          p60: project.p60_collected,
          tax_returns: project.tax_returns_collected,
          hmrc_docs: project.other_hmrc_docs_collected,
          bank_statements: project.bank_statements_collected,
          proof_of_earning: project.proof_of_earning_collected
        },
        uploaded_documents: project.documents || []
      }

      // Generate insights using AI
      const prompt = `Analyze this UK financial advisory case: ${JSON.stringify(analysisData)}`
      const insights = await this.deepmind.chat(prompt)

      return c.json(insights)
    } catch (error) {
      console.error('Generate insights error:', error)
      return c.json({ error: 'Failed to generate insights' }, 500)
    }
  }

  // Update project financial data
  async updateProjectFinancials(c: Context) {
    try {
      await authGuard(c, async () => {})

      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const body = await c.req.json()
      const updates = UpdateProjectFinancialsSchema.parse(body)

      // Update project (customer can update their own, advisor can update assigned)
      const { data, error } = await this.supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .or(`customer_user_id.eq.${user.userId},advisor_user_id.eq.${user.userId}`)
        .select()

      if (error) {
        return c.json({ error: 'Failed to update project' }, 500)
      }

      return c.json(data)
    } catch (error) {
      console.error('Update financials error:', error)
      return c.json({ error: 'Failed to update financial data' }, 500)
    }
  }

  // Update document collection status
  async updateDocumentStatus(c: Context) {
    try {
      await authGuard(c, async () => {})
      await advisorOnly(c, async () => {})

      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const body = await c.req.json()
      const updates = UpdateDocumentStatusSchema.parse(body)

      const { data, error } = await this.supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .eq('advisor_user_id', user.userId)
        .select()

      if (error) {
        return c.json({ error: 'Failed to update document status' }, 500)
      }

      return c.json(data)
    } catch (error) {
      console.error('Update document status error:', error)
      return c.json({ error: 'Failed to update document status' }, 500)
    }
  }

  // Get all projects for a user
  async getProjects(c: Context) {
    try {
      await authGuard(c, async () => {})

      const user = c.get('user')
      const role = user.role

      let query = this.supabase.from('projects').select(`
        *,
        customer:users!customer_user_id(id, name, email),
        advisor:users!advisor_user_id(id, name, email)
      `)

      // Filter based on role
      if (role === 'customer') {
        query = query.eq('customer_user_id', user.userId)
      } else {
        query = query.eq('advisor_user_id', user.userId)
      }

      const { data: projects, error } = await query

      if (error) {
        return c.json({ error: 'Failed to fetch projects' }, 500)
      }

      return c.json(projects)
    } catch (error) {
      console.error('Get projects error:', error)
      return c.json({ error: 'Failed to fetch projects' }, 500)
    }
  }
  // Get document with signed URL
  async getDocument(c: Context) {
    try {
      await authGuard(c, async () => {})

      const projectId = c.req.param('projectId')
      const documentId = c.req.param('documentId')
      const user = c.get('user')

      // Verify user has access to this project
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .or(`customer_user_id.eq.${user.userId},advisor_user_id.eq.${user.userId}`)
        .single()

      if (projectError || !project) {
        return c.json({ error: 'Project not found or access denied' }, 403)
      }

      // Get document with signed URL
      const result = await this.documentProcessing.getDocument(projectId, documentId)

      return c.json({
        document: {
          ...result.document,
          signed_url: result.signedUrl
        }
      })
    } catch (error) {
      console.error('Get document error:', error)

      if (String(error).includes('not found')) {
        return c.json({ error: 'Document not found' }, 404)
      }

      return c.json({ error: 'Failed to retrieve document' }, 500)
    }
  }

}
