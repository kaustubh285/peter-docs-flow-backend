import { DocumentType } from './gcs-storage.service'

export interface ValidationResult {
  status: 'validated' | 'flagged' | 'rejected'
  nameMatch: boolean
  confidence: number
  extractedName?: string
  reason?: string
}

export interface NameExtractionResult {
  names: string[]
  primaryName?: string
  confidence: number
}

export interface NameMatchResult {
  match: boolean
  confidence: number
  normalizedExtracted: string
  normalizedExpected: string
}

export class DocumentValidationService {
  // Common title prefixes to remove during normalization
  private readonly TITLE_PREFIXES = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir', 'lady']

  /**
   * Validates document ownership by comparing extracted name with customer name
   * @param ocrText - Raw OCR extracted text
   * @param customerName - Expected customer name from project
   * @returns Validation result with confidence score
   */
  async validateOwnership(
    ocrText: string,
    customerName: string,
    documentType?: DocumentType
  ): Promise<ValidationResult> {
    try {
      // Extract names from the document
      const nameExtraction = await this.extractName(ocrText, documentType)

      if (nameExtraction.names.length === 0) {
        return {
          status: 'flagged',
          nameMatch: false,
          confidence: 0,
          reason: 'No name could be extracted from document'
        }
      }

      // Compare each extracted name against the customer name
      let bestMatch: NameMatchResult | null = null
      let bestMatchName = ''

      for (const extractedName of nameExtraction.names) {
        const matchResult = this.compareNames(extractedName, customerName)
        
        if (!bestMatch || matchResult.confidence > bestMatch.confidence) {
          bestMatch = matchResult
          bestMatchName = extractedName
        }
      }

      if (!bestMatch) {
        return {
          status: 'flagged',
          nameMatch: false,
          confidence: 0,
          reason: 'Name comparison failed'
        }
      }

      // Determine validation status based on confidence
      const VALIDATION_THRESHOLD = 70
      const REJECTION_THRESHOLD = 30

      if (bestMatch.match && bestMatch.confidence >= VALIDATION_THRESHOLD) {
        return {
          status: 'validated',
          nameMatch: true,
          confidence: bestMatch.confidence,
          extractedName: bestMatchName
        }
      } else if (bestMatch.confidence < REJECTION_THRESHOLD) {
        return {
          status: 'rejected',
          nameMatch: false,
          confidence: bestMatch.confidence,
          extractedName: bestMatchName,
          reason: `Name mismatch: expected "${customerName}", found "${bestMatchName}"`
        }
      } else {
        return {
          status: 'flagged',
          nameMatch: false,
          confidence: bestMatch.confidence,
          extractedName: bestMatchName,
          reason: 'Name match confidence below threshold - requires manual review'
        }
      }
    } catch (error) {
      console.error('Validation error:', error)
      return {
        status: 'flagged',
        nameMatch: false,
        confidence: 0,
        reason: `Validation error: ${error}`
      }
    }
  }

  /**
   * Extracts name from document text
   * @param ocrText - Raw OCR extracted text
   * @param documentType - Document type for context
   * @returns Extracted names with confidence scores
   */
  async extractName(
    ocrText: string,
    documentType?: DocumentType
  ): Promise<NameExtractionResult> {
    const names: string[] = []

    // Pattern 1: Name after common labels
    const labelPatterns = [
      /(?:name|employee|customer|client|payee|to)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
      /(?:mr|mrs|ms|miss|dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi
    ]

    for (const pattern of labelPatterns) {
      const matches = ocrText.matchAll(pattern)
      for (const match of matches) {
        if (match[1]) {
          names.push(match[1].trim())
        }
      }
    }

    // Pattern 2: Capitalized words that look like names (2-4 words)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:\s+[A-Z][a-z]+){1,2})\b/g
    const potentialNames = ocrText.matchAll(namePattern)
    
    for (const match of potentialNames) {
      if (match[1]) {
        const name = match[1].trim()
        // Filter out common non-name words
        if (!this.isCommonWord(name) && name.length > 3) {
          names.push(name)
        }
      }
    }

    // Remove duplicates and sort by frequency
    const uniqueNames = [...new Set(names)]
    const nameCounts = new Map<string, number>()
    
    for (const name of names) {
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
    }

    // Sort by frequency
    uniqueNames.sort((a, b) => (nameCounts.get(b) || 0) - (nameCounts.get(a) || 0))

    const primaryName = uniqueNames.length > 0 ? uniqueNames[0] : undefined
    const confidence = uniqueNames.length > 0 ? Math.min(100, 50 + (nameCounts.get(primaryName!) || 0) * 10) : 0

    return {
      names: uniqueNames,
      primaryName,
      confidence
    }
  }

  /**
   * Compares two names with fuzzy matching
   * @param extractedName - Name from document
   * @param expectedName - Customer name from project
   * @returns Match result with confidence score
   */
  compareNames(extractedName: string, expectedName: string): NameMatchResult {
    const normalizedExtracted = this.normalizeName(extractedName)
    const normalizedExpected = this.normalizeName(expectedName)

    // Exact match
    if (normalizedExtracted === normalizedExpected) {
      return {
        match: true,
        confidence: 100,
        normalizedExtracted,
        normalizedExpected
      }
    }

    // Split into parts
    const extractedParts = normalizedExtracted.split(/\s+/)
    const expectedParts = normalizedExpected.split(/\s+/)

    // Check if all parts of one name are contained in the other
    const extractedInExpected = extractedParts.every(part => 
      expectedParts.some(ep => ep.includes(part) || part.includes(ep))
    )
    const expectedInExtracted = expectedParts.every(part => 
      extractedParts.some(ep => ep.includes(part) || part.includes(ep))
    )

    if (extractedInExpected || expectedInExtracted) {
      return {
        match: true,
        confidence: 85,
        normalizedExtracted,
        normalizedExpected
      }
    }

    // Check for initials match (e.g., "J Smith" matches "John Smith")
    const initialsMatch = this.checkInitialsMatch(extractedParts, expectedParts)
    if (initialsMatch) {
      return {
        match: true,
        confidence: 75,
        normalizedExtracted,
        normalizedExpected
      }
    }

    // Calculate similarity score using Levenshtein-like approach
    const similarity = this.calculateSimilarity(normalizedExtracted, normalizedExpected)
    
    return {
      match: similarity > 0.6,
      confidence: Math.round(similarity * 100),
      normalizedExtracted,
      normalizedExpected
    }
  }

  /**
   * Normalizes a name by removing titles, extra spaces, and converting to lowercase
   */
  private normalizeName(name: string): string {
    let normalized = name.toLowerCase().trim()

    // Remove title prefixes
    for (const title of this.TITLE_PREFIXES) {
      const pattern = new RegExp(`\\b${title}\\.?\\s+`, 'gi')
      normalized = normalized.replace(pattern, '')
    }

    // Remove extra spaces and punctuation
    normalized = normalized.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()

    return normalized
  }

  /**
   * Checks if initials in one name match full names in another
   */
  private checkInitialsMatch(parts1: string[], parts2: string[]): boolean {
    // Check if any part is an initial (single letter)
    const hasInitial1 = parts1.some(p => p.length === 1)
    const hasInitial2 = parts2.some(p => p.length === 1)

    if (!hasInitial1 && !hasInitial2) return false

    // Match initials with full names
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      const p1 = parts1[i]
      const p2 = parts2[i]

      if (p1.length === 1 && p2.length > 1) {
        if (p2[0] !== p1[0]) return false
      } else if (p2.length === 1 && p1.length > 1) {
        if (p1[0] !== p2[0]) return false
      } else if (p1 !== p2) {
        return false
      }
    }

    return true
  }

  /**
   * Calculates similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Calculates Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Checks if a word is a common non-name word
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
      'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old',
      'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too',
      'use', 'tax', 'pay', 'year', 'date', 'total', 'amount', 'balance', 'account', 'statement',
      'bank', 'hmrc', 'income', 'salary', 'gross', 'net', 'paye', 'national', 'insurance'
    ]
    return commonWords.includes(word.toLowerCase())
  }
}
