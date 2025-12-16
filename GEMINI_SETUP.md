# Gemini API Integration Guide

This app now supports both OpenAI and Gemini APIs for analysis. You can easily switch between them to compare outputs.

## Setup

1. **Add your Gemini API key to `.env.local`:**
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **Choose your AI provider:**
   
   **Option A: Use environment variable (recommended)**
   Add to `.env.local`:
   ```
   AI_PROVIDER=gemini
   ```
   or
   ```
   AI_PROVIDER=openai
   ```
   
   **Option B: Automatic selection**
   - If only `GEMINI_API_KEY` is set → uses Gemini
   - If only `OPENAI_API_KEY` is set → uses OpenAI
   - If both are set → defaults to OpenAI (unless `AI_PROVIDER` is set)

## Testing

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Check which provider is active:**
   - Look at the top-right corner of the app - it will show "AI: Gemini" or "AI: OpenAI"

3. **Run the same analysis with both providers:**
   - Upload your CSV file(s)
   - Run an analysis with one provider
   - Change `AI_PROVIDER` in `.env.local` to switch
   - Restart the dev server
   - Run the same analysis again
   - Compare the outputs

## What's Different?

The app uses a unified AI provider interface (`lib/aiProvider.ts`) that:
- Automatically routes all API calls to the selected provider
- Handles the differences between OpenAI and Gemini APIs
- Supports JSON mode for structured responses
- Provides consistent error handling

All analysis endpoints now support both providers:
- `/api/analyze` - Team data analysis
- `/api/analyze-writer` - Single writer analysis
- `/api/recommendations` - Content recommendations
- `/api/writer-feedback` - Writer feedback emails
- `/api/deeper-analysis` - Deeper analysis
- `/api/deeper-analysis-writer` - Writer deeper analysis
- `/api/compare-writer-periods` - Period comparison
- `/api/comparison` - Dataset comparison

## Notes

- The Gemini implementation uses `gemini-pro` model
- JSON mode is supported for structured responses
- Temperature and max tokens settings are preserved across providers
- The UI indicator shows which provider is currently active




