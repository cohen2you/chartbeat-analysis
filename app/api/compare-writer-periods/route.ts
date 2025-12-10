import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, generateSingleWriterData } from '@/lib/csvParser';
import { aiProvider, AIProvider } from '@/lib/aiProvider';
import { repairTruncatedJSON } from '@/lib/openai';

// Helper function to extract time period from data
function extractTimePeriod(data: any[]): { earliest: string; latest: string; period: string } {
  const dates = data
    .map(row => row.publish_date || row.publish_date || '')
    .filter(d => d && d.trim() !== '')
    .sort();
  
  const earliest = dates[0] || 'Unknown';
  const latest = dates[dates.length - 1] || 'Unknown';
  const period = earliest !== 'Unknown' && latest !== 'Unknown' 
    ? `${earliest} to ${latest}`
    : 'Unknown period';
  
  return { earliest, latest, period };
}

// Helper function to calculate period stats
function calculatePeriodStats(parsedData: any, writerName: string) {
  const { data, headers } = parsedData;
  const hasTitleField = headers.some((h: string) => h.toLowerCase() === 'title');
  
  const authorData = data.filter((row: any) => {
    const author = (row.author || row.Author || '').trim().toLowerCase();
    return author === writerName.toLowerCase();
  });

  const filteredData = authorData.filter((row: any) => {
    const views = Number(row.page_views || row['page_views'] || 0);
    return views > 1;
  });

  // Deduplicate articles
  const articleMap = new Map<string, any>();
  filteredData.forEach((row: any, index: number) => {
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

  const articles = Array.from(articleMap.values());
  const totalViews = articles.reduce((sum, a) => sum + a.page_views, 0);
  const avgViewsPerPost = articles.length > 0 ? totalViews / articles.length : 0;
  const topArticles = articles.sort((a, b) => b.page_views - a.page_views).slice(0, 5);

  return {
    articleCount: articles.length,
    totalViews,
    avgViewsPerPost: Math.round(avgViewsPerPost),
    topArticles,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, fileNames, provider } = body; // writerName is detected from data, not from request
    
    // Set provider if specified (with error handling)
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      try {
        aiProvider.setProvider(provider as AIProvider);
      } catch (error: any) {
        console.warn(`Provider ${provider} not available, using default:`, error.message);
      }
    }

    if (!csvData || !Array.isArray(csvData) || csvData.length < 2) {
      return NextResponse.json(
        { error: 'Please provide at least 2 CSV files to compare' },
        { status: 400 }
      );
    }

    // Parse all CSV data
    const parsedDataArray = csvData.map((csv: string, idx: number) => 
      parseCSV(csv, fileNames?.[idx])
    );

    // Detect writer name
    const combinedData = {
      data: parsedDataArray.flatMap(d => d.data),
      headers: parsedDataArray[0]?.headers || [],
    };

    const authorMap = new Map<string, number>();
    combinedData.data.forEach((row: any) => {
      const author = (row.author || row.Author || '').trim();
      if (author && author !== 'Unknown') {
        authorMap.set(author, (authorMap.get(author) || 0) + 1);
      }
    });
    const authors = Array.from(authorMap.entries()).sort((a, b) => b[1] - a[1]);
    const writerName = authors.length > 0 ? authors[0][0] : 'Unknown';

    // Generate data for each period
    const periods = parsedDataArray.map((data, idx) => {
      const writerData = generateSingleWriterData(data, writerName);
      const timePeriod = extractTimePeriod(data.data);
      const stats = calculatePeriodStats(data, writerName);
      
      return {
        fileName: data.fileName || `File ${idx + 1}`,
        writerData,
        timePeriod: timePeriod.period,
        earliestDate: timePeriod.earliest,
        latestDate: timePeriod.latest,
        stats,
      };
    });

    // Sort periods by earliest date
    const sortedPeriods = [...periods].sort((a, b) => {
      if (a.earliestDate === 'Unknown' || b.earliestDate === 'Unknown') return 0;
      return a.earliestDate.localeCompare(b.earliestDate);
    });

    // Calculate changes between periods
    const changes = [];
    for (let i = 1; i < sortedPeriods.length; i++) {
      const prev = sortedPeriods[i - 1];
      const curr = sortedPeriods[i];
      
      const articleChange = curr.stats.articleCount - prev.stats.articleCount;
      const viewsChange = curr.stats.totalViews - prev.stats.totalViews;
      const avgChange = curr.stats.avgViewsPerPost - prev.stats.avgViewsPerPost;
      
      const articleChangePct = prev.stats.articleCount > 0 
        ? ((articleChange / prev.stats.articleCount) * 100).toFixed(1)
        : '0.0';
      const viewsChangePct = prev.stats.totalViews > 0
        ? ((viewsChange / prev.stats.totalViews) * 100).toFixed(1)
        : '0.0';
      const avgChangePct = prev.stats.avgViewsPerPost > 0
        ? ((avgChange / prev.stats.avgViewsPerPost) * 100).toFixed(1)
        : '0.0';

      changes.push({
        fromPeriod: prev.timePeriod,
        toPeriod: curr.timePeriod,
        articleChange,
        articleChangePct,
        viewsChange,
        viewsChangePct,
        avgChange,
        avgChangePct,
      });
    }

    // Extract detailed article data for story type and headline analysis
    const periodArticles = sortedPeriods.map((period, periodIdx) => {
      // Find the matching parsed data for this period
      const matchingData = parsedDataArray.find((p) => {
        const pTimePeriod = extractTimePeriod(p.data);
        return pTimePeriod.period === period.timePeriod || p.fileName === period.fileName;
      }) || parsedDataArray[periodIdx];
      
      const { data, headers } = matchingData;
      
      const hasTitleField = headers.some((h: string) => h.toLowerCase() === 'title');
      const hasSectionField = headers.some((h: string) => h.toLowerCase() === 'section');
      
      const authorData = data.filter((row: any) => {
        const author = (row.author || row.Author || '').trim().toLowerCase();
        return author === writerName.toLowerCase();
      });
      
      const filteredData = authorData.filter((row: any) => {
        const views = Number(row.page_views || row['page_views'] || 0);
        return views > 1;
      });
      
      // Deduplicate and categorize articles
      const articleMap = new Map<string, any>();
      filteredData.forEach((row: any, index: number) => {
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
        
        const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
        const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
        
        if (!articleMap.has(articleKey)) {
          articleMap.set(articleKey, {
            title: title || `Article from ${publishDate || 'Unknown Date'}`,
            publish_date: publishDate,
            page_views: 0,
            sections: new Set<string>(),
          });
        }
        
        const article = articleMap.get(articleKey)!;
        article.page_views += views;
        if (hasSectionField && (row.section || row.Section)) {
          article.sections.add(row.section || row.Section);
        }
      });
      
      const articles = Array.from(articleMap.values());
      
      // Categorize by story type based on title patterns
      const storyTypes = new Map<string, { count: number; totalViews: number; articles: any[] }>();
      articles.forEach(article => {
        const title = article.title.toLowerCase();
        let type = 'Other';
        
        if (title.includes('earnings') || title.includes('q1') || title.includes('q2') || title.includes('q3') || title.includes('q4') || title.includes('fy')) {
          type = 'Earnings Reports';
        } else if (title.includes('stock') || title.includes('shares') || title.includes('nasdaq') || title.includes('nyse') || title.includes('amex')) {
          type = 'Stock Analysis';
        } else if (title.includes('why') || title.includes('what') || title.includes('how') || title.includes('?')) {
          type = 'Explanatory/News';
        } else if (title.includes('top') || title.includes('list') || title.includes('here are')) {
          type = 'List/Curated';
        } else if (title.includes('billionaire') || title.includes('ceo') || title.includes('executive') || title.includes('michael burry') || title.includes('kevin o\'leary')) {
          type = 'Personality-Driven';
        } else if (title.includes('rally') || title.includes('surge') || title.includes('soar') || title.includes('plunge') || title.includes('drop')) {
          type = 'Market Movement';
        } else if (title.includes('tariff') || title.includes('policy') || title.includes('trump') || title.includes('biden')) {
          type = 'Policy/Political';
        }
        
        if (!storyTypes.has(type)) {
          storyTypes.set(type, { count: 0, totalViews: 0, articles: [] });
        }
        const typeData = storyTypes.get(type)!;
        typeData.count += 1;
        typeData.totalViews += article.page_views;
        typeData.articles.push(article);
      });
      
      return {
        period: period.timePeriod,
        articles,
        storyTypes: Array.from(storyTypes.entries()).map(([type, data]) => ({
          type,
          count: data.count,
          totalViews: data.totalViews,
          avgViews: Math.round(data.totalViews / data.count),
          articles: data.articles.sort((a, b) => b.page_views - a.page_views).slice(0, 3),
        })),
        topArticles: articles.sort((a, b) => b.page_views - a.page_views).slice(0, 10),
        bottomArticles: articles.sort((a, b) => a.page_views - b.page_views).slice(0, 10),
      };
    });

    // Generate comparison analysis
    const comparisonPrompt = `You are an editor providing a comprehensive, detailed performance comparison for a writer across multiple time periods.

WRITER: ${writerName}

PERIOD COMPARISON DATA:
${sortedPeriods.map((period, idx) => `
Period ${idx + 1} (${period.timePeriod}):
- File: ${period.fileName}
- Articles: ${period.stats.articleCount}
- Total Views: ${period.stats.totalViews.toLocaleString()}
- Avg Views per Post: ${period.stats.avgViewsPerPost.toLocaleString()}
- Top 5 Articles:
${period.stats.topArticles.map((a: any, i: number) => `  ${i + 1}. "${a.title}" - ${a.page_views.toLocaleString()} views`).join('\n')}
`).join('\n---\n')}

CHANGES BETWEEN PERIODS:
${changes.map((change, idx) => `
From ${change.fromPeriod} to ${change.toPeriod}:
- Articles: ${change.articleChange > 0 ? '+' : ''}${change.articleChange} (${change.articleChangePct}%)
- Total Views: ${change.viewsChange > 0 ? '+' : ''}${change.viewsChange.toLocaleString()} (${change.viewsChangePct}%)
- Avg Views per Post: ${change.avgChange > 0 ? '+' : ''}${change.avgChange} (${change.avgChangePct}%)
`).join('\n')}

STORY TYPE PERFORMANCE BY PERIOD:
${periodArticles.map((pa, idx) => `
Period ${idx + 1} (${pa.period}):
${pa.storyTypes.map((st: any) => `  ${st.type}: ${st.count} articles, ${st.totalViews.toLocaleString()} total views, ${st.avgViews.toLocaleString()} avg views/article
    Top examples: ${st.articles.map((a: any) => `"${a.title}" (${a.page_views.toLocaleString()} views)`).join(', ')}`).join('\n')}
`).join('\n---\n')}

HEADLINE EXAMPLES BY PERFORMANCE:
${periodArticles.map((pa, idx) => `
Period ${idx + 1} (${pa.period}):
  Top 10 Headlines:
${pa.topArticles.map((a: any, i: number) => `    ${i + 1}. "${a.title}" - ${a.page_views.toLocaleString()} views`).join('\n')}
  Bottom 10 Headlines:
${pa.bottomArticles.map((a: any, i: number) => `    ${i + 1}. "${a.title}" - ${a.page_views.toLocaleString()} views`).join('\n')}
`).join('\n---\n')}

DETAILED DATA FOR EACH PERIOD:
${sortedPeriods.map((period, idx) => `
=== PERIOD ${idx + 1}: ${period.timePeriod} ===
${period.writerData}
`).join('\n\n')}

Provide a COMPREHENSIVE, DETAILED comparison with SPECIFIC NUMBERS and PERCENTAGES for ALL metrics. Include:

1. Performance Trends (with exact numbers and percentages):
   - Overall performance direction (improving/declining/stable) with specific metrics
   - Article count changes: exact numbers and percentages for each period transition
   - Total views changes: exact numbers and percentages, with calculations
   - Average views per post changes: exact numbers and percentages
   - Best vs worst article performance in each period
   - Performance consistency metrics (how many articles above/below average in each period)
   - Show calculations: e.g., "Period 2 had 22 articles vs Period 1's 23 articles, a decrease of 1 article (-4.3%). Total views increased from 109,062 to 109,964 (+902 views, +0.8%)"

2. Story Type Performance Analysis (with specific metrics):
   - Compare performance of each story type between periods
   - Show article count, total views, and average views per article for each type
   - Identify which story types improved/declined with exact numbers
   - Percentage changes for each story type
   - Examples: "Earnings Reports: Period 1 had 5 articles (avg 2,100 views) vs Period 2's 3 articles (avg 3,200 views) - 52.4% increase in avg views despite 40% fewer articles"

3. Headline Pattern Analysis (with specific examples):
   - Compare top-performing headlines vs bottom-performing headlines in each period
   - Identify headline patterns that work (with view counts)
   - Identify headline patterns that don't work (with view counts)
   - Show specific examples: "Headlines with 'Top 10' averaged 3,200 views in Period 1 vs 2,800 in Period 2 (-12.5%)"
   - Compare headline structures, keywords, length between periods
   - Show which headline formulas improved/declined

4. Content Changes (detailed metrics):
   - Article volume changes with percentages
   - Quality changes (avg views per post) with percentages
   - Top article performance comparison (show specific titles and view counts)
   - Bottom article performance comparison
   - Performance range changes (best vs worst article gap)

5. Sequential Analysis (period-by-period with numbers):
   - Period 1 → Period 2: Show ALL metric changes with exact numbers and percentages
   - If 3+ periods: Period 2 → Period 3, etc.
   - Identify trends: consistent improvement, decline, or volatility
   - Show cumulative changes across all periods

6. Key Insights (data-driven):
   - What story types drove success in each period (with numbers)
   - What headline patterns worked (with examples and view counts)
   - What changed that led to improvements/declines (with specific metrics)
   - Performance patterns with article examples

7. Recommendations (actionable with metrics):
   - Specific story types to focus on (with performance data)
   - Specific headline patterns to replicate (with examples)
   - Target metrics based on best-performing periods
   - What to avoid based on underperforming patterns

CRITICAL: Every insight MUST include specific numbers, percentages, and article examples. Show calculations. Compare story types and headlines with exact metrics.

Please format your response as JSON with this structure (ALL fields must be STRINGS, not arrays or objects):
{
  "performanceTrends": "Detailed analysis with exact numbers, percentages, and calculations for all metrics. Show article count changes, total views changes, avg views per post changes, best/worst article comparisons, and performance consistency. Format as bullet points using • for each point. Include specific numbers like 'Period 2 had 22 articles vs Period 1's 23 articles, a decrease of 1 article (-4.3%)'.",
  "storyTypeAnalysis": "Detailed comparison of story type performance between periods. Show article counts, total views, avg views per article, and percentage changes for each story type. Include specific examples with view counts. Format as bullet points using • for each point. Example: 'Earnings Reports: Period 1 had 5 articles averaging 2,100 views vs Period 2's 3 articles averaging 3,200 views (+52.4% avg views increase)'.",
  "headlineAnalysis": "Detailed headline pattern analysis comparing top vs bottom performers. Identify working patterns with view counts, non-working patterns, and changes between periods. Include specific headline examples with their view counts. Format as bullet points using • for each point. Example: 'Headlines with 'Top 10' averaged 3,200 views in Period 1 vs 2,800 in Period 2 (-12.5%). Examples: [specific headlines with view counts]'.",
  "contentChanges": "Detailed content change analysis with exact numbers and percentages. Compare article volume, quality metrics, top/bottom articles, and performance ranges. Format as bullet points using • for each point.",
  "sequentialAnalysis": "Period-by-period sequential analysis showing all metric changes with exact numbers and percentages for each transition. Format as bullet points using • for each point.",
  "keyInsights": "Data-driven insights with specific numbers, story type performance, headline patterns, and article examples. Format as bullet points using • for each point.",
  "recommendations": "Actionable recommendations with specific story types, headline patterns, target metrics, and examples to replicate or avoid. Format as bullet points using • for each point."
}

CRITICAL: Each field MUST be a plain text STRING formatted with bullet points (use • for each bullet). Do NOT return arrays or nested objects. The entire response should be valid JSON with string values only.`;

    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are an editor analyzing writer performance across multiple time periods. Always respond with valid JSON. Focus on sequential changes and trends. Format all fields as bullet points using • for each point.',
        },
        {
          role: 'user',
          content: comparisonPrompt,
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
      periods: sortedPeriods,
      changes,
      writerName,
    });
  } catch (error: any) {
    console.error('Period comparison error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compare periods' },
      { status: 500 }
    );
  }
}

