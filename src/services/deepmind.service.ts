import { GoogleGenerativeAI } from '@google/generative-ai'

export class DeepMindService {
  private genAI: GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY!
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async chat(prompt: string): Promise<Record<string, any>> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' })
      
      const enhancedPrompt = `
You are a financial advisor AI assistant. Analyze the provided financial data and return insights in the following JSON format:
{
  "risk_profile": "low|medium|high",
  "net_worth_estimate": number,
  "recommendations": [
    {
      "category": "savings|investment|debt|insurance",
      "priority": "high|medium|low",
      "suggestion": "detailed recommendation",
      "reasoning": "why this recommendation"
    }
  ],
  "summary": "overall financial health summary",
  "next_steps": ["step1", "step2", "step3"]
}

Data to analyze: ${prompt}
`

      const result = await model.generateContent(enhancedPrompt)
      const response = await result.response
      const text = response.text()
      
      // Try to parse as JSON, fallback to structured response
      try {
        return JSON.parse(text)
      } catch {
        return {
          risk_profile: 'medium',
          summary: text,
          recommendations: [],
          next_steps: []
        }
      }
    } catch (error) {
      console.error('AI generation failed:', error)
      return {
        error: 'AI analysis failed',
        risk_profile: 'unknown',
        summary: 'Unable to generate insights at this time',
        recommendations: [],
        next_steps: []
      }
    }
  }
}
