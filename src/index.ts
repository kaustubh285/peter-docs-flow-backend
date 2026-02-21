import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { AppController } from './controllers/app.controller'
import dotenv from 'dotenv'

dotenv.config()

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', logger())

// Routes
const appController = new AppController()

// Authentication
app.post('/login', (c) => appController.login(c))

// Project Management
app.get('/projects', (c) => appController.getProjects(c))
app.post('/customers/:customerId/projects', (c) => appController.createProject(c))
app.get('/projects/:projectId/view', (c) => appController.viewProject(c))

// Financial Data Updates
app.patch('/projects/:projectId/financials', (c) => appController.updateProjectFinancials(c))
app.patch('/projects/:projectId/documents/status', (c) => appController.updateDocumentStatus(c))

// Document Upload
app.post('/upload', (c) => appController.upload(c))

// Document Retrieval
app.get('/projects/:projectId/documents/:documentId', (c) => appController.getDocument(c))

// AI Insights
app.get('/projects/:projectId/insights', (c) => appController.generateInsights(c))

// Health check
app.get('/health', (c) => c.json({ 
  status: 'ok', 
  timestamp: new Date().toISOString(), 
  version: '1.0.0'
}))

const port = parseInt(process.env.PORT || '3000')

console.log(`🚀 Financial Advisor Helper API running on port ${port}`)
console.log(`📋 Available endpoints:`)
console.log(`   POST /login                                    - Authentication`)
console.log(`   GET  /projects                                 - Get user projects`)
console.log(`   POST /customers/:customerId/projects           - Create new project`)
console.log(`   GET  /projects/:projectId/view                 - View project details`)
console.log(`   PATCH /projects/:projectId/financials          - Update financial data`)
console.log(`   PATCH /projects/:projectId/documents/status    - Update document status`)
console.log(`   POST /upload                                   - Upload documents`)
console.log(`   GET  /projects/:projectId/documents/:documentId - Get document with signed URL`)
console.log(`   GET  /projects/:projectId/insights             - Generate AI insights`)
console.log(`   GET  /health                                   - Health check`)

serve({
  fetch: app.fetch,
  port
})
