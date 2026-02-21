# Financial Advisor Helper API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000` (or your deployed URL)  
**Authentication:** Bearer Token (JWT)

## Overview

The Financial Advisor Helper API provides endpoints for managing financial advisory projects, document uploads, AI-powered insights, and user authentication. The API is built with Hono.js and follows REST conventions.

## Authentication

Most endpoints require authentication via JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

---

## 🔐 Authentication

### POST /login

Authenticate users and receive JWT access token.

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | ✅ | User email address (must be valid email) |
| `password` | string | ✅ | User password (minimum 6 characters) |
| `role` | string | ✅ | User role: `"advisor"` or `"customer"` |

**Request Example:**
```json
{
  "email": "advisor@example.com",
  "password": "securepassword",
  "role": "advisor"
}
```

#### Response

**Success (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "uuid-string",
  "role": "advisor"
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Invalid credentials"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Login failed"
}
```

---

## 📋 Project Management

### GET /projects

Retrieve all projects accessible to the authenticated user.

#### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:** None

#### Response

**Success (200):**
```json
[
  {
    "id": "proj-uuid",
    "customer_user_id": "customer-uuid",
    "advisor_user_id": "advisor-uuid", 
    "name": "Tax Optimization Project",
    "description": "Help with tax planning and optimization",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "payslips_collected": true,
    "p60_collected": false,
    "tax_returns_collected": true,
    "other_hmrc_docs_collected": false,
    "bank_statements_collected": true,
    "proof_of_earning_collected": false,
    "document_2_collected": false,
    "document_3_collected": false,
    "document_4_collected": false,
    "in_hand_salary": 50000,
    "tax_paid": 12500,
    "home_loan": 250000,
    "education_loan": null,
    "employed": true,
    "employed_salary": 55000,
    "self_employed_other_income": null,
    "rental_income": 12000,
    "total_mortgage_amount": 300000,
    "total_mortgage_interest": 15000,
    "customer": {
      "id": "customer-uuid",
      "name": "John Smith",
      "email": "john@example.com"
    },
    "advisor": {
      "id": "advisor-uuid", 
      "name": "Sarah Johnson",
      "email": "sarah@advisorco.com"
    }
  }
]
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to fetch projects"
}
```

---

### POST /customers/{customerId}/projects

Create a new project for a customer (advisor only).

#### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | ✅ | UUID of the customer |

**Body Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | ✅ | - | Project name |
| `description` | string | ✅ | - | Project description |
| `status` | string | ❌ | `"pending"` | Project status: `"active"`, `"inactive"`, or `"pending"` |

**Request Example:**
```json
{
  "name": "Investment Portfolio Review",
  "description": "Comprehensive review of client's investment portfolio and recommendations for optimization",
  "status": "active"
}
```

#### Response

**Success (200):**
```json
[
  {
    "id": "new-proj-uuid",
    "customer_user_id": "customer-uuid",
    "advisor_user_id": "advisor-uuid",
    "name": "Investment Portfolio Review", 
    "description": "Comprehensive review of client's investment portfolio and recommendations for optimization",
    "status": "active",
    "created_at": "2024-01-15T14:22:33Z",
    "payslips_collected": false,
    "p60_collected": false,
    "tax_returns_collected": false,
    "other_hmrc_docs_collected": false,
    "bank_statements_collected": false,
    "proof_of_earning_collected": false,
    "document_2_collected": false,
    "document_3_collected": false,
    "document_4_collected": false,
    "in_hand_salary": null,
    "tax_paid": null,
    "home_loan": null,
    "education_loan": null,
    "employed": null,
    "employed_salary": null,
    "self_employed_other_income": null,
    "rental_income": null,
    "total_mortgage_amount": null,
    "total_mortgage_interest": null
  }
]
```

**Error (403 Forbidden):**
```json
{
  "error": "Access denied. Advisor role required."
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to create project"
}
```

---

### GET /projects/{projectId}/view

View detailed project information including documents.

#### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | ✅ | UUID of the project |

#### Response

**Success (200):**
```json
{
  "project": {
    "id": "proj-uuid",
    "customer_user_id": "customer-uuid", 
    "advisor_user_id": "advisor-uuid",
    "name": "Tax Optimization Project",
    "description": "Help with tax planning and optimization",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "payslips_collected": true,
    "p60_collected": false,
    "tax_returns_collected": true,
    "other_hmrc_docs_collected": false,
    "bank_statements_collected": true,
    "proof_of_earning_collected": false,
    "document_2_collected": false,
    "document_3_collected": false,
    "document_4_collected": false,
    "in_hand_salary": 50000,
    "tax_paid": 12500,
    "home_loan": 250000,
    "education_loan": null,
    "employed": true,
    "employed_salary": 55000,
    "self_employed_other_income": null,
    "rental_income": 12000,
    "total_mortgage_amount": 300000,
    "total_mortgage_interest": 15000,
    "customer": {
      "id": "customer-uuid",
      "name": "John Smith", 
      "email": "john@example.com"
    },
    "advisor": {
      "id": "advisor-uuid",
      "name": "Sarah Johnson",
      "email": "sarah@advisorco.com"
    }
  },
  "documents": [
    {
      "id": "doc-uuid-1",
      "project_id": "proj-uuid", 
      "title": "January Payslip",
      "file_url": "projects/proj-uuid/1642248000000-payslip.pdf",
      "content_text": "Extracted text content from OCR...",
      "created_at": "2024-01-15T11:15:22Z"
    },
    {
      "id": "doc-uuid-2",
      "project_id": "proj-uuid",
      "title": "Bank Statement December",
      "file_url": "projects/proj-uuid/1642334400000-statement.pdf", 
      "content_text": "Bank statement content...",
      "created_at": "2024-01-15T12:33:44Z"
    }
  ]
}
```

**Error (404 Not Found):**
```json
{
  "error": "Project not found or access denied"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to view project data"
}
```

---

## 💰 Financial Data Management

### PATCH /projects/{projectId}/financials

Update financial data for a project.

#### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | ✅ | UUID of the project |

**Body Parameters (all optional):**
| Parameter | Type | Description |
|-----------|------|-------------|
| `in_hand_salary` | number | Take-home salary amount |
| `tax_paid` | number | Total tax paid |
| `home_loan` | number | Home loan amount |
| `education_loan` | number | Education loan amount |
| `employed` | boolean | Employment status |
| `employed_salary` | number | Gross employment salary |
| `self_employed_other_income` | number | Self-employed/other income |
| `rental_income` | number | Rental income amount |
| `total_mortgage_amount` | number | Total mortgage principal |
| `total_mortgage_interest` | number | Total mortgage interest |

**Request Example:**
```json
{
  "in_hand_salary": 52000,
  "tax_paid": 13000,
  "home_loan": 275000,
  "employed": true,
  "employed_salary": 58000,
  "rental_income": 15000
}
```

#### Response

**Success (200):**
```json
[
  {
    "id": "proj-uuid",
    "customer_user_id": "customer-uuid",
    "advisor_user_id": "advisor-uuid",
    "name": "Tax Optimization Project",
    "description": "Help with tax planning and optimization", 
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "in_hand_salary": 52000,
    "tax_paid": 13000,
    "home_loan": 275000,
    "education_loan": null,
    "employed": true,
    "employed_salary": 58000,
    "self_employed_other_income": null,
    "rental_income": 15000,
    "total_mortgage_amount": 300000,
    "total_mortgage_interest": 15000,
    "payslips_collected": true,
    "p60_collected": false,
    "tax_returns_collected": true,
    "other_hmrc_docs_collected": false,
    "bank_statements_collected": true,
    "proof_of_earning_collected": false,
    "document_2_collected": false,
    "document_3_collected": false,
    "document_4_collected": false
  }
]
```

**Error (404 Not Found):**
```json
{
  "error": "Project not found or access denied"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to update financial data"
}
```

---

### PATCH /projects/{projectId}/documents/status

Update document collection status (advisor only).

#### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | ✅ | UUID of the project |

**Body Parameters (all optional):**
| Parameter | Type | Description |
|-----------|------|-------------|
| `payslips_collected` | boolean | Payslips collection status |
| `p60_collected` | boolean | P60 collection status |
| `tax_returns_collected` | boolean | Tax returns collection status |
| `other_hmrc_docs_collected` | boolean | Other HMRC documents status |
| `bank_statements_collected` | boolean | Bank statements collection status |
| `proof_of_earning_collected` | boolean | Proof of earning collection status |
| `document_2_collected` | boolean | Additional document 2 status |
| `document_3_collected` | boolean | Additional document 3 status |
| `document_4_collected` | boolean | Additional document 4 status |

**Request Example:**
```json
{
  "payslips_collected": true,
  "p60_collected": true,
  "bank_statements_collected": false,
  "tax_returns_collected": true
}
```

#### Response

**Success (200):**
```json
[
  {
    "id": "proj-uuid",
    "customer_user_id": "customer-uuid", 
    "advisor_user_id": "advisor-uuid",
    "name": "Tax Optimization Project",
    "description": "Help with tax planning and optimization",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "payslips_collected": true,
    "p60_collected": true,
    "tax_returns_collected": true,
    "other_hmrc_docs_collected": false,
    "bank_statements_collected": false,
    "proof_of_earning_collected": false,
    "document_2_collected": false,
    "document_3_collected": false,
    "document_4_collected": false,
    "in_hand_salary": 52000,
    "tax_paid": 13000,
    "home_loan": 275000,
    "education_loan": null,
    "employed": true,
    "employed_salary": 58000,
    "self_employed_other_income": null,
    "rental_income": 15000,
    "total_mortgage_amount": 300000,
    "total_mortgage_interest": 15000
  }
]
```

**Error (403 Forbidden):**
```json
{
  "error": "Access denied. Advisor role required."
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to update document status"
}
```

---

## 📁 Document Management

### POST /upload

Upload documents to a project with OCR text extraction.

#### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | ✅ | Document file to upload |
| `projectId` | string | ✅ | UUID of the target project |
| `title` | string | ❌ | Custom title for the document |

**Request Example:**
```
POST /upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="projectId"

proj-uuid-12345
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="title"

February Bank Statement
------WebKitFormBoundary7MA4YWxkTrZu0gW  
Content-Disposition: form-data; name="file"; filename="statement_feb.pdf"
Content-Type: application/pdf

[binary file content]
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

#### Response

**Success (200):**
```json
{
  "document": {
    "id": "doc-new-uuid",
    "project_id": "proj-uuid-12345",
    "title": "February Bank Statement",
    "file_url": "projects/proj-uuid-12345/1642420800000-statement_feb.pdf",
    "content_text": "ACCOUNT STATEMENT\nAccount Number: ****1234\nStatement Period: 01/02/2024 - 28/02/2024...",
    "created_at": "2024-01-17T09:20:00Z"
  },
  "extracted_data": {
    "raw_text": "ACCOUNT STATEMENT\nAccount Number: ****1234\nStatement Period: 01/02/2024 - 28/02/2024...",
    "confidence": 0.95,
    "processing_time_ms": 1240
  }
}
```

**Error (400 Bad Request):**
```json
{
  "error": "File and projectId required"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "File upload failed"
}
```

```json
{
  "error": "Database save failed"
}
```

```json
{
  "error": "Upload failed"
}
```

---

## 🤖 AI Insights

### GET /projects/{projectId}/insights

Generate AI-powered financial insights for a project (advisor only).

#### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | ✅ | UUID of the project |

#### Response

**Success (200):**
```json
{
  "insights": {
    "summary": "Based on the financial data and uploaded documents, here are key insights for this client:",
    "recommendations": [
      {
        "category": "Tax Efficiency", 
        "priority": "High",
        "description": "Consider increasing pension contributions to reduce tax liability",
        "potential_savings": "£2,400 annually"
      },
      {
        "category": "Investment Strategy",
        "priority": "Medium", 
        "description": "Diversify investment portfolio to include ISA allowances",
        "potential_savings": "£1,800 tax-free growth potential"
      }
    ],
    "risk_factors": [
      {
        "factor": "High mortgage to income ratio",
        "severity": "Medium",
        "mitigation": "Consider mortgage restructuring or overpayments"
      }
    ],
    "compliance_notes": [
      {
        "requirement": "Self Assessment Filing",
        "status": "Required",
        "deadline": "2024-01-31",
        "notes": "Rental income requires self assessment"
      }
    ],
    "generated_at": "2024-01-17T10:15:33Z",
    "analysis_version": "1.2.0"
  }
}
```

**Error (403 Forbidden):**
```json
{
  "error": "Access denied. Advisor role required."
}
```

**Error (404 Not Found):**
```json
{
  "error": "Project not found or access denied"  
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to generate insights"
}
```

---

## ❤️ Health Check

### GET /health

Health check endpoint to verify API availability.

#### Request

**Headers:** None required

#### Response

**Success (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-17T10:30:15.123Z",
  "version": "1.0.0"
}
```

---

## Error Handling

The API uses standard HTTP status codes and returns error responses in JSON format:

### Common Status Codes

- **200 OK** - Request successful
- **400 Bad Request** - Invalid request parameters
- **401 Unauthorized** - Authentication required or invalid
- **403 Forbidden** - Insufficient permissions  
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

### Error Response Format

```json
{
  "error": "Description of the error"
}
```

## Authentication & Authorization

### Roles

- **advisor**: Can create projects, update document status, generate insights
- **customer**: Can view own projects, update own financial data

### JWT Token

Tokens expire after 24 hours. Include in requests as:
```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing rate limiting for production use.

## File Upload Specifications

### Supported File Types
- PDF documents
- Image files (PNG, JPEG, GIF, etc.)
- Text documents

### File Size Limits
- Maximum file size: Check your server configuration
- Recommended: Under 10MB for optimal processing

### OCR Processing
- Automatically extracts text content from uploaded documents
- Supports multiple languages
- Returns confidence scores and processing metadata
```

I've created comprehensive API documentation that covers all your endpoints in a Scalar-docs style format. Here's what I've included:

## Key Features of the Documentation:

1. **Complete Endpoint Coverage** - All 9 endpoints documented
2. **Request/Response Examples** - Detailed JSON examples for each endpoint
3. **Parameter Documentation** - All required and optional parameters
4. **Error Handling** - Common error scenarios and responses
5. **Authentication Details** - JWT token usage and role-based access
6. **Schema Information** - Based on your Zod schemas and TypeScript types

## Structure:
- **Authentication** - Login endpoint
- **Project Management** - CRUD operations for projects  
- **Financial Data** - Update financial information
- **Document Management** - File upload with OCR
- **AI Insights** - Generate insights from project data
- **Health Check** - API status endpoint

## Additional Features:
- **Role-based permissions** clearly documented
- **Multipart form data** examples for file uploads
- **Comprehensive error responses** with proper HTTP status codes
- **Real-world example data** that matches your business domain

The documentation follows modern API documentation standards similar to Scalar, OpenAPI, and other popular formats. You can use this as a foundation and potentially convert it to an OpenAPI specification later if needed.
