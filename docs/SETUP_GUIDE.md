# Intelligent Document Processing - Setup Guide

This guide will help you set up and configure the intelligent document processing feature.

## Prerequisites

- Node.js 18+ installed
- Supabase account and database
- Google Cloud Platform account
- Google Cloud Storage bucket

## Step 1: Install Dependencies

The required dependencies have already been installed:
- `@google-cloud/storage` - Google Cloud Storage client
- `uuid` - For generating unique request IDs

## Step 2: Database Setup

### Option A: Using Existing Schema (Recommended for MVP)

The system works with your existing database schema. You just need to ensure these tables exist:

**Required Tables:**
- `users` - User accounts
- `projects` - Customer projects with financial fields
- `documents` - Document metadata

**Optional Tables for Full Functionality:**
- `audit_logs` - Audit trail (create if you want audit logging)

### Option B: Full Schema with Migrations

If you want the complete schema with all new fields, run these migrations:

```sql
-- Add new columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS gcs_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extracted_data JSONB,
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS validation_confidence DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS extracted_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS validation_reason TEXT,
ADD COLUMN IF NOT EXISTS uploaded_by UUID;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_validation_status ON documents(validation_status);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  details JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  user_id UUID REFERENCES users(id),
  
  -- Indexes
  CONSTRAINT idx_audit_logs_request_id CREATE INDEX ON audit_logs(request_id),
  CONSTRAINT idx_audit_logs_document_id CREATE INDEX ON audit_logs(document_id),
  CONSTRAINT idx_audit_logs_project_id CREATE INDEX ON audit_logs(project_id),
  CONSTRAINT idx_audit_logs_timestamp CREATE INDEX ON audit_logs(timestamp)
);
```

## Step 3: Google Cloud Storage Setup

### 3.1 Create a GCS Bucket

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to Cloud Storage > Buckets
3. Click "Create Bucket"
4. Name: `financial-advisor-documents` (or your preferred name)
5. Location: Choose based on your region
6. Storage class: Standard
7. Access control: Uniform
8. Click "Create"

### 3.2 Create a Service Account

1. Navigate to IAM & Admin > Service Accounts
2. Click "Create Service Account"
3. Name: `document-storage-service`
4. Click "Create and Continue"
5. Grant role: "Storage Admin"
6. Click "Done"

### 3.3 Generate Service Account Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose JSON format
5. Download the JSON file

### 3.4 Configure Environment Variables

1. Open the downloaded JSON file
2. Copy the entire JSON content
3. Add to your `.env` file:

```env
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=financial-advisor-documents
GCS_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"..."}
```

**Important:** The `GCS_CREDENTIALS` should be the entire JSON content on a single line.

## Step 4: Update Environment Variables

Add these to your `.env` file (if not already present):

```env
# Existing variables
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
GOOGLE_AI_API_KEY=your_google_ai_key
PORT=3000

# New GCS variables
GCS_PROJECT_ID=your_gcs_project_id
GCS_BUCKET_NAME=financial-advisor-documents
GCS_CREDENTIALS={"type":"service_account",...}
```

## Step 5: Test the Setup

### 5.1 Start the Server

```bash
cd peter
npm run dev
```

### 5.2 Test Document Upload

```bash
# Create a test document (or use an existing one)
curl -X POST http://localhost:3000/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-document.pdf" \
  -F "projectId=YOUR_PROJECT_ID" \
  -F "documentType=payslip"
```

### 5.3 Verify the Response

You should receive a response like:

```json
{
  "document": {
    "id": "...",
    "project_id": "...",
    "title": "test-document.pdf",
    "document_type": "payslip",
    "gcs_path": "projects/.../payslip/...",
    "extraction_status": "success",
    "validation_status": "validated"
  },
  "extracted_data": {
    "fields": {...},
    "confidence": 85
  },
  "validation_result": {
    "status": "validated",
    "nameMatch": true,
    "confidence": 95
  }
}
```

## Step 6: Verify GCS Upload

1. Go to Google Cloud Console > Cloud Storage
2. Open your bucket
3. Navigate to `projects/YOUR_PROJECT_ID/`
4. You should see the uploaded document

## Troubleshooting

### GCS Authentication Errors

**Error:** "Could not load the default credentials"

**Solution:**
- Verify `GCS_CREDENTIALS` is set correctly in `.env`
- Ensure the JSON is valid (use a JSON validator)
- Check that the service account has Storage Admin role

### Document Upload Fails

**Error:** "File and projectId required"

**Solution:**
- Ensure you're sending multipart/form-data
- Include both `file` and `projectId` fields

### Name Validation Fails

**Error:** "Name mismatch: expected X, found Y"

**Solution:**
- Check the customer name in the project table
- Ensure the document contains the customer's name
- You can skip validation by setting `skipValidation: true` in options

### OCR Extraction Returns Empty

**Solution:**
- Ensure the document is a valid image or PDF
- Check that the document contains readable text
- Try with a higher quality document

## Configuration Options

### File Size Limit

Default: 10MB

To change, modify in `app.controller.ts`:

```typescript
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
```

### Allowed File Types

Default: JPEG, PNG, TIFF, PDF

To add more types, modify in `app.controller.ts`:

```typescript
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/pdf',
  'image/webp' // Add new type
]
```

### Validation Thresholds

To adjust name validation sensitivity, modify in `document-validation.service.ts`:

```typescript
const VALIDATION_THRESHOLD = 70  // Increase for stricter validation
const REJECTION_THRESHOLD = 30   // Decrease for stricter rejection
```

## Next Steps

1. Test with real financial documents (P60, payslips, etc.)
2. Monitor audit logs for processing issues
3. Adjust extraction patterns if needed
4. Set up monitoring and alerts for GCS usage
5. Configure backup and retention policies

## Support

For issues or questions:
1. Check the logs in the console
2. Review audit_logs table for detailed processing history
3. Refer to INTELLIGENT_DOCUMENT_PROCESSING.md for detailed documentation
