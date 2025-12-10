import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, getDataSummary } from '@/lib/csvParser';
import { aiProvider, AIProvider } from '@/lib/aiProvider';

interface Article {
  title: string;
  author: string;
  page_views: number;
  publish_date?: string;
  page_uniques?: number;
  page_views_quality?: number;
  page_avg_time?: number;
  sections?: string[];
  referrers?: string[];
}

interface ReferrerStats {
  referrer: string;
  views: number;
  articleCount: number;
  avgViewsPerArticle: number;
}

function extractArticles(parsedDataArray: any[]): Article[] {
  const allArticles: Article[] = [];
  const articleMap = new Map<string, Article>();

  parsedDataArray.forEach((parsedData) => {
    const { data, headers } = parsedData;
    
    const hasTitleField = headers.some((h: string) => h.toLowerCase() === 'title');
    const hasSectionField = headers.some((h: string) => h.toLowerCase() === 'section');
    const hasReferrerField = headers.some((h: string) => h.toLowerCase() === 'referrer');

    data.forEach((row: any) => {
      const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
      const author = (row.author || row.Author || 'Unknown').trim();
      const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
      const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
      const date = row.publish_date || row['publish_date'] || '';
      const uniques = row.page_uniques ?? row['page_uniques'];
      const quality = row.page_views_quality ?? row['page_views_quality'];
      const avgTime = row.page_avg_time ?? row['page_avg_time'];
      const section = hasSectionField ? (row.section || row.Section || '') : undefined;
      const referrer = hasReferrerField ? (row.referrer || row.Referrer || '') : undefined;

      if (!title || views <= 0) return;

      // Use title + author as unique key
      const key = `${author}_${title}`;
      
      if (!articleMap.has(key)) {
        articleMap.set(key, {
          title,
          author,
          page_views: views,
          publish_date: date,
          page_uniques: typeof uniques === 'number' ? uniques : undefined,
          page_views_quality: typeof quality === 'number' ? quality : undefined,
          page_avg_time: typeof avgTime === 'number' ? avgTime : undefined,
          sections: section ? [section] : undefined,
          referrers: referrer ? [referrer] : undefined,
        });
      } else {
        // Merge duplicate articles (sum views, combine sections/referrers)
        const existing = articleMap.get(key)!;
        existing.page_views += views;
        if (uniques) existing.page_uniques = (existing.page_uniques || 0) + (typeof uniques === 'number' ? uniques : Number(uniques) || 0);
        if (quality) existing.page_views_quality = (existing.page_views_quality || 0) + (typeof quality === 'number' ? quality : Number(quality) || 0);
        if (section && existing.sections && !existing.sections.includes(section)) {
          existing.sections.push(section);
        }
        if (referrer && existing.referrers && !existing.referrers.includes(referrer)) {
          existing.referrers.push(referrer);
        }
      }
    });
  });

  return Array.from(articleMap.values());
}

function analyzeReferrers(parsedDataArray: any[], targetArticle: Article, allArticles: Article[]): {
  articleReferrers: ReferrerStats[];
  topPerformersReferrers: ReferrerStats[];
  referrerComparison: string;
  anomalies: string[];
} {
  const referrerMap = new Map<string, { views: number; articles: Set<string> }>();
  const articleReferrerMap = new Map<string, { views: number; articles: Set<string> }>();
  const topPerformersReferrerMap = new Map<string, { views: number; articles: Set<string> }>();

  // Get top 20 performers for comparison
  const sortedArticles = [...allArticles].sort((a, b) => b.page_views - a.page_views);
  const topPerformers = sortedArticles.slice(0, 20);
  const topPerformerTitles = new Set(topPerformers.map(a => `${a.author}_${a.title}`));

  parsedDataArray.forEach((parsedData) => {
    const { data, headers } = parsedData;
    const hasTitleField = headers.some((h: string) => h.toLowerCase() === 'title');
    const hasReferrerField = headers.some((h: string) => h.toLowerCase() === 'referrer');

    if (!hasReferrerField) return;

    data.forEach((row: any) => {
      const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
      const author = (row.author || row.Author || 'Unknown').trim();
      const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
      const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
      const referrer = (row.referrer || row.Referrer || '').trim();

      if (!title || !referrer || views <= 0) return;

      const articleKey = `${author}_${title}`;
      const isTargetArticle = articleKey === `${targetArticle.author}_${targetArticle.title}`;
      const isTopPerformer = topPerformerTitles.has(articleKey);

      // Track all referrers
      if (!referrerMap.has(referrer)) {
        referrerMap.set(referrer, { views: 0, articles: new Set() });
      }
      const ref = referrerMap.get(referrer)!;
      ref.views += views;
      ref.articles.add(articleKey);

      // Track target article referrers
      if (isTargetArticle) {
        if (!articleReferrerMap.has(referrer)) {
          articleReferrerMap.set(referrer, { views: 0, articles: new Set() });
        }
        const articleRef = articleReferrerMap.get(referrer)!;
        articleRef.views += views;
        articleRef.articles.add(articleKey);
      }

      // Track top performers referrers
      if (isTopPerformer) {
        if (!topPerformersReferrerMap.has(referrer)) {
          topPerformersReferrerMap.set(referrer, { views: 0, articles: new Set() });
        }
        const topRef = topPerformersReferrerMap.get(referrer)!;
        topRef.views += views;
        topRef.articles.add(articleKey);
      }
    });
  });

  // Convert to arrays and calculate averages
  const articleReferrers: ReferrerStats[] = Array.from(articleReferrerMap.entries()).map(([ref, data]) => ({
    referrer: ref,
    views: data.views,
    articleCount: data.articles.size,
    avgViewsPerArticle: data.views / data.articles.size,
  })).sort((a, b) => b.views - a.views);

  const topPerformersReferrers: ReferrerStats[] = Array.from(topPerformersReferrerMap.entries()).map(([ref, data]) => ({
    referrer: ref,
    views: data.views,
    articleCount: data.articles.size,
    avgViewsPerArticle: data.views / data.articles.size,
  })).sort((a, b) => b.views - a.views);

  // Build comparison text
  const totalArticleViews = articleReferrers.reduce((sum, r) => sum + r.views, 0);
  const totalTopPerformersViews = topPerformersReferrers.reduce((sum, r) => sum + r.views, 0);
  
  let comparison = `Referrer Performance Analysis:\n\n`;
  comparison += `Target Article Total Views from Referrers: ${totalArticleViews.toLocaleString()}\n`;
  comparison += `Top 20 Performers Total Views from Referrers: ${totalTopPerformersViews.toLocaleString()}\n\n`;

  comparison += `Target Article Top Referrers:\n`;
  articleReferrers.slice(0, 10).forEach((r, idx) => {
    const pct = totalArticleViews > 0 ? ((r.views / totalArticleViews) * 100).toFixed(1) : '0';
    comparison += `${idx + 1}. ${r.referrer}: ${r.views.toLocaleString()} views (${pct}% of article's referrer traffic)\n`;
  });

  comparison += `\nTop Performers' Top Referrers:\n`;
  topPerformersReferrers.slice(0, 10).forEach((r, idx) => {
    const pct = totalTopPerformersViews > 0 ? ((r.views / totalTopPerformersViews) * 100).toFixed(1) : '0';
    comparison += `${idx + 1}. ${r.referrer}: ${r.views.toLocaleString()} views (${pct}% of top performers' referrer traffic)\n`;
  });

  // Find anomalies
  const anomalies: string[] = [];
  
  // Check for missing referrers (referrers that top performers have but target article doesn't)
  const articleReferrerSet = new Set(articleReferrers.map(r => r.referrer));
  const topReferrerSet = new Set(topPerformersReferrers.map(r => r.referrer));
  const missingReferrers = Array.from(topReferrerSet).filter(r => !articleReferrerSet.has(r));
  
  if (missingReferrers.length > 0) {
    const topMissing = missingReferrers
      .map(ref => {
        const topRef = topPerformersReferrers.find(r => r.referrer === ref);
        return { referrer: ref, avgViews: topRef?.avgViewsPerArticle || 0 };
      })
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 5);
    
    if (topMissing.length > 0) {
      anomalies.push(`Missing High-Value Referrers: The article is missing traffic from ${topMissing.length} referrer(s) that top performers receive significant traffic from: ${topMissing.map(r => `${r.referrer} (avg ${r.avgViews.toFixed(0)} views/article)`).join(', ')}`);
    }
  }

  // Check for underperforming referrers (referrers that both have, but target article gets less)
  articleReferrers.forEach(articleRef => {
    const topRef = topPerformersReferrers.find(r => r.referrer === articleRef.referrer);
    if (topRef && topRef.avgViewsPerArticle > 0) {
      const performanceRatio = articleRef.avgViewsPerArticle / topRef.avgViewsPerArticle;
      if (performanceRatio < 0.5 && articleRef.views > 0) {
        anomalies.push(`Underperforming Referrer: "${articleRef.referrer}" delivered ${articleRef.views.toLocaleString()} views to this article (avg ${articleRef.avgViewsPerArticle.toFixed(0)}/article), but top performers average ${topRef.avgViewsPerArticle.toFixed(0)} views/article from this referrer (${((1 - performanceRatio) * 100).toFixed(0)}% lower)`);
      }
    }
  });

  // Check for low referrer diversity
  if (articleReferrers.length < 3 && topPerformersReferrers.length >= 3) {
    anomalies.push(`Low Referrer Diversity: Article received traffic from only ${articleReferrers.length} referrer(s), while top performers typically receive traffic from ${topPerformersReferrers.length}+ referrers`);
  }

  // Check for referrer concentration
  if (articleReferrers.length > 0) {
    const topReferrerPct = totalArticleViews > 0 ? (articleReferrers[0].views / totalArticleViews) * 100 : 0;
    if (topReferrerPct > 80) {
      anomalies.push(`High Referrer Concentration: ${topReferrerPct.toFixed(1)}% of referrer traffic came from a single source (${articleReferrers[0].referrer}), indicating over-reliance on one traffic source`);
    }
  }

  return {
    articleReferrers,
    topPerformersReferrers,
    referrerComparison: comparison,
    anomalies,
  };
}

function findArticle(articles: Article[], title: string): Article | null {
  // Try exact match first
  let article = articles.find(a => a.title.toLowerCase() === title.toLowerCase());
  
  // If not found, try partial match
  if (!article) {
    article = articles.find(a => 
      a.title.toLowerCase().includes(title.toLowerCase()) ||
      title.toLowerCase().includes(a.title.toLowerCase())
    );
  }
  
  return article || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, fileNames, articleTitle, provider } = body;

    // Set provider if specified
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      try {
        aiProvider.setProvider(provider as AIProvider);
      } catch (error: any) {
        console.warn(`Provider ${provider} not available, using default:`, error.message);
      }
    }

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return NextResponse.json(
        { error: 'Please provide CSV data' },
        { status: 400 }
      );
    }

    if (!articleTitle || !articleTitle.trim()) {
      return NextResponse.json(
        { error: 'Please provide an article title' },
        { status: 400 }
      );
    }

    // Parse all CSV data
    const parsedDataArray = csvData.map((csv: string, idx: number) =>
      parseCSV(csv, fileNames?.[idx])
    );

    // Extract all articles
    const articles = extractArticles(parsedDataArray);

    if (articles.length === 0) {
      return NextResponse.json(
        { error: 'No articles found in CSV data' },
        { status: 400 }
      );
    }

    // Find the article
    const article = findArticle(articles, articleTitle.trim());

    if (!article) {
      return NextResponse.json(
        { 
          error: `Article "${articleTitle}" not found in CSV data. Please check the title spelling.`,
          suggestions: articles.slice(0, 5).map(a => a.title)
        },
        { status: 404 }
      );
    }

    // Get top performers for comparison
    const sortedArticles = [...articles].sort((a, b) => b.page_views - a.page_views);
    const topPerformers = sortedArticles.slice(0, 10);
    const avgViews = articles.reduce((sum, a) => sum + a.page_views, 0) / articles.length;

    // Calculate percentiles
    const articleRank = sortedArticles.findIndex(a => a.title === article.title && a.author === article.author) + 1;
    const percentile = ((articles.length - articleRank) / articles.length) * 100;

    // Build context data
    const articleContext = `
Article to Analyze:
- Title: ${article.title}
- Author: ${article.author}
- Page Views: ${article.page_views.toLocaleString()}
- Publish Date: ${article.publish_date || 'Unknown'}
- Page Uniques: ${article.page_uniques?.toLocaleString() || 'N/A'}
- Quality Views: ${article.page_views_quality?.toLocaleString() || 'N/A'}
- Avg Time on Page: ${article.page_avg_time ? `${article.page_avg_time.toFixed(1)}s` : 'N/A'}
- Sections: ${article.sections?.join(', ') || 'N/A'}
- Referrers: ${article.referrers?.join(', ') || 'N/A'}
- Rank: #${articleRank} out of ${articles.length} articles (${percentile.toFixed(1)}th percentile)
- Performance: ${article.page_views < avgViews ? 'Below Average' : 'Above Average'} (Average: ${avgViews.toFixed(0)} views)
`;

    const topPerformersContext = `
Top 10 Performing Articles for Comparison:
${topPerformers.map((a, idx) => `
${idx + 1}. "${a.title}" by ${a.author}
   - Views: ${a.page_views.toLocaleString()}
   - Date: ${a.publish_date || 'Unknown'}
   - Sections: ${a.sections?.join(', ') || 'N/A'}
   - Referrers: ${a.referrers?.join(', ') || 'N/A'}
`).join('\n')}
`;

    // Analyze referrers in detail
    const hasReferrerField = parsedDataArray.some(data => 
      data.headers.some((h: string) => h.toLowerCase() === 'referrer')
    );
    
    let referrerAnalysis = '';
    let referrerAnomalies: string[] = [];
    
    if (hasReferrerField) {
      const referrerData = analyzeReferrers(parsedDataArray, article, articles);
      referrerAnalysis = referrerData.referrerComparison;
      referrerAnomalies = referrerData.anomalies;
    }

    const referrerContext = hasReferrerField ? `
${referrerAnalysis}

Referrer Anomalies and Issues Identified:
${referrerAnomalies.length > 0 ? referrerAnomalies.map((a, idx) => `${idx + 1}. ${a}`).join('\n') : 'No significant referrer anomalies detected.'}
` : `
Referrer data is not available in the CSV file.
`;

    const dataSummary = parsedDataArray.map((data, idx) => 
      `Dataset ${idx + 1}${data.fileName ? ` (${data.fileName})` : ''}:\n${getDataSummary(data)}`
    ).join('\n\n---\n\n');

    const prompt = `You are a content performance analyst helping to understand why a specific article didn't perform well.

${articleContext}

${topPerformersContext}

${referrerContext}

Dataset Summary:
${dataSummary}

Analyze why this article underperformed compared to top performers. Consider:
1. **Headline/Title Analysis**: Compare the headline structure, length, keywords, and appeal to top performers
2. **Timing Analysis**: Was it published at an optimal time? Compare publish dates to top performers
3. **Content Category/Section**: How does the section/category compare to top performers?
4. **Author Performance**: How does this article compare to the author's other work?
5. **Traffic Sources (CRITICAL - Deep Analysis Required)**: 
   - Analyze referrer performance in detail using the referrer analysis data provided above
   - Compare how this article performed from each referrer vs. how top performers performed from the same referrers
   - Identify specific referrers where this article underperformed (e.g., "This article received X views from Referrer Y, but top performers average Z views from the same referrer")
   - Look for missing referrers that top performers receive traffic from but this article doesn't
   - Identify referrer concentration issues (over-reliance on one source)
   - Calculate performance gaps by referrer (e.g., "60% lower performance from Google Search compared to top performers")
   - Look for anomalies in referrer patterns that indicate distribution or discovery problems
6. **Engagement Metrics**: If available, compare time on page, quality views, etc.
7. **Market Context**: Was there competing content or news events that might have affected performance?

CRITICAL: The referrer analysis section above contains detailed data on referrer performance. You MUST:
- Reference specific referrers by name with exact view counts
- Compare this article's referrer performance to top performers' referrer performance
- Identify which specific referrers are missing or underperforming
- Calculate and state the performance gap for each significant referrer
- Explain what these referrer anomalies indicate about the article's distribution and discovery

Provide a comprehensive analysis with:
- Specific, actionable insights
- Comparisons to top performers with exact numbers
- Detailed referrer performance analysis with specific referrers, view counts, and performance gaps
- Identification of key factors that likely contributed to low performance
- Concrete recommendations for improving similar articles in the future

Format your response as JSON with this structure:
{
  "analysis": [
    "Bullet point 1: Specific insight with numbers (e.g., 'Article received 90 views vs 508 average for similar articles')",
    "Bullet point 2: Another specific insight with data",
    "Bullet point 3: Referrer-specific insight (e.g., 'Missing traffic from android-app://com.robinhood.android which delivers avg 41 views/article to top performers')",
    "Bullet point 4: Another insight",
    "Bullet point 5: Additional insight if relevant"
  ],
  "keyFactors": [
    "Factor 1: Specific reason with numbers (e.g., 'Headline was 40% longer than top performers')",
    "Factor 2: Another specific reason",
    "Factor 3: Referrer-specific factor with exact numbers (e.g., 'Missing traffic from Google Search which delivers avg 500 views/article to top performers')",
    "Factor 4: Another referrer-related factor if applicable"
  ],
  "comparisonToTopPerformers": [
    "Comparison point 1: Specific difference with numbers (e.g., 'Top performers average 325 views from android-app://com.robinhood.android, this article received 0')",
    "Comparison point 2: Another specific comparison",
    "Comparison point 3: Additional comparison point"
  ],
  "referrerAnalysis": [
    "Referrer insight 1: Specific referrer name with exact view counts and performance gap (e.g., 'smartnews.com delivered 33 views (36.7% of article traffic) vs 1,269 views (9.3% of top performers' traffic)')",
    "Referrer insight 2: Missing referrer analysis (e.g., 'Missing android-app://com.robinhood.android which averages 41 views/article for top performers')",
    "Referrer insight 3: Underperforming referrer analysis (e.g., 'Internal sources delivered 16 views vs 251 average for top performers (94% lower)')",
    "Referrer insight 4: Additional referrer pattern or anomaly"
  ],
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2 related to referrer optimization",
    "Specific recommendation 3"
  ]
}`;

    try {
      const currentProvider = aiProvider.getCurrentProvider();
      const response = await aiProvider.generateCompletion(
        [
          {
            role: 'system',
            content: 'You are a content performance analyst that provides data-driven insights on why articles underperform. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          model: currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4-turbo-preview',
          responseFormat: { type: 'json_object' },
          temperature: 0.7,
          maxTokens: currentProvider === 'gemini' ? 8192 : 4096,
        }
      );

      // Clean the response
      let cleanContent = response.content.trim();
      cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      const lastBracketIndex = cleanContent.lastIndexOf('}');
      if (lastBracketIndex !== -1) {
        cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
      }

      const analysisResult = JSON.parse(cleanContent);

      return NextResponse.json({
        success: true,
        article,
        analysis: {
          articleTitle: article.title,
          articleViews: article.page_views,
          ...analysisResult,
        },
      });
    } catch (error: any) {
      console.error('AI API error:', error);
      return NextResponse.json(
        { error: `Failed to analyze article: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Article analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze article' },
      { status: 500 }
    );
  }
}


