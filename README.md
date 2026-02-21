# Financial Advisor Helper API

A Hono-based API for a UK financial advisor helper tool built for hackathon. Manages projects between financial advisors and their customers, with document collection tracking and AI-powered insights.

## Features

- **Authentication**: JWT-based auth with role-based access (advisor/customer)
- **Project Management**: Create and manage advisor-customer projects
- **Document Tracking**: Track collection of UK financial documents (P60, payslips, tax returns, etc.)
- **Financial Data**: Store and update customer financial information
- **Document Upload**: File upload with OCR text extraction
- **AI Insights**: Financial analysis using Google's Generative AI
- **Database**: Direct Supabase integration matching your existing schema

## Database Schema

The API works with your existing Supabase tables:
- **users**: User accounts (customers and advisors)
- **projects**: Advisor-customer projects with financial data and document tracking
- **documents**: Uploaded files with OCR-extracted text content

## API Endpoints

### Authentication
- `POST /login` - Login with email, password, and role

### Project Management
- `GET /projects` - Get all projects for logged-in user
- `POST /customers/:customerId/projects` - Create new project (advisor only)
- `GET /projects/:projectId/view` - View project details with documents

### Data Updates
- `PATCH /projects/:projectId/financials` - Update financial data
- `PATCH /projects/:projectId/documents/status` - Update document collection status (advisor only)

### Documents
- `POST /upload` - Upload documents with OCR extraction

### AI Insights
- `GET /projects/:projectId/insights` - Generate AI-powered financial insights (advisor only)

### Utility
- `GET /health` - API health status

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

3. **Database**: Your Supabase database is already set up!

4. **Google AI Setup**:
   - Get a Google AI API key from Google AI Studio
   - Add it to your `.env` file

5. **Run the Server**:
   ```bash
   npm run dev
   ```

## Usage Examples

### Login
```bash
curl -X POST http://localhost:3000/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"advisor@example.com","password":"password","role":"advisor"}'
```

### Create Project
```bash
curl -X POST http://localhost:3000/customers/customer-uuid/projects \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-jwt-token" \\
  -d '{"name":"Tax Planning 2024","description":"Annual tax planning project","status":"active"}'
```

### Upload Document
```bash
curl -X POST http://localhost:3000/upload \\
  -F "file=@payslip.pdf" \\
  -F "projectId=project-uuid" \\
  -F "title=Monthly Payslip"
```

### Update Financial Data
```bash
curl -X PATCH http://localhost:3000/projects/project-uuid/financials \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-jwt-token" \\
  -d '{"in_hand_salary":45000,"tax_paid":9000,"employed":true}'
```

### Update Document Collection Status
```bash
curl -X PATCH http://localhost:3000/projects/project-uuid/documents/status \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-jwt-token" \\
  -d '{"payslips_collected":true,"p60_collected":false}'
```

### Get AI Insights
```bash
curl -X GET http://localhost:3000/projects/project-uuid/insights \\
  -H "Authorization: Bearer your-jwt-token"
```

## Document Collection Tracking

The system tracks collection of common UK financial documents:
- **payslips_collected**: Monthly payslips
- **p60_collected**: P60 annual summary
- **tax_returns_collected**: Self-assessment tax returns
- **other_hmrc_docs_collected**: Other HMRC documents
- **bank_statements_collected**: Bank statements
- **proof_of_earning_collected**: Proof of earnings
- **document_2_collected**: Additional document type 2
- **document_3_collected**: Additional document type 3
- **document_4_collected**: Additional document type 4

## Financial Data Fields

The system stores comprehensive UK financial information:
- **in_hand_salary**: Take-home salary (£)
- **tax_paid**: Total tax paid (£)
- **home_loan**: Home loan amount (£)
- **education_loan**: Education loan amount (£)
- **employed**: Employment status (boolean)
- **employed_salary**: Gross employed salary (£)
- **self_employed_other_income**: Self-employment income (£)
- **rental_income**: Property rental income (£)
- **total_mortgage_amount**: Total mortgage amount (£)
- **total_mortgage_interest**: Mortgage interest payments (£)

## Project Structure

```
src/
├── controllers/        # API route handlers
├── services/          # Business logic (Supabase, AI, OCR)
├── middleware/        # Authentication middleware
├── types/            # TypeScript definitions matching your schema
└── utils/            # Utility functions
```

## Tech Stack

- **Framework**: Hono.js (fast, lightweight)
- **Database**: Supabase (your existing setup)
- **OCR**: Tesseract.js for document text extraction
- **AI**: Google Generative AI (Gemini Pro)
- **Authentication**: JWT + bcrypt
- **TypeScript**: Full type safety

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server

## Workflow Example

1. **Advisor** logs in and creates a project for a customer
2. **Customer** can upload documents (payslips, P60, etc.)
3. **System** extracts text from documents using OCR
4. **Customer/Advisor** updates financial data in the project
5. **Advisor** marks document collection status
6. **Advisor** generates AI insights based on all project data
7. **AI** provides risk assessment, recommendations, and next steps

Perfect for hackathon demos! 🚀🇬🇧
