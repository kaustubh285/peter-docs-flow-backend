import { z } from 'zod'

// Login DTO
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['advisor', 'customer'])
})

export type LoginDto = z.infer<typeof LoginSchema>

// Create Request DTO - now creating a project
export const CreateProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive', 'pending']).default('pending')
})

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>

// Upload DTO
export const UploadSchema = z.object({
  projectId: z.string(),
  title: z.string().optional()
})

export type UploadDto = z.infer<typeof UploadSchema>

// Update Project Financial Data
export const UpdateProjectFinancialsSchema = z.object({
  in_hand_salary: z.number().optional(),
  tax_paid: z.number().optional(),
  home_loan: z.number().optional(),
  education_loan: z.number().optional(),
  employed: z.boolean().optional(),
  employed_salary: z.number().optional(),
  self_employed_other_income: z.number().optional(),
  rental_income: z.number().optional(),
  total_mortgage_amount: z.number().optional(),
  total_mortgage_interest: z.number().optional()
})

export type UpdateProjectFinancialsDto = z.infer<typeof UpdateProjectFinancialsSchema>

// Update Document Collection Status
export const UpdateDocumentStatusSchema = z.object({
  payslips_collected: z.boolean().optional(),
  p60_collected: z.boolean().optional(),
  tax_returns_collected: z.boolean().optional(),
  other_hmrc_docs_collected: z.boolean().optional(),
  bank_statements_collected: z.boolean().optional(),
  proof_of_earning_collected: z.boolean().optional(),
  document_2_collected: z.boolean().optional(),
  document_3_collected: z.boolean().optional(),
  document_4_collected: z.boolean().optional()
})

export type UpdateDocumentStatusDto = z.infer<typeof UpdateDocumentStatusSchema>

// Database Types matching your schema
export interface User {
  id: string
  name: string
  email: string
  password_hash: string
  role: 'customer' | 'advisor'
  created_at: string
}

export interface Project {
  id: string
  customer_user_id: string
  advisor_user_id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  // Document collection flags
  payslips_collected: boolean
  p60_collected: boolean
  tax_returns_collected: boolean
  other_hmrc_docs_collected: boolean
  bank_statements_collected: boolean
  proof_of_earning_collected: boolean
  document_2_collected: boolean
  document_3_collected: boolean
  document_4_collected: boolean
  // Financial data
  in_hand_salary: number | null
  tax_paid: number | null
  home_loan: number | null
  education_loan: number | null
  employed: boolean | null
  employed_salary: number | null
  self_employed_other_income: number | null
  rental_income: number | null
  total_mortgage_amount: number | null
  total_mortgage_interest: number | null
}

export interface Document {
  id: string
  project_id: string
  title: string
  file_url: string
  content_text: string
  created_at: string
}
