# Quick Start - Intelligent Document Processing

## 🚀 What's New

Your document upload endpoint now has intelligent processing capabilities:
- ✅ Automatic financial data extraction from UK documents
- ✅ Document ownership validation by name matching
- ✅ Google Cloud Storage integration
- ✅ Automatic project field updates
- ✅ Comprehensive audit logging

## 📋 Prerequisites

Before you can use the new features, you need:
1. Google Cloud Platform account
2. GCS bucket created
3. Service account with Storage Admin role
4. Service account credentials JSON

## ⚡ Quick Setup (5 minutes)

### 1. Install Dependencies (Already Done ✅)

```bash
# Dependencies already installed:
# - @google-cloud/storage
# - uuid
```

### 2. Configure GCS

Add these to your `.env` file:

```env
GCS_PROJECT_ID=your-gcs-project-id
GCS_BUCKET_NAME=financial-advisor-documents
GCS_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"..."}
```

**How to get credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a bucket (Cloud Storage > Buckets > Create)
3. Create service account (IAM & Admin > Service Accounts > Create)
4. Grant "Storage Admin" role
5. Create JSON key and download
6. Copy entire JSON content to `GCS_CREDENTIALS`

### 3. Start the Server

```bash
cd peter
npm run dev
```

## 🧪 Test It Out

### Upload a Document

```bash
curl -X POST http://localhost:3000/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F "projectId=YOUR_PROJECT_ID" \
  -F "documentType=payslip"
```

### Expected Response

```json
{
  "document": {
    "id": "...",
    "document_type": "payslip",
    "gcs_path": "projects/.../payslip/...",
    "extraction_status": "success",
    "validation_status": "validated"
  },
  "extracted_data": {
    "fields": {
      "in_hand_salary": 2500.00,
      "employed_salary": 3000.00
    },
    "confidence": 85
  },
  "validation_result": {
    "status": "validated",
    "nameMatch": true,
    "confidence": 95
  }
}
```

## 📚 What Happens Behind the Scenes

When you upload a document, the system:

1. **Validates** file format and size
2. **Extracts** text using OCR (Tesseract.js)
3. **Identifies** document type (P60, payslip, tax return, etc.)
4. **Extracts** financial data (salary, tax, income)
5. **Validates** ownership by comparing names
6. **Uploads** to Google Cloud Storage
7. **Saves** metadata to database
8. **Updates** project financial fields
9. **Logs** everything for audit trail

## 🎯 Supported Document Types

- **P60** - End of Year Certificate
- **Payslip** - Monthly/weekly pay statements
- **Tax Return** - Self Assessment forms
- **Bank Statement** - Account statements
- **Proof of Earning** - Employment contracts, offer letters

## 🔧 Configuration Options

### Skip Validation (for testing)

```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@document.pdf" \
  -F "projectId=YOUR_PROJECT_ID" \
  -F "skipValidation=true"
```

### Specify Document Type

```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@document.pdf" \
  -F "projectId=YOUR_PROJECT_ID" \
  -F "documentType=p60"
```

## 🐛 Troubleshooting

### "Could not load the default credentials"

**Fix:** Check `GCS_CREDENTIALS` in `.env` is valid JSON

### "File and projectId required"

**Fix:** Ensure you're sending multipart/form-data with both fields

### "Name mismatch"

**Fix:** 
- Check customer name in project table matches document
- Or use `skipValidation=true` for testing

### "GCS upload failed"

**Fix:**
- Verify service account has Storage Admin role
- Check bucket exists and is accessible
- Ensure credentials are correct

## 📖 Full Documentation

- **Setup Guide**: `docs/SETUP_GUIDE.md` - Detailed setup instructions
- **API Docs**: `docs/INTELLIGENT_DOCUMENT_PROCESSING.md` - Complete API reference
- **Summary**: `docs/IMPLEMENTATION_SUMMARY.md` - What was implemented

## 🎉 You're Ready!

Once GCS is configured, your enhanced upload endpoint is ready to use. Upload a test document and watch the magic happen!

## 💡 Tips

1. **Start with test documents** - Use sample payslips or P60s first
2. **Check audit logs** - Review `audit_logs` table for processing details
3. **Monitor GCS** - Check your bucket to see uploaded files
4. **Adjust patterns** - Modify extraction patterns in `data-extraction.service.ts` if needed

## 🆘 Need Help?

1. Check the console logs for detailed error messages
2. Review audit_logs table for processing history
3. Refer to full documentation in `docs/` folder
4. Verify GCS credentials and permissions

---

**Note:** Database migrations are optional. The system works with your existing schema. See `SETUP_GUIDE.md` for optional schema enhancements.
