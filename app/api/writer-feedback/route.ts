import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, generateSingleWriterData } from '@/lib/csvParser';
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

    // Extract time period and article details
    const { data, headers } = combinedData;
    const hasTitleField = headers.some(h => h.toLowerCase() === 'title');
    
    // Extract articles with dates
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
        });
      }
    });

    const articles = Array.from(articleMap.values())
      .sort((a, b) => b.page_views - a.page_views);

    // Calculate time period
    const dates = articles
      .map(a => a.publish_date)
      .filter(d => d && d.trim() !== '')
      .sort();
    
    const earliestDate = dates[0] || 'Unknown';
    const latestDate = dates[dates.length - 1] || 'Unknown';
    const timePeriod = earliestDate !== 'Unknown' && latestDate !== 'Unknown' 
      ? `${earliestDate} to ${latestDate}`
      : 'Unknown period';

    // Calculate metrics
    const viewsPerPost = articles.map(a => a.page_views);
    const avgViewsPerPost = viewsPerPost.reduce((a, b) => a + b, 0) / viewsPerPost.length;
    const totalViews = viewsPerPost.reduce((a, b) => a + b, 0);

    // Top and bottom performers
    const topPerformers = articles.slice(0, Math.min(10, Math.floor(articles.length * 0.2)));
    const bottomPerformers = articles.slice(-Math.min(10, Math.floor(articles.length * 0.2))).reverse();
    const aboveAverage = articles.filter(a => a.page_views > avgViewsPerPost).length;
    const belowAverage = articles.filter(a => a.page_views < avgViewsPerPost).length;

    const prompt = `You are an editor providing constructive feedback to a writer based on their Chartbeat analytics performance data.

Create a professional, email-style writer feedback document that highlights successes, identifies underperforming content, and provides actionable focus areas for improvement.

CRITICAL REQUIREMENTS:
- Format as a professional email/feedback document
- Use a warm, constructive, and encouraging tone
- Include SPECIFIC article examples with exact view counts
- Reference the time period being analyzed
- Be specific and actionable - avoid generic advice
- ONLY reference fields/metrics that actually exist in the data

WRITER: ${writerName}
TIME PERIOD: ${timePeriod}
TOTAL ARTICLES: ${articles.length}
TOTAL VIEWS: ${totalViews.toLocaleString()}
AVERAGE VIEWS PER POST: ${Math.round(avgViewsPerPost).toLocaleString()}
ARTICLES ABOVE AVERAGE: ${aboveAverage} (${((aboveAverage / articles.length) * 100).toFixed(1)}%)
ARTICLES BELOW AVERAGE: ${belowAverage} (${((belowAverage / articles.length) * 100).toFixed(1)}%)

TOP PERFORMING ARTICLES (${topPerformers.length} examples):
${topPerformers.map((a, idx) => `${idx + 1}. "${a.title}" - ${a.page_views.toLocaleString()} views (${a.publish_date || 'N/A'})`).join('\n')}

UNDERPERFORMING ARTICLES (${bottomPerformers.length} examples):
${bottomPerformers.map((a, idx) => `${idx + 1}. "${a.title}" - ${a.page_views.toLocaleString()} views (${a.publish_date || 'N/A'})`).join('\n')}

FULL PERFORMANCE DATA:
${writerData}

Create a writer feedback document with this structure:

1. Opening: Direct greeting with writer's name, acknowledge the time period analyzed. DO NOT include "I hope this message finds you well" or similar formal greetings. Start directly with "Dear [Writer Name]," then immediately acknowledge the analysis period.

2. Highlights & Successes (use actual bold formatting, not markdown):
   - Celebrate top performing articles with specific titles and view counts
   - Identify what made successful articles work (title patterns, topics, timing, etc.)
   - Note any positive trends or improvements
   - Include 3-5 specific article examples with exact metrics
   - Use bold formatting for the section header (not markdown **)

3. Areas for Improvement (use actual bold formatting, not markdown):
   - Identify underperforming articles with specific titles and view counts
   - Analyze what didn't work (title patterns, topics, timing, etc.)
   - Note any concerning trends
   - Include 3-5 specific article examples with exact metrics
   - Be constructive and specific about why they underperformed
   - Use bold formatting for the section header (not markdown **)

4. Focus Areas for Upcoming Period (use actual bold formatting, not markdown):
   - 5-7 specific, actionable bullet points based on the data
   - Reference successful patterns to replicate
   - Reference unsuccessful patterns to avoid
   - Include specific article examples where relevant
   - Be concrete and actionable (not generic advice)
   - Use bold formatting for the section header (not markdown **)

5. Closing: Natural, conversational closing that's warm but not overly formal or robotic. Avoid corporate speak. Be genuine and encouraging. DO NOT include "**Closing**:" label. Just write the closing paragraph naturally.

Format the response as a professional email-style document. Use a warm, constructive, conversational tone. Include specific article titles, exact view counts, and the time period throughout. Use actual bold text formatting (not markdown **) for section headers.

Please format your response as JSON with this structure:
{
  "writerFeedback": "Full email-style feedback document with greeting, highlights, areas for improvement, focus areas, and closing. Format as professional email text with proper structure and flow. Include the time period (${timePeriod}) in the opening. Use specific article examples with exact view counts throughout."
}`;

    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are an editor providing constructive, data-driven feedback to writers. Always respond with valid JSON. Format feedback as a professional email-style document with a warm, encouraging, conversational tone. DO NOT use markdown formatting (**) - use actual bold text. DO NOT include "I hope this message finds you well" or similar formal greetings. Start directly with "Dear [Name],". DO NOT include "**Closing**:" label. Make the closing paragraph natural and conversational, not robotic or overly formal. Include specific article examples with exact metrics.',
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
      writerFeedback: result.writerFeedback || '',
      timePeriod: timePeriod,
    });
  } catch (error: any) {
    console.error('Writer feedback error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate writer feedback' },
      { status: 500 }
    );
  }
}

