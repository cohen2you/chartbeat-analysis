# Gemini API Integration Guide

This guide provides step-by-step instructions for adding Gemini API support to a Next.js application that currently uses OpenAI, allowing users to switch between providers.

## Quick Overview

The integration uses an abstraction layer (`aiProvider`) that handles both OpenAI and Gemini APIs, with automatic fallbacks and provider-specific configurations.

---

## Step 1: Install Dependencies

```bash
npm install @google/generative-ai
```

No need to uninstall `openai` - both packages work together.

---

## Step 2: Environment Variables

Add to your `.env.local`:

```env
# Existing OpenAI key
OPENAI_API_KEY=your_openai_key_here

# New Gemini key (get from https://aistudio.google.com/apikey)
GEMINI_API_KEY=your_gemini_key_here

# Optional: Set default provider (defaults to 'openai' if both keys exist)
AI_PROVIDER=openai  # or 'gemini'
```

---

## Step 3: Create AI Provider Abstraction Layer

Create `lib/aiProvider.ts`:

```typescript
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

    // Try different model names - gemini-pro (1.0) is deprecated, use 2.5/1.5 models
    const modelNames = options.model ? [options.model] : [
      'gemini-2.5-flash',      // Current standard (fastest/cost-effective)
      'gemini-1.5-flash',      // Legacy compatibility
      'gemini-1.5-pro',        // More capable
      'gemini-1.5-pro-latest', // Latest 1.5 version
    ];
    
    let lastError: any = null;
    
    // Try each model name until one works
    for (const modelName of modelNames) {
      try {
        const model = this.gemini!.getGenerativeModel({
          model: modelName,
          generationConfig,
        });

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.log(`✓ Successfully used Gemini model: ${modelName}`);
        return {
          content: text,
          provider: 'gemini',
        };
      } catch (error: any) {
        lastError = error;
        // If it's a 404 (model not found), try the next model
        if (error.status === 404 || error.message?.includes('not found')) {
          console.log(`Model ${modelName} not found, trying next...`);
          continue;
        }
        // For other errors, throw immediately
        throw error;
      }
    }
    
    // If all models failed, throw the last error
    throw new Error(`Gemini API error: All model attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }
}

// Export singleton instance
export const aiProvider = new AIProviderService();
export type { AIProvider };
```

---

## Step 4: Update Your Existing OpenAI Calls

### Before (Direct OpenAI):

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [
    { role: 'user', content: 'Hello' }
  ],
  response_format: { type: 'json_object' },
  max_tokens: 4096,
});
```

### After (Using aiProvider):

```typescript
import { aiProvider } from '@/lib/aiProvider';

const response = await aiProvider.generateCompletion(
  [
    { role: 'user', content: 'Hello' }
  ],
  {
    model: aiProvider.getCurrentProvider() === 'gemini' 
      ? 'gemini-2.5-flash' 
      : 'gpt-4-turbo-preview',
    responseFormat: { type: 'json_object' },
    // CRITICAL: Provider-specific limits
    maxTokens: aiProvider.getCurrentProvider() === 'gemini' ? 8192 : 4096,
  }
);

const content = response.content; // Use response.content instead of completion.choices[0].message.content
```

---

## Step 5: Add Provider Selection UI (Optional)

### API Route: `app/api/ai-provider/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { aiProvider, AIProvider } from '@/lib/aiProvider';

export async function GET() {
  try {
    return NextResponse.json({
      provider: aiProvider.getCurrentProvider(),
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasGemini: !!process.env.GEMINI_API_KEY,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get AI provider' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body;
    
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      aiProvider.setProvider(provider);
      return NextResponse.json({
        success: true,
        provider: aiProvider.getCurrentProvider(),
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "openai" or "gemini"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to set AI provider' },
      { status: 500 }
    );
  }
}
```

### Frontend Component:

```typescript
'use client';

import { useState, useEffect } from 'react';

export function AIProviderSelector() {
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [available, setAvailable] = useState({ openai: false, gemini: false });

  useEffect(() => {
    fetch('/api/ai-provider')
      .then(res => res.json())
      .then(data => {
        setProvider(data.provider);
        setAvailable({ openai: data.hasOpenAI, gemini: data.hasGemini });
      });
  }, []);

  const handleChange = async (newProvider: 'openai' | 'gemini') => {
    try {
      const res = await fetch('/api/ai-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider }),
      });
      const data = await res.json();
      if (data.success) {
        setProvider(newProvider);
      }
    } catch (error) {
      console.error('Failed to set provider:', error);
    }
  };

  return (
    <select
      value={provider}
      onChange={(e) => handleChange(e.target.value as 'openai' | 'gemini')}
      className="px-3 py-2 border rounded"
    >
      {available.openai && <option value="openai">OpenAI (GPT-4)</option>}
      {available.gemini && <option value="gemini">Gemini (2.5 Flash)</option>}
    </select>
  );
}
```

---

## Step 6: Update API Routes to Pass Provider

In your API routes, accept and pass the provider:

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, provider } = body;
    
    // Set provider if specified (with error handling)
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      try {
        aiProvider.setProvider(provider as AIProvider);
      } catch (error: any) {
        console.warn(`Provider ${provider} not available, using default:`, error.message);
      }
    }

    // Use aiProvider.generateCompletion instead of direct OpenAI calls
    const response = await aiProvider.generateCompletion(
      messages,
      {
        model: aiProvider.getCurrentProvider() === 'gemini' 
          ? 'gemini-2.5-flash' 
          : 'gpt-4-turbo-preview',
        responseFormat: { type: 'json_object' },
        maxTokens: aiProvider.getCurrentProvider() === 'gemini' ? 8192 : 4096,
      }
    );

    // ... rest of your code
  } catch (error) {
    // ... error handling
  }
}
```

---

## Step 7: Handle JSON Parsing (Important!)

Gemini sometimes returns extra text or markdown. Add robust JSON cleaning:

```typescript
// After getting response.content from aiProvider
let cleanContent = response.content.trim();

// Remove markdown code blocks
cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

// Try to find JSON object if wrapped in other text
const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  cleanContent = jsonMatch[0];
}

// SAFETY TRUNCATION: Find the last closing bracket "}" and ignore everything after it
// This prevents parsing errors when the model adds extra text after valid JSON
const lastBracketIndex = cleanContent.lastIndexOf('}');
if (lastBracketIndex !== -1) {
  cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
}

// Now parse
const result = JSON.parse(cleanContent);
```

---

## Critical Configuration Notes

### Token Limits (IMPORTANT!)

- **OpenAI**: Maximum 4096 completion tokens for `gpt-4-turbo-preview`
- **Gemini**: Supports 8192+ tokens (use 8192 as default)

**Always use provider-specific limits:**

```typescript
maxTokens: aiProvider.getCurrentProvider() === 'gemini' ? 8192 : 4096
```

### Model Names

- **OpenAI**: `gpt-4-turbo-preview` (or your preferred model)
- **Gemini**: `gemini-2.5-flash` (recommended), `gemini-1.5-pro`, `gemini-1.5-flash`

### JSON Mode

Both providers support JSON mode:
- **OpenAI**: `response_format: { type: 'json_object' }`
- **Gemini**: `generationConfig.responseMimeType = 'application/json'`

The `aiProvider` abstraction handles this automatically.

---

## Common Issues & Solutions

### Issue 1: "max_tokens is too large: 8192"
**Solution**: OpenAI has a 4096 token limit. Always use provider-specific limits (see Step 6).

### Issue 2: "Unterminated string in JSON"
**Solution**: Increase `maxOutputTokens` to 8192 for Gemini, and implement JSON cleaning (see Step 7).

### Issue 3: "Model not found" (404 error)
**Solution**: The code automatically tries fallback models. Ensure you're using `gemini-2.5-flash` or another supported model name.

### Issue 4: JSON parsing fails with extra text
**Solution**: Implement the JSON cleaning logic from Step 7.

---

## Testing Checklist

- [ ] Install `@google/generative-ai` package
- [ ] Add `GEMINI_API_KEY` to `.env.local`
- [ ] Create `lib/aiProvider.ts` with the full code
- [ ] Update all OpenAI calls to use `aiProvider.generateCompletion`
- [ ] Use provider-specific token limits (4096 for OpenAI, 8192 for Gemini)
- [ ] Add JSON cleaning logic for Gemini responses
- [ ] Test with both providers
- [ ] Verify fallback works when one provider fails

---

## Quick Migration Checklist

For each file that uses OpenAI:

1. Replace `import OpenAI from 'openai'` with `import { aiProvider } from '@/lib/aiProvider'`
2. Replace `openai.chat.completions.create(...)` with `aiProvider.generateCompletion(...)`
3. Update message format (already compatible)
4. Add provider-specific `maxTokens` based on current provider
5. Update response handling: `response.content` instead of `completion.choices[0].message.content`
6. Add JSON cleaning logic if parsing JSON responses

---

## Summary

The key points to remember:

1. **Token Limits**: OpenAI = 4096, Gemini = 8192
2. **Model Names**: Use `gemini-2.5-flash` for Gemini
3. **JSON Cleaning**: Always clean Gemini responses before parsing
4. **Provider Selection**: Use `aiProvider.getCurrentProvider()` to determine limits
5. **Error Handling**: The abstraction layer handles fallbacks automatically

This integration allows seamless switching between providers while maintaining compatibility with existing code.




