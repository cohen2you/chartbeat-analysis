/**
 * AI Provider Abstraction Layer
 * 
 * This file provides a unified interface for OpenAI and Gemini APIs.
 * Copy this entire file to your project as `lib/aiProvider.ts`
 * 
 * Usage:
 *   import { aiProvider } from '@/lib/aiProvider';
 *   const response = await aiProvider.generateCompletion(messages, options);
 */

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
  responseFormat?: { type: 'text' | 'json_object' };
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

    // Convert messages to Gemini format (Gemini doesn't support system messages)
    // Combine system messages into the first user message
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    let prompt = '';
    if (systemMessages.length > 0) {
      prompt = systemMessages.map(m => m.content).join('\n\n') + '\n\n';
    }
    
    // Combine user/assistant messages into a single prompt
    // Gemini works best with a single prompt string
    const conversation = nonSystemMessages.map(msg => {
      if (msg.role === 'user') {
        return `User: ${msg.content}`;
      } else {
        return `Assistant: ${msg.content}`;
      }
    }).join('\n\n');
    
    prompt += conversation;

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

    // Model Cascading (Waterfall) Strategy - Production Best Practice
    // Primary: gemini-3-pro-preview (Smartest, most fragile)
    // Secondary: gemini-2.5-pro (Stable, high intelligence)
    // Safety Net: gemini-2.5-flash (Fastest, highest rate limits, cheapest)
    // This ensures high availability - if one model fails, automatically try the next
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
        
        const model = this.gemini!.getGenerativeModel({
          model: modelName,
          generationConfig,
        });

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        console.log(`Gemini response length: ${text.length} characters`);
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
        // If Gemini refuses a prompt due to safety policy, switching models won't help
        // Retrying these requests just wastes quota and latency
        const isNonRecoverable = error.message?.includes('safety') ||
                                 error.message?.includes('blocked') ||
                                 error.message?.includes('content policy') ||
                                 error.message?.includes('harmful') ||
                                 statusCode === 400; // Bad Request (usually prompt issues)
        
        if (isNonRecoverable) {
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
    throw new Error(
      `Gemini API error: All models in cascade failed. ` +
      `This might be due to API key permissions, model availability, or service issues. ` +
      `Last error: ${lastError?.message || 'Unknown error'}`
    );
  }
}

// Export singleton instance
export const aiProvider = new AIProviderService();
// AIProvider type is already exported above on line 15


