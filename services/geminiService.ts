/**
 * Service for interacting with Google Gemini API
 */

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export const geminiService = {
  async generateContent(prompt: string): Promise<string> {
    try {
      if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
      }

      const requestBody: GeminiRequest = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      };

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data: GeminiResponse = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
      }

      throw new Error('No content received from Gemini API');
    } catch (error) {
      console.error('Gemini service error:', error);
      throw error;
    }
  },
};
