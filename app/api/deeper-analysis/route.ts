import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, getDataSummary } from '@/lib/csvParser';
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

    // Extract article titles and dates for deeper analysis - include ALL articles, not just top performers
    // Filter out articles with 1 or fewer page views
    const articleDetails = parsedDataArray.flatMap((data, datasetIdx) => {
      return data.data
        .map((row: any) => ({
          title: row.title || row.Title || '',
          author: row.author || row.Author || 'Unknown',
          publish_date: row.publish_date || row.publish_date || '',
          page_views: Number(row.page_views || row['page_views'] || 0),
          page_uniques: Number(row.page_uniques || row['page_uniques'] || 0),
          page_views_quality: Number(row.page_views_quality || row['page_views_quality'] || 0),
          dataset: parsedDataArray.length > 1 ? `Dataset ${datasetIdx + 1}${data.fileName ? ` (${data.fileName})` : ''}` : null,
        }))
        .filter((article: any) => article.title && article.title.trim() !== '')
        .filter((article: any) => article.page_views > 1); // Exclude articles with 1 or fewer views
    });

    // Sort by views and create comprehensive lists
    const sortedArticles = articleDetails.sort((a, b) => b.page_views - a.page_views);
    const totalArticles = sortedArticles.length;
    const avgViews = sortedArticles.reduce((sum, a) => sum + a.page_views, 0) / totalArticles;
    
    // Categorize articles by performance tiers
    const topTier = sortedArticles.slice(0, Math.floor(totalArticles * 0.2)); // Top 20%
    const midTier = sortedArticles.slice(Math.floor(totalArticles * 0.2), Math.floor(totalArticles * 0.8)); // Middle 60%
    const bottomTier = sortedArticles.slice(Math.floor(totalArticles * 0.8)); // Bottom 20%

    // Include more articles for better examples
    const articlesList = `Total Articles: ${totalArticles}
Average Views: ${Math.round(avgViews).toLocaleString()}

TOP 20% (${topTier.length} articles - showing top 30 for examples):
${topTier.slice(0, 30).map((article: any, idx: number) => 
  `${idx + 1}. "${article.title}" by ${article.author} | ${article.publish_date} | ${article.page_views.toLocaleString()} views`
).join('\n')}

MIDDLE 60% (${midTier.length} articles - showing 25 examples):
${midTier.filter((_: any, idx: number) => idx % Math.max(1, Math.floor(midTier.length / 25)) === 0).slice(0, 25).map((article: any, idx: number) => 
  `${idx + 1}. "${article.title}" by ${article.author} | ${article.publish_date} | ${article.page_views.toLocaleString()} views`
).join('\n')}

BOTTOM 20% (${bottomTier.length} articles - showing 15 examples):
${bottomTier.filter((_: any, idx: number) => idx % Math.max(1, Math.floor(bottomTier.length / 15)) === 0).slice(0, 15).map((article: any, idx: number) => 
  `${idx + 1}. "${article.title}" by ${article.author} | ${article.publish_date} | ${article.page_views.toLocaleString()} views`
).join('\n')}`;

    const prompt = `You are a content strategy analyst helping an editor understand what makes content successful through deep analysis of article titles, subjects, and publication patterns.

Analyze the following Chartbeat analytics data with a focus on SPECIFIC EXAMPLES of successful stories, not just general patterns.

CRITICAL REQUIREMENTS:
- Provide MANY specific examples of successful articles with their FULL titles and exact view counts
- Show examples from different performance levels (top performers, mid-tier, etc.)
- Include at least 10-15 specific article examples in each section
- For each example, include: full article title, exact view count, publish date, and what made it successful
- Format ALL responses as BULLET POINTS (use • for each point)
- Include specific numbers, percentages, and dates
- ONLY reference fields/metrics that actually exist in the data
- Don't just describe patterns - SHOW specific examples

For your analysis, provide specific examples:

1. TITLE ANALYSIS:
   - Show 10-15 specific examples of successful titles with their view counts
   - For each example, include: full title, views, and what about the title structure made it successful
   - Show examples of different title formats that worked (questions, statements, lists, etc.)
   - Include examples of titles with specific keywords/phrases that performed well
   - Show title length examples - which lengths worked best with specific examples
   - Compare successful vs unsuccessful titles with specific examples side-by-side

2. SUBJECT MATTER ANALYSIS:
   - Show 10-15 specific examples of successful articles by topic/subject
   - For each example, include: full title, views, topic/subject, and why it resonated
   - List specific companies, industries, or themes that drove traffic with article examples
   - Show examples of content types (news, analysis, opinion) that performed well
   - Include specific article examples that demonstrate what topics work vs don't work

3. TEMPORAL PATTERNS:
   - Show specific examples of articles that performed well on different days of the week
   - Include examples of articles published at different times (early month, mid-month, end of month) with their performance
   - Show specific article examples that demonstrate temporal patterns
   - Include dates and view counts for examples

4. CONTENT STRATEGY INSIGHTS:
   - Provide specific article examples that demonstrate successful combinations (topic + title + timing)
   - Show examples of articles to replicate (with full titles and view counts)
   - Show examples of articles to avoid (with full titles and view counts)
   - Include at least 5-10 specific article recommendations with titles and why they should be replicated

Data Summary:
${summaries}

Top Articles for Analysis:
${articlesList}

CRITICAL: Each field MUST be a plain text string formatted as BULLET POINTS. Use • for each bullet point. Do NOT use objects, arrays, or nested structures. Include MANY specific article examples with full titles and view counts.

Please format your response as JSON with this structure:
{
  "titleAnalysis": "Detailed analysis with 10-15 SPECIFIC article examples. Format as bullet points (use • for each point). For each example, include: full article title, exact view count, and what about the title made it successful. Show different title formats, keywords, and structures that worked. Include specific examples of successful vs unsuccessful titles.",
  "subjectAnalysis": "Deep dive with 10-15 SPECIFIC article examples by topic/subject. Format as bullet points (use • for each point). For each example, include: full article title, exact view count, topic/subject, and why it resonated. List specific companies, industries, or themes with article examples. Show what topics work vs don't work with specific examples.",
  "temporalAnalysis": "Analysis with SPECIFIC article examples showing temporal patterns. Format as bullet points (use • for each point). Include examples of articles that performed well on different days, at different times of month, with their full titles, view counts, and publish dates. Show patterns with specific examples.",
  "strategicInsights": "Actionable recommendations with 5-10 SPECIFIC article examples to replicate. Format as bullet points (use • for each point). Include full article titles and view counts for examples. Show specific articles that demonstrate successful combinations. List articles to replicate and articles to avoid, with titles and view counts."
}`;

    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a content strategy analyst specializing in editorial content performance. You analyze article titles, subjects, and publication patterns to provide actionable insights. Always respond with valid JSON. CRITICAL: Each field in the JSON response must be a STRING (plain text), NOT an object or nested structure. Format all analysis as paragraphs of text.',
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
      console.error('First 500 chars:', cleanContent.substring(0, 500));
      console.error('Last 500 chars:', cleanContent.substring(Math.max(0, cleanContent.length - 500)));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    return NextResponse.json({
      success: true,
      deeperAnalysis: result,
    });
  } catch (error: any) {
    console.error('Deeper analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate deeper analysis' },
      { status: 500 }
    );
  }
}

