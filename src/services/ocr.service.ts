import Tesseract from 'tesseract.js'
import * as pdfParse from 'pdf-parse'

export class OCRService {
  async extract(fileBuffer: Buffer): Promise<Record<string, any>> {
    try {
      // Check if file is a PDF by looking at the file signature
      const isPDF = this.isPDFFile(fileBuffer)
      
      if (isPDF) {
        console.log('PDF detected - extracting text from PDF...')
        try {
          // Use pdfParse as a function
          const data = await (pdfParse as any)(fileBuffer)
          const text = data.text
          
          if (!text || text.trim().length === 0) {
            console.log('PDF has no extractable text (might be scanned image)')
            return {
              raw_text: 'PDF document contains no extractable text. May require OCR processing.',
              extracted_fields: {},
              note: 'PDF appears to be a scanned image without text layer.'
            }
          }
          
          console.log(`Extracted ${text.length} characters from PDF`)
          const extractedData = this.parseFinancialData(text)
          return extractedData
          
        } catch (pdfError) {
          console.error('PDF text extraction failed:', pdfError)
          return {
            raw_text: 'PDF text extraction failed. Document stored successfully.',
            extracted_fields: {},
            error: String(pdfError)
          }
        }
      }

      // Only use Tesseract for image files
      console.log('Image file detected - running OCR...')
      const { data: { text } } = await Tesseract.recognize(fileBuffer, 'eng', {
        logger: m => console.log(m)
      })
      
      // Basic extraction patterns for financial documents
      const extractedData = this.parseFinancialData(text)
      
      return extractedData
    } catch (error) {
      console.error('OCR extraction failed:', error)
      return { 
        raw_text: 'OCR extraction failed - document stored without text extraction', 
        extracted_fields: {},
        error: String(error)
      }
    }
  }

  /**
   * Check if buffer contains a PDF file by checking the file signature
   */
  private isPDFFile(buffer: Buffer): boolean {
    // PDF files start with %PDF
    const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF
    return buffer.slice(0, 4).equals(pdfSignature)
  }

  private parseFinancialData(text: string): Record<string, any> {
    const data: Record<string, any> = {
      raw_text: text,
      extracted_fields: {}
    }

    // Patterns for common financial data
    const patterns = {
      salary: /salary[:\s]+£?([\d,]+(?:\.\d{2})?)/i,
      income: /(?:annual|yearly|total)\s*income[:\s]+£?([\d,]+(?:\.\d{2})?)/i,
      balance: /balance[:\s]+£?([\d,]+(?:\.\d{2})?)/i,
      amount: /amount[:\s]+£?([\d,]+(?:\.\d{2})?)/i,
      date: /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/g,
      account: /account[\s#:]*([\d-]+)/i
    }

    // Extract using patterns
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern)
      if (match) {
        if (key === 'date') {
          data.extracted_fields[key] = text.match(pattern)
        } else {
          data.extracted_fields[key] = match[1]
        }
      }
    }

    return data
  }
}
