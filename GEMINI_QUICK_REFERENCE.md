# Gemini Integration - Quick Reference

## Installation
```bash
npm install @google/generative-ai
```

## Environment Variables
```env
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key  # Get from https://aistudio.google.com/apikey
AI_PROVIDER=openai  # Optional: 'openai' or 'gemini'
```

## Key Differences

| Feature | OpenAI | Gemini |
|---------|--------|--------|
| Max Tokens | 4096 | 8192 |
| Model Name | `gpt-4-turbo-preview` | `gemini-2.5-flash` |
| JSON Mode | `response_format: { type: 'json_object' }` | `responseMimeType: 'application/json'` |
| System Messages | Supported | Converted to prompt prefix |

## Code Pattern

```typescript
import { aiProvider } from '@/lib/aiProvider';

const currentProvider = aiProvider.getCurrentProvider();
const response = await aiProvider.generateCompletion(
  messages,
  {
    model: currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4-turbo-preview',
    responseFormat: { type: 'json_object' },
    maxTokens: currentProvider === 'gemini' ? 8192 : 4096, // CRITICAL!
  }
);

// Clean JSON response (especially for Gemini)
let cleanContent = response.content.trim();
cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
if (jsonMatch) cleanContent = jsonMatch[0];
const lastBracketIndex = cleanContent.lastIndexOf('}');
if (lastBracketIndex !== -1) {
  cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
}
const result = JSON.parse(cleanContent);
```

## Common Mistakes to Avoid

❌ **Don't**: Use `maxTokens: 8192` for OpenAI  
✅ **Do**: Use provider-specific limits

❌ **Don't**: Parse JSON directly from Gemini response  
✅ **Do**: Clean the response first (remove markdown, truncate extra text)

❌ **Don't**: Use `gemini-pro` (deprecated)  
✅ **Do**: Use `gemini-2.5-flash` or `gemini-1.5-pro`

## Files to Create/Update

1. **Create**: `lib/aiProvider.ts` (copy from full guide)
2. **Update**: All files using OpenAI → use `aiProvider.generateCompletion`
3. **Update**: API routes → accept `provider` parameter and pass to `aiProvider.setProvider()`
4. **Optional**: Add UI selector using `/api/ai-provider` route

## Testing

```typescript
// Test OpenAI
aiProvider.setProvider('openai');
const openaiResult = await aiProvider.generateCompletion([...], {...});

// Test Gemini
aiProvider.setProvider('gemini');
const geminiResult = await aiProvider.generateCompletion([...], {...});
```




