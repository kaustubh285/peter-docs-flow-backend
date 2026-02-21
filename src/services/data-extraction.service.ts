import { DocumentType } from './gcs-storage.service'

export interface DocumentTypeResult {
  type: DocumentType
  confidence: number
  indicators: string[]
}

export interface ExtractedData {
  fields: Record<string, any>
  confidence: number
  rawText: string
}

export interface ProjectFieldUpdates {
  financialData: Record<string, any>
  statusFlags: Record<string, boolean>
}

interface ExtractionMapping {
  statusFlag: string
  extractionPatterns: Record<string, RegExp>
  identificationKeywords: string[]
}

const DOCUMENT_TYPE_MAPPINGS: Record<DocumentType, ExtractionMapping> = {
  p60: {
    statusFlag: 'p60_collected',
    extractionPatterns: {
      in_hand_salary: /(?:pay|salary|income).*?£?\s*([\d,]+\.?\d*)/i,
      tax_paid: /(?:tax|paye).*?£?\s*([\d,]+\.?\d*)/i,
      employed_salary: /(?:total|gross).*?£?\s*([\d,]+\.?\d*)/i
    },
    identificationKeywords: ['p60', 'end of year certificate', 'hmrc', 'tax year']
  },
  payslip: {
    statusFlag: 'payslips_collected',
    extractionPatterns: {
      in_hand_salary: /(?:net pay|take home).*?£?\s*([\d,]+\.?\d*)/i,
      employed_salary: /(?:gross pay|basic salary).*?£?\s*([\d,]+\.?\d*)/i,
      tax_paid: /(?:tax|paye|income tax).*?£?\s*([\d,]+\.?\d*)/i
    },
    identificationKeywords: ['payslip', 'pay slip', 'salary advice', 'payment summary']
  },
  tax_return: {
    statusFlag: 'tax_returns_collected',
    extractionPatterns: {
      self_employed_other_income: /(?:self.?employed|trading).*?£?\s*([\d,]+\.?\d*)/i,
      rental_income: /(?:rental|property).*?income.*?£?\s*([\d,]+\.?\d*)/i,
      tax_paid: /(?:tax paid|total tax).*?£?\s*([\d,]+\.?\d*)/i
    },
    identificationKeywords: ['self assessment', 'tax return', 'sa100', 'hmrc']
  },
  bank_statement: {
    statusFlag: 'bank_statements_collected',
    extractionPatterns: {},
    identificationKeywords: ['bank statement', 'account statement', 'balance', 'transaction']
  },
  proof_of_earning: {
    statusFlag: 'proof_of_earning_collected',
    extractionPatterns: {
      employed_salary: /(?:annual|yearly).*?(?:salary|income).*?£?\s*([\d,]+\.?\d*)/i
    },
    identificationKeywords: ['employment', 'contract', 'offer letter', 'salary']
  },
  unknown: {
    statusFlag: '',
    extractionPatterns: {},
    identificationKeywords: []
  }
}

export class DataExtractionService {
  /**
   * Identifies document type from OCR text
   * @param ocrText - Raw OCR extracted text
   * @returns Document type and confidence score
   */
  async identifyDocumentType(ocrText: string): Promise<DocumentTypeResult> {
    const lowerText = ocrText.toLowerCase()
    const scores: Array<{ type: DocumentType; score: number; indicators: string[] }> = []

    // Check each document type for keyword matches
    for (const [docType, mapping] of Object.entries(DOCUMENT_TYPE_MAPPINGS)) {
      if (docType === 'unknown') continue

      const indicators: string[] = []
      let score = 0

      for (const keyword of mapping.identificationKeywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          indicators.push(keyword)
          score += 1
        }
      }

      if (score > 0) {
        scores.push({
          type: docType as DocumentType,
          score,
          indicators
        })
      }
    }

    // Sort by score and return the best match
    scores.sort((a, b) => b.score - a.score)

    if (scores.length === 0) {
      return {
        type: 'unknown',
        confidence: 0,
        indicators: []
      }
    }

    const bestMatch = scores[0]
    const totalKeywords = DOCUMENT_TYPE_MAPPINGS[bestMatch.type].identificationKeywords.length
    const confidence = Math.min((bestMatch.score / totalKeywords) * 100, 100)

    return {
      type: bestMatch.type,
      confidence,
      indicators: bestMatch.indicators
    }
  }

  /**
   * Extracts structured financial data based on document type
   * @param ocrText - Raw OCR extracted text
   * @param documentType - Identified document type
   * @returns Extracted fields with confidence scores
   */
  async extractFinancialData(
    ocrText: string,
    documentType: DocumentType
  ): Promise<ExtractedData> {
    const mapping = DOCUMENT_TYPE_MAPPINGS[documentType]
    const fields: Record<string, any> = {}
    let matchCount = 0

    // Extract fields using patterns
    for (const [fieldName, pattern] of Object.entries(mapping.extractionPatterns)) {
      // Use matchAll to find all occurrences
      const globalPattern = new RegExp(pattern.source, pattern.flags + 'g')
      const matches = Array.from(ocrText.matchAll(globalPattern))
      
      if (matches.length > 0) {
        // If multiple values found, disambiguate
        const candidates: number[] = []
        
        for (const match of matches) {
          if (match[1]) {
            const cleanValue = match[1].replace(/,/g, '')
            const numericValue = parseFloat(cleanValue)

            if (!isNaN(numericValue) && numericValue > 0) {
              candidates.push(numericValue)
            }
          }
        }

        if (candidates.length > 0) {
          // Select the most likely value
          const selectedValue = this.selectBestValue(candidates, fieldName, documentType)
          fields[fieldName] = selectedValue
          matchCount++
        }
      }
    }

    // Calculate confidence based on how many fields were extracted
    const totalPatterns = Object.keys(mapping.extractionPatterns).length
    const confidence = totalPatterns > 0 ? (matchCount / totalPatterns) * 100 : 0

    return {
      fields,
      confidence,
      rawText: ocrText
    }
  }

  /**
   * Selects the best value from multiple candidates
   * Uses heuristics based on document type and field name
   */
  private selectBestValue(candidates: number[], fieldName: string, documentType: DocumentType): number {
    if (candidates.length === 1) {
      return candidates[0]
    }

    // Remove duplicates
    const uniqueCandidates = [...new Set(candidates)]

    if (uniqueCandidates.length === 1) {
      return uniqueCandidates[0]
    }

    // For salary fields, prefer larger values (annual over monthly)
    if (fieldName.includes('salary') || fieldName.includes('income')) {
      return Math.max(...uniqueCandidates)
    }

    // For tax fields, prefer the value that appears most frequently
    const frequency = new Map<number, number>()
    for (const value of candidates) {
      frequency.set(value, (frequency.get(value) || 0) + 1)
    }

    let maxFreq = 0
    let mostFrequent = uniqueCandidates[0]
    
    for (const [value, freq] of frequency.entries()) {
      if (freq > maxFreq) {
        maxFreq = freq
        mostFrequent = value
      }
    }

    return mostFrequent
  }

  /**
   * Maps extracted data to project table fields
   * @param extractedData - Extracted financial data
   * @param documentType - Document type
   * @returns Field mappings for database update
   */
  mapToProjectFields(
    extractedData: ExtractedData,
    documentType: DocumentType
  ): ProjectFieldUpdates {
    const mapping = DOCUMENT_TYPE_MAPPINGS[documentType]
    
    const financialData: Record<string, any> = {}
    const statusFlags: Record<string, boolean> = {}

    // Map extracted fields to project financial fields
    for (const [fieldName, value] of Object.entries(extractedData.fields)) {
      financialData[fieldName] = value
    }

    // Set the appropriate status flag
    if (mapping.statusFlag) {
      statusFlags[mapping.statusFlag] = true
    }

    return {
      financialData,
      statusFlags
    }
  }

  /**
   * Validates that a financial value is in valid format
   * @param value - Value to validate
   * @returns True if valid
   */
  validateFinancialValue(value: any): boolean {
    if (typeof value === 'number') {
      return value > 0 && isFinite(value)
    }

    if (typeof value === 'string') {
      const cleanValue = value.replace(/[£,\s]/g, '')
      const numericValue = parseFloat(cleanValue)
      return !isNaN(numericValue) && numericValue > 0 && isFinite(numericValue)
    }

    return false
  }
}
