import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, generateSingleWriterData } from '@/lib/csvParser';
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

    // Parse all CSV data and combine
    const parsedDataArray = csvData.map((csv: string, idx: number) => 
      parseCSV(csv, fileNames?.[idx])
    );

    const combinedData = {
      data: parsedDataArray.flatMap(d => d.data),
      headers: parsedDataArray[0]?.headers || [],
      fileName: parsedDataArray.map(d => d.fileName).filter(Boolean).join(', ') || undefined,
    };

    // Detect writer name
    const authorMap = new Map<string, number>();
    combinedData.data.forEach((row: any) => {
      const author = (row.author || row.Author || '').trim();
      if (author && author !== 'Unknown') {
        authorMap.set(author, (authorMap.get(author) || 0) + 1);
      }
    });
    const authors = Array.from(authorMap.entries()).sort((a, b) => b[1] - a[1]);
    const writerName = authors.length > 0 ? authors[0][0] : 'Unknown';

    // Generate writer data
    const writerData = generateSingleWriterData(combinedData, writerName);

    // Extract detailed article data for analysis
    const { data, headers } = combinedData;
    const hasTitleField = headers.some(h => h.toLowerCase() === 'title');
    const hasSectionField = headers.some(h => h.toLowerCase() === 'section');
    
    // Deduplicate and extract articles
    const articleMap = new Map<string, any>();
    const filteredData = data.filter((row: any) => {
      const views = Number(row.page_views || row['page_views'] || 0);
      const author = (row.author || row.Author || '').trim();
      return views > 1 && author.toLowerCase() === writerName.toLowerCase();
    });

    filteredData.forEach((row, index) => {
      const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
      const publishDate = row.publish_date || row.publish_date || '';
      
      if (hasTitleField && !title) return;
      
      let articleKey: string;
      if (title) {
        articleKey = title;
      } else if (publishDate) {
        articleKey = `${publishDate}_${writerName}`;
      } else {
        articleKey = `article_${index}_${writerName}`;
      }
      
      if (!articleMap.has(articleKey)) {
        const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
        const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
        
        articleMap.set(articleKey, {
          title: title || `Article from ${publishDate || 'Unknown Date'}`,
          publish_date: publishDate,
          page_views: views,
          section: row.section || row.Section || 'Unknown',
        });
      }
    });

    const articles = Array.from(articleMap.values())
      .sort((a, b) => b.page_views - a.page_views);

    // Calculate views per post metrics
    const viewsPerPost = articles.map(a => a.page_views);
    const avgViewsPerPost = viewsPerPost.reduce((a, b) => a + b, 0) / viewsPerPost.length;
    const medianViewsPerPost = viewsPerPost.sort((a, b) => a - b)[Math.floor(viewsPerPost.length / 2)];
    const topQuartile = viewsPerPost[Math.floor(viewsPerPost.length * 0.25)];
    const bottomQuartile = viewsPerPost[Math.floor(viewsPerPost.length * 0.75)];

    // Create detailed article list for analysis
    const articleDetails = articles.map((article, idx) => ({
      rank: idx + 1,
      title: article.title,
      views: article.page_views,
      viewsPerPost: article.page_views,
      publishDate: article.publish_date,
      section: article.section,
      percentile: idx < viewsPerPost.length * 0.1 ? 'top10' : idx < viewsPerPost.length * 0.25 ? 'top25' : idx < viewsPerPost.length * 0.5 ? 'top50' : idx < viewsPerPost.length * 0.75 ? 'bottom25' : 'bottom10',
    }));

    const topPerformers = articleDetails.filter(a => a.percentile === 'top10' || a.percentile === 'top25').slice(0, 15);
    const bottomPerformers = articleDetails.filter(a => a.percentile === 'bottom10' || a.percentile === 'bottom25').slice(-15);

    const prompt = `You are a content performance analyst providing deep, actionable insights for a single writer based on their Chartbeat analytics data.

Analyze the following writer's performance data and provide SPECIFIC, DATA-DRIVEN insights focused on identifying what works and what doesn't work for THIS WRITER.

CRITICAL REQUIREMENTS:
- EVERY insight MUST include specific numbers, percentages, and article titles
- Focus on VIEWS PER POST metrics and patterns
- Compare top performers vs bottom performers to identify success factors
- Provide ACTIONABLE recommendations based on actual data patterns
- Use exact numbers from the data (e.g., "6,639 views per post", "15.2% above average")
- Mention specific article titles in your analysis
- Calculate and include percentages, quartiles, and statistical comparisons
- ONLY reference fields/metrics that actually exist in the data

WRITER PERFORMANCE METRICS:
- Total Articles: ${articles.length}
- Average Views per Post: ${Math.round(avgViewsPerPost).toLocaleString()}
- Median Views per Post: ${Math.round(medianViewsPerPost).toLocaleString()}
- Top Quartile Threshold: ${Math.round(topQuartile).toLocaleString()} views
- Bottom Quartile Threshold: ${Math.round(bottomQuartile).toLocaleString()} views

TOP PERFORMING ARTICLES (${topPerformers.length} examples):
${topPerformers.map(a => `${a.rank}. "${a.title}" - ${a.views.toLocaleString()} views (${a.publishDate || 'N/A'})`).join('\n')}

BOTTOM PERFORMING ARTICLES (${bottomPerformers.length} examples):
${bottomPerformers.map(a => `${a.rank}. "${a.title}" - ${a.views.toLocaleString()} views (${a.publishDate || 'N/A'})`).join('\n')}

FULL WRITER DATA:
${writerData}

Analyze this data and provide:

1. Views Per Post Performance Analysis:
   - Distribution analysis: How consistent is their performance? What's the spread?
   - Performance tiers: How many articles fall into top/bottom quartiles?
   - Success rate: What percentage of articles exceed their average? What percentage fall below?
   - Specific examples: List 5-7 top performers with exact views per post and what made them successful
   - Underperformers: List 5-7 bottom performers with exact views per post and why they underperformed
   - Comparison: What's the difference between their best and worst? (e.g., "Top article had X views vs worst with Y views - a Zx difference")

2. Content Strategy Insights:
   - Title patterns: What do successful titles have in common? Compare top 5 vs bottom 5 titles
   - Content types: What types of articles perform best? (earnings, personalities, lists, breaking news, etc.)
   - Section performance: Which sections/topics drive the most views per post? (if section data available)
   - Timing patterns: Do certain publish dates/times correlate with higher views per post? (if date data available)
   - Specific recommendations: "Write more articles like [specific top performer title] which achieved X views per post"

3. Performance Trends & Patterns:
   - Consistency analysis: Is performance improving, declining, or stable over time?
   - Peak performance periods: When did they publish their best articles? What was different?
   - Low performance periods: When did they publish worst articles? What patterns emerge?
   - Views per post trajectory: Show specific examples of articles over time with their views per post

4. Actionable Recommendations:
   - Replicate success: List 3-5 specific articles to use as templates (with titles and views per post)
   - Avoid patterns: List 3-5 specific articles to avoid replicating (with titles and views per post)
   - Target metrics: What should their target views per post be based on their data? (e.g., "Aim for X views per post based on top quartile performance")
   - Content strategy: Specific recommendations like "Focus on [content type] which averages X views per post vs [other type] at Y views per post"
   - Improvement opportunities: What would happen if bottom quartile articles performed at median? Show the math.

Please format your response as JSON with this structure:
{
  "viewsPerPostAnalysis": "Detailed analysis of views per post distribution, consistency, success rate, with specific examples of top and bottom performers. Include exact numbers, percentages, and article titles. Format as bullet points (use • for each point).",
  "contentStrategyInsights": "Analysis of what content types, title patterns, sections, and timing drive success. Compare top vs bottom performers. Include specific article examples with titles and views per post. Format as bullet points.",
  "performanceTrends": "Analysis of performance over time, consistency, peak/valley periods. Include specific examples with dates and views per post. Format as bullet points.",
  "actionableRecommendations": "Specific, actionable recommendations with article examples to replicate or avoid. Include target metrics and improvement opportunities with calculations. Format as bullet points."
}`;

    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a content performance analyst specializing in identifying what makes articles successful. You provide data-driven, actionable insights with specific examples and metrics. Always respond with valid JSON. CRITICAL: Each field must be a STRING (plain text), NOT an object. Format all analysis as bullet points using • for each point.',
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
    console.error('Deeper writer analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate deeper writer analysis' },
      { status: 500 }
    );
  }
}

