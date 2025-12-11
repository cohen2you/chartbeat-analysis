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

    // Get data summaries for AI analysis
    const summaries = parsedDataArray.map((data, idx) => {
      const summary = getDataSummary(data);
      return `Dataset ${idx + 1}${data.fileName ? ` (${data.fileName})` : ''}:\n${summary}`;
    }).join('\n\n---\n\n');

    // Extract metrics for comparison
    const { data: data1, headers: headers1 } = parsedDataArray[0];
    const { data: data2, headers: headers2 } = parsedDataArray[1];
    
    const hasSection1 = headers1.some((h: string) => h.toLowerCase() === 'section');
    const hasSection2 = headers2.some((h: string) => h.toLowerCase() === 'section');
    const hasReferrer1 = headers1.some((h: string) => h.toLowerCase() === 'referrer');
    const hasReferrer2 = headers2.some((h: string) => h.toLowerCase() === 'referrer');
    const hasTitle1 = headers1.some((h: string) => h.toLowerCase() === 'title');
    const hasTitle2 = headers2.some((h: string) => h.toLowerCase() === 'title');

    // Calculate overall metrics
    const totalViews1 = data1.reduce((sum: number, row: any) => {
      const views = Number(row.page_views ?? row['page_views'] ?? 0);
      return sum + views;
    }, 0);
    
    const totalViews2 = data2.reduce((sum: number, row: any) => {
      const views = Number(row.page_views ?? row['page_views'] ?? 0);
      return sum + views;
    }, 0);

    const totalArticles1 = new Set(data1.map((row: any) => {
      if (hasTitle1) {
        return (row.title || row.Title || '').trim();
      }
      return `${row.publish_date || ''}_${row.author || row.Author || ''}`;
    })).size;

    const totalArticles2 = new Set(data2.map((row: any) => {
      if (hasTitle2) {
        return (row.title || row.Title || '').trim();
      }
      return `${row.publish_date || ''}_${row.author || row.Author || ''}`;
    })).size;

    // Section metrics
    let sectionMetrics1 = '';
    if (hasSection1) {
      const sectionMap1 = new Map<string, { views: number; count: number }>();
      data1.forEach((row: any) => {
        const sectionRaw = row.section || row.Section || '';
        const section = typeof sectionRaw === 'string' ? sectionRaw.trim() : String(sectionRaw || '').trim();
        if (section) {
          const views = Number(row.page_views ?? row['page_views'] ?? 0);
          if (!sectionMap1.has(section)) {
            sectionMap1.set(section, { views: 0, count: 0 });
          }
          const stats = sectionMap1.get(section)!;
          stats.views += views;
          stats.count += 1;
        }
      });
      const topSections1 = Array.from(sectionMap1.entries())
        .sort((a, b) => b[1].views - a[1].views)
        .slice(0, 10);
      sectionMetrics1 = `Top Sections Dataset 1:\n${topSections1.map(([section, stats], idx) => 
        `${idx + 1}. ${section}: ${stats.views.toLocaleString()} views (${((stats.views / totalViews1) * 100).toFixed(2)}%), ${stats.count} articles`
      ).join('\n')}\n`;
    }

    let sectionMetrics2 = '';
    if (hasSection2) {
      const sectionMap2 = new Map<string, { views: number; count: number }>();
      data2.forEach((row: any) => {
        const sectionRaw = row.section || row.Section || '';
        const section = typeof sectionRaw === 'string' ? sectionRaw.trim() : String(sectionRaw || '').trim();
        if (section) {
          const views = Number(row.page_views ?? row['page_views'] ?? 0);
          if (!sectionMap2.has(section)) {
            sectionMap2.set(section, { views: 0, count: 0 });
          }
          const stats = sectionMap2.get(section)!;
          stats.views += views;
          stats.count += 1;
        }
      });
      const topSections2 = Array.from(sectionMap2.entries())
        .sort((a, b) => b[1].views - a[1].views)
        .slice(0, 10);
      sectionMetrics2 = `Top Sections Dataset 2:\n${topSections2.map(([section, stats], idx) => 
        `${idx + 1}. ${section}: ${stats.views.toLocaleString()} views (${((stats.views / totalViews2) * 100).toFixed(2)}%), ${stats.count} articles`
      ).join('\n')}\n`;
    }

    // Referrer metrics
    let referrerMetrics1 = '';
    if (hasReferrer1) {
      const referrerMap1 = new Map<string, { views: number; count: number }>();
      data1.forEach((row: any) => {
        const referrerRaw = row.referrer || row.Referrer || '';
        const referrer = typeof referrerRaw === 'string' ? referrerRaw.trim() : String(referrerRaw || '').trim();
        if (referrer) {
          const views = Number(row.page_views ?? row['page_views'] ?? 0);
          if (!referrerMap1.has(referrer)) {
            referrerMap1.set(referrer, { views: 0, count: 0 });
          }
          const stats = referrerMap1.get(referrer)!;
          stats.views += views;
          stats.count += 1;
        }
      });
      const topReferrers1 = Array.from(referrerMap1.entries())
        .sort((a, b) => b[1].views - a[1].views)
        .slice(0, 10);
      referrerMetrics1 = `Top Referrers Dataset 1:\n${topReferrers1.map(([referrer, stats], idx) => 
        `${idx + 1}. ${referrer}: ${stats.views.toLocaleString()} views (${((stats.views / totalViews1) * 100).toFixed(2)}%), ${stats.count} articles`
      ).join('\n')}\n`;
    }

    let referrerMetrics2 = '';
    if (hasReferrer2) {
      const referrerMap2 = new Map<string, { views: number; count: number }>();
      data2.forEach((row: any) => {
        const referrerRaw = row.referrer || row.Referrer || '';
        const referrer = typeof referrerRaw === 'string' ? referrerRaw.trim() : String(referrerRaw || '').trim();
        if (referrer) {
          const views = Number(row.page_views ?? row['page_views'] ?? 0);
          if (!referrerMap2.has(referrer)) {
            referrerMap2.set(referrer, { views: 0, count: 0 });
          }
          const stats = referrerMap2.get(referrer)!;
          stats.views += views;
          stats.count += 1;
        }
      });
      const topReferrers2 = Array.from(referrerMap2.entries())
        .sort((a, b) => b[1].views - a[1].views)
        .slice(0, 10);
      referrerMetrics2 = `Top Referrers Dataset 2:\n${topReferrers2.map(([referrer, stats], idx) => 
        `${idx + 1}. ${referrer}: ${stats.views.toLocaleString()} views (${((stats.views / totalViews2) * 100).toFixed(2)}%), ${stats.count} articles`
      ).join('\n')}\n`;
    }

    // Top articles
    let topArticles1 = '';
    if (hasTitle1) {
      const articleMap1 = new Map<string, number>();
      data1.forEach((row: any) => {
        const titleRaw = row.title || row.Title || '';
        const title = typeof titleRaw === 'string' ? titleRaw.trim() : String(titleRaw || '').trim();
        if (title) {
          const views = Number(row.page_views ?? row['page_views'] ?? 0);
          articleMap1.set(title, (articleMap1.get(title) || 0) + views);
        }
      });
      const topArticles = Array.from(articleMap1.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      topArticles1 = `Top Articles Dataset 1:\n${topArticles.map(([title, views], idx) => 
        `${idx + 1}. ${title}: ${views.toLocaleString()} views`
      ).join('\n')}\n`;
    }

    let topArticles2 = '';
    if (hasTitle2) {
      const articleMap2 = new Map<string, number>();
      data2.forEach((row: any) => {
        const titleRaw = row.title || row.Title || '';
        const title = typeof titleRaw === 'string' ? titleRaw.trim() : String(titleRaw || '').trim();
        if (title) {
          const views = Number(row.page_views ?? row['page_views'] ?? 0);
          articleMap2.set(title, (articleMap2.get(title) || 0) + views);
        }
      });
      const topArticles = Array.from(articleMap2.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      topArticles2 = `Top Articles Dataset 2:\n${topArticles.map(([title, views], idx) => 
        `${idx + 1}. ${title}: ${views.toLocaleString()} views`
      ).join('\n')}\n`;
    }

    const metricsSummary = `
=== OVERALL METRICS ===
Dataset 1: ${totalViews1.toLocaleString()} total pageviews, ${totalArticles1} unique articles
Dataset 2: ${totalViews2.toLocaleString()} total pageviews, ${totalArticles2} unique articles
Change: ${totalViews2 > totalViews1 ? '+' : ''}${((totalViews2 - totalViews1) / totalViews1 * 100).toFixed(2)}% pageviews, ${totalArticles2 > totalArticles1 ? '+' : ''}${((totalArticles2 - totalArticles1) / totalArticles1 * 100).toFixed(2)}% articles

${sectionMetrics1}
${sectionMetrics2}
${referrerMetrics1}
${referrerMetrics2}
${topArticles1}
${topArticles2}
`;

    const prompt = `You are a data analyst helping an editor compare non-author metrics between two Chartbeat analytics datasets.

Analyze the following two datasets focusing on:
- Overall pageview trends
- Section performance (if available)
- Referrer performance (if available)
- Top performing articles/titles (if available)
- Any other available metrics

CRITICAL REQUIREMENTS:
- Provide EXACTLY 2-3 bullet points for each metric category (sections, referrers, articles, overall)
- Each bullet point should compare Dataset 1 vs Dataset 2 with specific numbers and percentages
- Highlight the most significant changes and patterns
- Focus on insights, not raw data dumps
- If a metric category is not available in the data, skip it

Data:
${summaries}

Additional Metrics Summary:
${metricsSummary}

Please format your response as JSON with this structure:
{
  "overallMetrics": [
    "• First insight about overall pageviews/articles with specific numbers",
    "• Second insight with specific numbers"
  ],
  "sectionComparison": [
    "• First insight about section performance with specific numbers",
    "• Second insight (if significant)"
  ],
  "referrerComparison": [
    "• First insight about referrer performance with specific numbers",
    "• Second insight (if significant)"
  ],
  "topArticlesComparison": [
    "• First insight about top articles with specific numbers",
    "• Second insight (if significant)"
  ],
  "keyInsights": [
    "• First key insight about changes between datasets",
    "• Second key insight",
    "• Third key insight"
  ]
}

Note: Only include sections that have data available. If sections, referrers, or titles are not available, set those arrays to empty arrays [].`;

    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a data analyst specializing in comparing non-author metrics across datasets. Always respond with valid JSON. Format all responses as bullet points for clarity.',
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
      metricsComparison: result,
    });
  } catch (error: any) {
    console.error('Metrics comparison error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate metrics comparison' },
      { status: 500 }
    );
  }
}

