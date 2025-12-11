import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, generateStatsByAuthor } from '@/lib/csvParser';
import { aiProvider, AIProvider } from '@/lib/aiProvider';
import { repairTruncatedJSON } from '@/lib/openai';

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

Analyze the following two datasets and provide a STRATEGIC COMPARISON focusing on key differences and highlights between the datasets.

CRITICAL REQUIREMENTS:
- For EACH author that appears in either dataset, provide EXACTLY 2-3 bullet points comparing their performance
- Each bullet point should highlight a key insight, change, or comparison between Dataset 1 and Dataset 2
- Include specific numbers and percentages to support each insight
- Focus on the most significant changes and patterns
- If an author only appears in one dataset, note that in 1 bullet point
- Keep bullet points concise and actionable

For your analysis, provide:

1. Author-by-Author Comparison:
   - An array where each author gets exactly 2-3 bullet points
   - Each bullet should compare Dataset 1 vs Dataset 2 with specific numbers
   - Highlight the most important changes (views, articles, averages, etc.)
   - Example format: "• Total views increased 44.8% (912K → 1.32M) despite 18% fewer articles"
   - Focus on insights, not raw data dumps

2. Overall Comparison Summary:
   - 3-5 bullet points summarizing key trends across all authors
   - Total views comparison
   - Average performance changes
   - Notable patterns or shifts

3. Key Differences:
   - 3-5 bullet points highlighting the most significant differences between datasets
   - Which authors improved/declined most?
   - What patterns emerged?

Data:
${summaries}

Please format your response as JSON with this structure:
{
  "authorComparisons": [
    {
      "author": "Author Name",
      "bullets": [
        "• First key insight with specific numbers comparing Dataset 1 to Dataset 2",
        "• Second key insight with specific numbers",
        "• Third key insight (if significant)"
      ]
    }
  ],
  "overallSummary": [
    "• First overall insight",
    "• Second overall insight",
    "• Third overall insight"
  ],
  "keyDifferences": [
    "• First key difference",
    "• Second key difference",
    "• Third key difference"
  ]
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

    // Clean and repair the response
    let cleanContent = response.content.trim();
    
    // Remove markdown code blocks
    cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    
    // Try to find JSON object if wrapped in other text
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }
    
    // Find the last closing bracket and truncate after it
    const lastBracketIndex = cleanContent.lastIndexOf('}');
    if (lastBracketIndex !== -1) {
      cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
    }
    
    // Repair truncated JSON
    cleanContent = repairTruncatedJSON(cleanContent);

    let result;
    try {
      result = JSON.parse(cleanContent);
    } catch (parseError: any) {
      console.error('JSON Parse Error. Cleaned content length:', cleanContent.length);
      console.error('Parse error at position:', parseError.message);
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    return NextResponse.json({
      success: true,
      comparison: result,
    });
  } catch (error: any) {
    console.error('Comparison error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate comparison' },
      { status: 500 }
    );
  }
}

