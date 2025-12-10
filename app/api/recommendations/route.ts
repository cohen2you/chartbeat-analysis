import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, getDataSummary } from '@/lib/csvParser';
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

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return NextResponse.json(
        { error: 'Please provide at least one CSV data string' },
        { status: 400 }
      );
    }

    // Parse all CSV data
    const parsedDataArray = csvData.map((csv: string, idx: number) => 
      parseCSV(csv, fileNames?.[idx])
    );

    // Generate summaries
    const summaries = parsedDataArray.map((data, idx) => {
      const summary = getDataSummary(data);
      return parsedDataArray.length === 1 
        ? summary 
        : `Dataset ${idx + 1}${data.fileName ? ` (${data.fileName})` : ''}:\n${summary}`;
    }).join('\n\n---\n\n');

    const prompt = `You are a content strategy analyst helping an editor improve content performance through data-driven insights.

Analyze the following Chartbeat analytics data and provide SPECIFIC, ACTIONABLE recommendations based on actual article, headline, and author performance.

CRITICAL REQUIREMENTS:
- Focus on SPECIFIC article examples with exact view counts
- Analyze headline/title patterns that correlate with high views
- Compare author performance (views per article, consistency)
- Provide concrete, actionable ideas for improvement
- Use exact numbers, percentages, article titles, and author names
- ONLY reference fields/metrics that actually exist in the data
- Do NOT mention fields that don't exist (check the "Columns:" line in the data summary)

For your analysis, focus on:
1. VIEWS PER POST ANALYSIS:
   - Which specific articles achieved the highest views? (list 5-10 with exact titles and view counts)
   - Which articles performed poorly? (list 5-10 with exact titles and view counts)
   - What's the average views per article? Which articles are above/below average?
   - Identify specific view count thresholds (e.g., "Articles with X+ views tend to...")

2. HEADLINE/TITLE ANALYSIS:
   - What headline patterns appear in high-performing articles? (show specific examples)
   - What headline patterns appear in low-performing articles? (show specific examples)
   - Compare headline structures, keywords, length between successful and unsuccessful articles
   - Provide specific headline improvement ideas based on what worked

3. AUTHOR PERFORMANCE ANALYSIS:
   - Which authors have the highest average views per article? (with specific numbers)
   - Which authors are most consistent? Which have high variance?
   - Compare author performance - what do top authors do differently?
   - Provide specific recommendations for each author based on their performance

4. SPECIFIC IMPROVEMENT IDEAS:
   - Based on top performers, what specific topics/themes should be covered more?
   - Based on headline analysis, what headline formulas should be used?
   - Based on author performance, what strategies should authors adopt?
   - What specific articles should be used as templates? (list with titles and view counts)

IMPORTANT: Only reference metrics that are actually present in the data. If a column is missing (like quality views, uniques, avg time, sections, referrers), do NOT mention it. Focus only on page views and what you can learn from article titles, authors, and dates.

Provide 5-7 specific, actionable recommendations that:
- Reference specific articles by full title with exact view counts
- Compare headline patterns with concrete examples
- Analyze author performance with specific numbers (views per article, consistency)
- Provide concrete improvement ideas based on what actually worked
- Include specific article examples to replicate (with titles and view counts)
- Include specific article examples to avoid (with titles and view counts)
- Give actionable headline strategies based on successful examples
- Give actionable author strategies based on performance data
- ONLY reference fields and metrics that exist in the data

Data Analysis:
${summaries}

CRITICAL: Before making recommendations:
1. Check the "Columns:" line in the data summary to see which fields exist
2. Only reference fields that are present (e.g., if only page_views exists, focus on views per article, headline patterns, author performance)
3. Do NOT mention quality views, uniques, avg time, sections, or referrers if those columns don't exist
4. Do NOT suggest improving tracking for missing fields
5. Focus on SPECIFIC article examples with exact view counts
6. Provide concrete headline and author performance insights

Please format your response as JSON with this structure:
{
  "recommendations": [
    "Specific recommendation with article title, exact view count, and actionable insight (e.g., 'Article X by Author Y achieved 5,234 views. Replicate its headline structure: [specific pattern]')",
    "Author performance insight with specific numbers (e.g., 'Author Z averages 2,100 views per article vs site average of 1,500. Their successful articles use [specific pattern]')",
    "Headline improvement idea with examples (e.g., 'Headlines with [pattern] average 3,200 views vs 800 views for [other pattern]. Examples: Article A (3,450 views), Article B (3,100 views)')",
    "More specific recommendations with article examples..."
  ]
}`;

    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a content strategy analyst specializing in improving article performance. Always respond with valid JSON. Focus on SPECIFIC article examples, headline patterns, and author performance. Provide concrete, actionable recommendations with exact view counts and article titles. Only reference fields that exist in the data.',
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
      recommendations: result.recommendations || [],
    });
  } catch (error: any) {
    console.error('Recommendations error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

