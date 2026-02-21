# Intelligent Document Processing

This document describes the intelligent document processing feature that enhances the document upload workflow with automatic data extraction, validation, and cloud storage.

## Overview

The intelligent document processing system automatically:
- Extracts structured financial data from UK financial documents (P60, payslips, tax returns, bank statements)
- Validates document ownership by comparing names
- Stores documents in Google Cloud Storage for scalability
- Updates project financial fields and status flags automatically
- Maintains comprehensive audit logs for compliance

## Architecture

### Services

#### GCSStorageService
Manages Google Cloud Storage operations for document files.

**Methods:**
- `uploadDocument(file, projectId, documentType)` - Uploads file to GCS with organized path structure
- `generateSignedUrl(gcsPath, expirationMinutes)` - Creates temporary signed URLs for file access
- `deleteDocument(gcsPath)` - Removes files from GCS
- `fileExists(gcsPath)` - Checks if a file exists

#### DataExtractionService
Extracts structured financial data from OCR text.

**Methods:**
- `identifyDocumentType(ocrText)` - Identifies document type using keyword matching
- `extractFinancialData(ocrText, documentType)` - Extracts financial fields using regex patterns
- `mapToProjectFields(extractedData, documentType)` - Maps extracted data to project table fields

**Supported Document Types:**
- P60 (End of Year Certificate)
- Payslip
- Tax Return (Self Assessment)
- Bank Statement
- Proof of Earning

#### DocumentValidationService
Validates document ownership through name matching.

**Methods:**
- `validateOwnership(ocrText, customerName, documentType)` - Validates document belongs to customer
- `extractName(ocrText, documentType)` - Extracts person names from document
- `compareNames(extractedName, expectedName)` - Fuzzy name matching with variations

**Features:**
- Handles name variations (middle names, initials, titles)
- Levenshtein distance for similarity scoring
- Confidence-based validation status (validated/flagged/rejected)

#### AuditLogService
Maintains comprehensive audit trail for compliance.

**Methods:**
- `logEvent(event)` - Logs processing events
- `getAuditTrail(documentId)` - Retrieves audit history for a document
- `generateRequestId()` - Creates unique request IDs for correlation

**Event Types:**
- upload_started
- ocr_completed
- type_identified
- data_extracted
- validation_completed
- gcs_upload_completed
- database_updated
- status_flags_updated
- processing_failed

#### DocumentProcessingService
Orchestrates the complete document processing workflow.

**Methods:**
- `processDocument(file, projectId, options)` - Main processing pipeline
- `getDocument(projectId, documentId)` - Retrieves document with signed URL

**Processing Pipeline:**
1. OCR text extraction
2. Document type identification
3. Financial data extraction
4. Ownership validation
5. GCS upload
6. Database save
7. Project field updates
8. Audit logging

## API Endpoints

### POST /upload

Enhanced document upload with intelligent processing.

**Request:**
```
Content-Type: multipart/form-data

Fields:
- file: File (required) - Document image or PDF
- projectId: string (required) - Project UUID
- documentType: string (optional) - Document type hint
- title: string (optional) - Custom document title
```

**Response (200 OK):**
```json
{
  "document": {
    "id": "uuid",
    "project_id": "uuid",
    "title": "document.pdf",
    "document_type": "payslip",
    "gcs_path": "projects/{projectId}/payslip/{timestamp}-document.pdf",
    "extraction_status": "success",
    "validation_status": "validated",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "extracted_data": {
    "fields": {
      "in_hand_salary": 2500.00,
      "employed_salary": 3000.00,
      "tax_paid": 500.00
    },
    "confidence": 85
  },
  "validation_result": {
    "status": "validated",
    "nameMatch": true,
    "confidence": 95,
    "extractedName": "John Smith"
  }
}
```

**Error Responses:**
- 400 Bad Request - Missing required fields or invalid file format
- 422 Unprocessable Entity - Validation failed, extraction failed, or storage failed
- 500 Internal Server Error - Server error

### GET /projects/:projectId/documents/:documentId

Retrieves document metadata with signed URL for file access.

**Response (200 OK):**
```json
{
  "document": {
    "id": "uuid",
    "project_id": "uuid",
    "title": "document.pdf",
    "document_type": "payslip",
    "signed_url": "https://storage.googleapis.com/...",
    "extraction_status": "success",
    "validation_status": "validated",
    "extracted_data": {
      "in_hand_salary": 2500.00
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- 403 Forbidden - Access denied
- 404 Not Found - Document not found
- 500 Internal Server Error - Server error

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Google Cloud Storage Configuration
GCS_PROJECT_ID=your_gcs_project_id
GCS_BUCKET_NAME=financial-advisor-documents
GCS_CREDENTIALS={"type":"service_account",...}
```

### GCS Setup

1. Create a Google Cloud Storage bucket
2. Create a service account with Storage Admin role
3. Download service account credentials JSON
4. Set `GCS_CREDENTIALS` environment variable with the JSON content

## Database Schema

### Enhanced Documents Table

The documents table includes these new fields:

```sql
- gcs_path VARCHAR(500) - GCS file path
- file_size_bytes INTEGER - File size
- mime_type VARCHAR(100) - MIME type
- ocr_text TEXT - Raw OCR text
- ocr_confidence DECIMAL(5,2) - OCR quality score
- extraction_status VARCHAR(20) - 'success', 'partial', 'failed'
- extracted_data JSONB - Structured extracted data
- validation_status VARCHAR(20) - 'validated', 'flagged', 'rejected'
- validation_confidence DECIMAL(5,2) - Validation confidence
- extracted_name VARCHAR(255) - Name found in document
- validation_reason TEXT - Validation result details
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  document_id UUID,
  project_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  details JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  user_id UUID
);
```

## Document Type Mappings

### P60
- **Status Flag:** p60_collected
- **Extracted Fields:** in_hand_salary, tax_paid, employed_salary
- **Keywords:** p60, end of year certificate, hmrc, tax year

### Payslip
- **Status Flag:** payslips_collected
- **Extracted Fields:** in_hand_salary, employed_salary, tax_paid
- **Keywords:** payslip, pay slip, salary advice, payment summary

### Tax Return
- **Status Flag:** tax_returns_collected
- **Extracted Fields:** self_employed_other_income, rental_income, tax_paid
- **Keywords:** self assessment, tax return, sa100, hmrc

### Bank Statement
- **Status Flag:** bank_statements_collected
- **Extracted Fields:** (none - metadata only)
- **Keywords:** bank statement, account statement, balance, transaction

### Proof of Earning
- **Status Flag:** proof_of_earning_collected
- **Extracted Fields:** employed_salary
- **Keywords:** employment, contract, offer letter, salary

## Error Handling

### Validation Errors (400)
- Missing required fields
- Invalid file format
- File size exceeds limit

### Processing Errors (422)
- OCR extraction failed
- Document type identification failed
- Name validation failed
- Data extraction produced invalid values

### Storage Errors (500)
- GCS upload failed
- Database write failed
- Service unavailable

### Transactional Integrity
- Database changes are rolled back if GCS upload fails
- GCS files are cleaned up if database write fails
- No partial state is persisted

## Usage Examples

### Upload a Payslip

```bash
curl -X POST http://localhost:3000/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@payslip.pdf" \
  -F "projectId=123e4567-e89b-12d3-a456-426614174000" \
  -F "documentType=payslip"
```

### Retrieve a Document

```bash
curl -X GET http://localhost:3000/projects/123e4567-e89b-12d3-a456-426614174000/documents/456e7890-e89b-12d3-a456-426614174001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring and Debugging

### Audit Trail
All processing steps are logged in the audit_logs table. Use the request_id to trace a complete upload operation:

```sql
SELECT * FROM audit_logs 
WHERE request_id = 'your-request-id' 
ORDER BY timestamp;
```

### Common Issues

**GCS Upload Fails:**
- Check GCS_CREDENTIALS environment variable
- Verify service account has Storage Admin role
- Ensure bucket exists and is accessible

**Name Validation Fails:**
- Check customer name in project table
- Review extracted_name in validation_result
- Adjust validation thresholds if needed

**Data Extraction Returns Empty:**
- Review OCR text quality
- Check document type identification
- Verify extraction patterns match document format

## Future Enhancements

- Support for additional document types
- Machine learning-based data extraction
- Multi-language support
- Batch document processing
- Document comparison and duplicate detection
