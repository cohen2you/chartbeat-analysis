import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, generateStatsByAuthor } from '@/lib/csvParser';
import { aiProvider, AIProvider } from '@/lib/aiProvider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, fileNames, provider } = body;
    
    // Set provider if specified (with error handling)
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      try {
        aiProvider.setProvider(provider as AIProvider);
      } catch (error: any) {
        console.warn(`Provider ${provider} not available, using default:`, error.message);
      }
    }

    if (!csvData || !Array.isArray(csvData) || csvData.length !== 2) {
      return NextResponse.json(
        { error: 'Please provide exactly 2 CSV data strings for comparison' },
        { status: 400 }
      );
    }

    // Parse both CSV files
    const parsedDataArray = csvData.map((csv: string, idx: number) => 
      parseCSV(csv, fileNames?.[idx])
    );

    // Generate individual stats for each dataset
    const dataset1Stats = generateStatsByAuthor(parsedDataArray[0]);
    const dataset2Stats = generateStatsByAuthor(parsedDataArray[1]);

    // Get data summaries for AI analysis
    const summaries = parsedDataArray.map((data, idx) => {
      const summary = generateStatsByAuthor(data);
      return `Dataset ${idx + 1}${data.fileName ? ` (${data.fileName})` : ''}:\n${summary}`;
    }).join('\n\n---\n\n');

    const prompt = `You are a data analyst helping an editor compare two Chartbeat analytics datasets.

Analyze the following two datasets and provide a DETAILED COMPARISON focusing on differences, changes, and patterns between the datasets.

CRITICAL REQUIREMENTS:
- Compare performance for EACH author that appears in either dataset
- Show specific numbers, percentages, and changes between Dataset 1 and Dataset 2
- Highlight increases, decreases, and trends
- Use exact numbers from the data
- ONLY reference fields/metrics that actually exist in the data
- Format as bullet points for readability

For your analysis, provide:

1. Author-by-Author Comparison:
   - For EACH author, compare their performance between Dataset 1 and Dataset 2
   - Include: total articles, total views, average views per article, best/worst articles
   - Show percentage changes (e.g., "Author X: 15.2% increase in views from Dataset 1 to Dataset 2")
   - Highlight significant changes or patterns
   - If an author only appears in one dataset, note that

2. Overall Comparison Summary:
   - Total views comparison
   - Average performance changes
   - Key differences in top performers
   - Notable trends or shifts between datasets

3. Key Differences:
   - What changed between the two datasets?
   - Which authors improved/declined?
   - What patterns emerged?

Data:
${summaries}

Please format your response as JSON with this structure:
{
  "authorComparisons": "Detailed author-by-author comparison. For EACH author, show their stats from Dataset 1 vs Dataset 2 with specific numbers and percentage changes. Format as bullet points.",
  "overallSummary": "Overall comparison summary with key metrics and changes between datasets. Format as bullet points.",
  "keyDifferences": "Key differences and notable changes between the two datasets. Format as bullet points."
}`;

    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a data analyst specializing in comparing datasets. Always respond with valid JSON. Format all responses as bullet points for clarity.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      {
        model: aiProvider.getCurrentProvider() === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4-turbo-preview',
        responseFormat: { type: 'json_object' },
        temperature: 0.7,
        // Provider-specific limits: OpenAI max 4096, Gemini max 8192
        maxTokens: aiProvider.getCurrentProvider() === 'gemini' ? 8192 : 4096,
      }
    );

    const content = response.content;

    const result = JSON.parse(content);
    return NextResponse.json({
      success: true,
      comparison: result,
      dataset1Stats,
      dataset2Stats,
    });
  } catch (error: any) {
    console.error('Comparison error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate comparison' },
      { status: 500 }
    );
  }
}

