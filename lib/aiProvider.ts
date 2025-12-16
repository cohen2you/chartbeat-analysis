import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type AIProvider = 'openai' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' };
}

export interface AICompletionResult {
  content: string;
  provider: AIProvider;
}

class AIProviderService {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private currentProvider: AIProvider = 'openai';

  constructor() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    // Determine which provider to use
    // Priority: GEMINI_API_KEY env var > OPENAI_API_KEY
    // Or use AI_PROVIDER env var if set
    if (process.env.AI_PROVIDER) {
      this.currentProvider = process.env.AI_PROVIDER.toLowerCase() as AIProvider;
    } else if (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      this.currentProvider = 'gemini';
    } else {
      this.currentProvider = 'openai';
    }
  }

  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }

  setProvider(provider: AIProvider): void {
    // Validate provider is available
    if (provider === 'gemini' && !this.gemini) {
      console.warn('Gemini API key not configured, falling back to OpenAI');
      if (this.openai) {
        this.currentProvider = 'openai';
        return;
      }
      throw new Error('Gemini API key not configured and OpenAI is also not available');
    }
    if (provider === 'openai' && !this.openai) {
      console.warn('OpenAI API key not configured, falling back to Gemini');
      if (this.gemini) {
        this.currentProvider = 'gemini';
        return;
      }
      throw new Error('OpenAI API key not configured and Gemini is also not available');
    }
    this.currentProvider = provider;
  }

  async generateCompletion(
    messages: ChatMessage[],
    options: AICompletionOptions = {},
    providerOverride?: AIProvider
  ): Promise<AICompletionResult> {
    const provider = providerOverride || this.currentProvider;
    
    if (provider === 'gemini' && this.gemini) {
      try {
        return await this.generateGeminiCompletion(messages, options);
      } catch (error: any) {
        // If Gemini fails and OpenAI is available, fall back to OpenAI
        if (this.openai && (error.message?.includes('not found') || error.message?.includes('All model attempts failed'))) {
          console.warn('Gemini models not available, falling back to OpenAI');
          return this.generateOpenAICompletion(messages, options);
        }
        throw error;
      }
    } else if (provider === 'openai' && this.openai) {
      return this.generateOpenAICompletion(messages, options);
    } else {
      throw new Error(`AI provider '${provider}' not available. Please check your API keys.`);
    }
  }

  private async generateOpenAICompletion(
    messages: ChatMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // OpenAI models (gpt-4-turbo-preview) have a max of 4096 completion tokens
    // Cap the maxTokens to prevent API errors
    const maxTokens = Math.min(options.maxTokens ?? 4096, 4096);

    const completion = await this.openai.chat.completions.create({
      model: options.model || 'gpt-4-turbo-preview',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      response_format: options.responseFormat,
      temperature: options.temperature ?? 0.7,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return {
      content,
      provider: 'openai',
    };
  }

  private async generateGeminiCompletion(
    messages: ChatMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResult> {
    if (!this.gemini) {
      throw new Error('Gemini client not initialized');
    }

    // Extract system message and user messages
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Build the prompt - combine system message with user content
    let prompt = '';
    if (systemMessage) {
      prompt += `System: ${systemMessage}\n\n`;
    }

    // Add user messages
    conversationMessages.forEach(msg => {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    });

    // If JSON format is required, add instruction
    if (options.responseFormat?.type === 'json_object') {
      prompt += '\n\nIMPORTANT: You must respond with valid JSON only. Do not include any text outside of the JSON object.';
    }

    const generationConfig: any = {
      temperature: options.temperature ?? 0.7,
      // CRITICAL: Gemini supports higher token limits (8192+)
      // Use the provided maxTokens or default to 8192 for Gemini
      maxOutputTokens: options.maxTokens ?? 8192,
    };

    // Gemini 1.5+ supports JSON mode - force JSON output
    if (options.responseFormat?.type === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
      // Also add instruction to ensure clean JSON
      prompt += '\n\nCRITICAL: You must respond with ONLY valid JSON. Do not include any markdown code blocks, explanations, or text outside the JSON object.';
    }
    
    // Ensure maxOutputTokens is always set (critical for preventing truncation)
    if (!generationConfig.maxOutputTokens || generationConfig.maxOutputTokens < 2048) {
      generationConfig.maxOutputTokens = 8192;
    }

    // Model Cascading (Waterfall) Strategy
    // Primary: gemini-3-pro-preview (Smartest, most fragile)
    // Secondary: gemini-2.5-pro (Stable, high intelligence)
    // Safety Net: gemini-2.5-flash (Fastest, highest rate limits, cheapest)
    const modelPriority = options.model ? [options.model] : [
      'gemini-3-pro-preview',  // 1. Try the genius model
      'gemini-2.5-pro',        // 2. Fallback to stable pro
      'gemini-2.5-flash',      // 3. Fallback to the reliable workhorse
    ];
    
    let lastError: any = null;
    
    // Try each model in priority order until one works
    for (const modelName of modelPriority) {
      try {
        // Log the config to verify maxOutputTokens is set
        console.log(`Attempting Gemini model: ${modelName} with maxOutputTokens: ${generationConfig.maxOutputTokens}`);
        console.log(`Prompt length: ${prompt.length} characters`);
        
        const model = this.gemini.getGenerativeModel({
          model: modelName,
          generationConfig,
        });

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        console.log(`Gemini response length: ${text.length} characters`);
        
        // Check if response seems truncated (ends abruptly)
        if (text.length > 0) {
          const lastChar = text.trim().slice(-1);
          const endsWithBrace = lastChar === '}';
          const endsWithBracket = lastChar === ']';
          const endsWithQuote = lastChar === '"';
          if (!endsWithBrace && !endsWithBracket && !endsWithQuote && text.length < 1000) {
            console.warn(`⚠ Response may be truncated - ends with: "${lastChar}" (length: ${text.length})`);
          }
        }

        console.log(`✓ Successfully used Gemini model: ${modelName}`);
        return {
          content: text,
          provider: 'gemini',
        };
      } catch (error: any) {
        lastError = error;
        
        // Get HTTP status code from error
        const statusCode = error.status || 
                          error.response?.status || 
                          error.statusCode ||
                          (error.message?.match(/\[(\d+)\]/)?.[1] ? parseInt(error.message.match(/\[(\d+)\]/)?.[1]) : null);
        
        // CRITICAL: Only fallback on specific recoverable errors
        // 429 = Too Many Requests (Rate Limit)
        // 503 = Service Unavailable (Overloaded)
        // 500 = Internal Server Error
        // 404 = Not Found (Model not available)
        const isRecoverable = [429, 503, 500, 404].includes(statusCode) ||
                              error.message?.includes('not found') ||
                              error.message?.includes('rate limit') ||
                              error.message?.includes('quota') ||
                              error.message?.includes('overloaded') ||
                              error.message?.includes('service unavailable');
        
        // Check for non-recoverable errors (safety/blocked content)
        const isNonRecoverable = error.message?.includes('safety') ||
                                 error.message?.includes('blocked') ||
                                 error.message?.includes('content policy') ||
                                 error.message?.includes('harmful') ||
                                 statusCode === 400; // Bad Request (usually prompt issues)
        
        if (isNonRecoverable) {
          // If it's a safety/blocked content error, switching models won't help
          // Fail immediately to avoid wasting quota and latency
          console.error(`Non-recoverable error with ${modelName}:`, error.message);
          throw error;
        }
        
        if (isRecoverable) {
          // Log the error and continue to next model
          console.warn(`Recoverable error with ${modelName} (${statusCode || 'unknown'}): ${error.message}`);
          console.warn(`Falling back to next model in cascade...`);
          continue;
        }
        
        // Unknown error type - be conservative and throw
        console.error(`Unknown error type with ${modelName}:`, error.message);
        throw error;
      }
    }
    
    // If all models failed, provide helpful error message
    console.error('All Gemini models failed. Last error:', lastError);
    throw new Error(
      `Gemini API error: All models in cascade failed. ` +
      `This might be due to API key permissions, model availability, or service issues. ` +
      `Please check your Google AI Studio settings. ` +
      `Last error: ${lastError?.message || 'Unknown error'}`
    );
  }
}

// Export singleton instance
export const aiProvider = new AIProviderService();

