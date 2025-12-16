import { NextRequest, NextResponse } from 'next/server';
import { parseCSV } from '@/lib/csvParser';
import { aiProvider, AIProvider } from '@/lib/aiProvider';
import { repairTruncatedJSON } from '@/lib/openai';

// Function to fetch S&P 500 data from Polygon API
async function fetchSP500Data(dates: string[]): Promise<Map<string, number>> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.warn('POLYGON_API_KEY not configured. S&P 500 data will not be available.');
    return new Map();
  }

  const sp500Map = new Map<string, number>();
  
  try {
    // Get unique dates and sort them
    const uniqueDates = [...new Set(dates)].sort();
    if (uniqueDates.length === 0) return sp500Map;

    // Get date range
    const startDate = uniqueDates[0];
    const endDate = uniqueDates[uniqueDates.length - 1];

    // Polygon API endpoint for S&P 500 (SPY ETF or SPX index)
    // Using SPY ETF as it's more reliable for daily data
    const url = `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&apiKey=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Polygon API error: ${response.status} ${response.statusText}`);
      return sp500Map;
    }

    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((day: any) => {
        // Convert timestamp to date string (YYYY-MM-DD)
        const date = new Date(day.t);
        const dateStr = date.toISOString().split('T')[0];
        
        // Calculate percentage change: ((close - open) / open) * 100
        if (day.o && day.c) {
          const percentChange = ((day.c - day.o) / day.o) * 100;
          sp500Map.set(dateStr, parseFloat(percentChange.toFixed(2)));
        }
      });
    }

    console.log(`Fetched S&P 500 data for ${sp500Map.size} days`);
  } catch (error: any) {
    console.error('Error fetching S&P 500 data from Polygon:', error.message);
  }

  return sp500Map;
}

interface SectionData {
  name: string;
  totalPageviews: number;
  postCount: number;
  source: string; // Referrer source
  ratio?: number;
}

interface DailyStats {
  date: string;
  traffic: number;
  postCount: number;
  sp500?: number; // Optional S&P 500 data
}

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
        { error: 'Please provide CSV data' },
        { status: 400 }
      );
    }

    // Parse CSV data
    const parsedDataArray = csvData.map((csv: string, idx: number) => 
      parseCSV(csv, fileNames?.[idx])
    );

    // If two CSV files provided, use:
    // - First CSV (with SmartNews) for chart and "All Traffic" rankings
    // - Second CSV (without SmartNews) for "Excluding SmartNews" rankings
    // If only one CSV, use it for both
    const withSmartNewsData = parsedDataArray[0];
    const withoutSmartNewsData = parsedDataArray.length > 1 ? parsedDataArray[1] : parsedDataArray[0];

    // Use the "with SmartNews" data for chart and overall analysis
    const { data, headers } = withSmartNewsData;
    
    // Check which fields exist
    const hasTitleField = headers.some((h: string) => h.toLowerCase() === 'title');
    const hasSectionField = headers.some((h: string) => h.toLowerCase() === 'section');
    const hasReferrerField = headers.some((h: string) => h.toLowerCase() === 'referrer');
    const hasDateField = headers.some((h: string) => h.toLowerCase() === 'publish_date' || h.toLowerCase() === 'date');

    // Filter out articles with 1 or fewer page views
    const filteredData = data.filter((row: any) => {
      const views = Number(row.page_views || row['page_views'] || 0);
      return views > 1;
    });

    // --- Section 1: Calculate Section Rankings (Math-based) ---
    // Scan ALL rows and aggregate by section
    // For each section, sum up page views from ALL rows that have that section
    // Also track unique articles per section to count posts correctly
    const allSectionsMap = new Map<string, { totalPageviews: number; articles: Set<string> }>();
    const articleViewsMap = new Map<string, number>(); // Track article views for deduplication
    const articleDatesMap = new Map<string, string>(); // Track article publish dates
    const articleReferrersMap = new Map<string, Set<string>>(); // Track article referrers

    // First pass: Scan all rows and aggregate by section
    let rowCount = 0;
    let rowsWithSections = 0;
    const sectionRowCount = new Map<string, number>();
    
    filteredData.forEach((row: any) => {
      rowCount++;
      const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
      const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
      const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
      const section = hasSectionField ? (typeof (row.section || row.Section) === 'string' ? (row.section || row.Section).trim() : String(row.section || row.Section || '').trim()) : '';
      const referrer = hasReferrerField ? (typeof (row.referrer || row.Referrer) === 'string' ? (row.referrer || row.Referrer).trim() : String(row.referrer || row.Referrer || '').trim()) : '';
      const publishDate = hasDateField ? (row.publish_date || row.publish_date || row.date || row.Date || '').trim() : '';

      if (!title && hasTitleField) return;
      if (!section) return; // Skip rows without sections
      
      rowsWithSections++;
      sectionRowCount.set(section, (sectionRowCount.get(section) || 0) + 1);

      // Use title as article key (or date+author if no title)
      const articleKey = title || `${publishDate}_${row.author || ''}`;

      // Track article views (use MAX since views are repeated across rows)
      if (!articleViewsMap.has(articleKey)) {
        articleViewsMap.set(articleKey, views);
      } else {
        articleViewsMap.set(articleKey, Math.max(articleViewsMap.get(articleKey)!, views));
      }

      // Track article dates
      if (publishDate && !articleDatesMap.has(articleKey)) {
        articleDatesMap.set(articleKey, publishDate);
      }

      // Track article referrers
      if (referrer) {
        if (!articleReferrersMap.has(articleKey)) {
          articleReferrersMap.set(articleKey, new Set<string>());
        }
        articleReferrersMap.get(articleKey)!.add(referrer);
      }

      // Aggregate by section - track which articles belong to each section
      if (!allSectionsMap.has(section)) {
        allSectionsMap.set(section, {
          totalPageviews: 0,
          articles: new Set<string>(),
        });
      }
      
      const sectionEntry = allSectionsMap.get(section)!;
      sectionEntry.articles.add(articleKey);
    });
    
    console.log(`=== SECTION AGGREGATION DEBUG ===`);
    console.log(`Total rows processed: ${rowCount}`);
    console.log(`Rows with sections: ${rowsWithSections}`);
    console.log(`Total unique articles: ${articleViewsMap.size}`);
    console.log(`Total unique sections: ${allSectionsMap.size}`);
    console.log(`Rows per section (sample):`, Array.from(sectionRowCount.entries()).slice(0, 10));

    // Second pass: Set totalPageviews for each section using article totals
    allSectionsMap.forEach((sectionEntry, sectionName) => {
      let totalViews = 0;
      sectionEntry.articles.forEach((articleKey) => {
        const articleViews = articleViewsMap.get(articleKey) || 0;
        totalViews += articleViews;
      });
      sectionEntry.totalPageviews = totalViews;
      
      // Debug logging for top sections
      if (sectionEntry.articles.size <= 3) {
        console.log(`Section "${sectionName}": ${sectionEntry.articles.size} articles, ${totalViews.toLocaleString()} total views`);
        console.log(`  Article keys:`, Array.from(sectionEntry.articles).slice(0, 5));
      }
    });
    
    console.log(`Top 5 sections by article count:`, 
      Array.from(allSectionsMap.entries())
        .sort((a, b) => b[1].articles.size - a[1].articles.size)
        .slice(0, 5)
        .map(([name, entry]) => [name, entry.articles.size, entry.totalPageviews])
    );

    // Calculate ratios for "All Traffic" view
    const allSections: SectionData[] = Array.from(allSectionsMap.entries()).map(([sectionName, entry]) => ({
      name: sectionName,
      totalPageviews: entry.totalPageviews,
      postCount: entry.articles.size, // Count unique articles
      ratio: entry.articles.size > 0 ? Math.round(entry.totalPageviews / entry.articles.size) : 0,
      source: '', // Not needed, will be removed from display
    }));

    // Calculate "Excluding SmartNews" from the second CSV file (if provided)
    let exSmartNewsSections: SectionData[] = [];
    
    if (parsedDataArray.length > 1) {
      // Use the second CSV (without SmartNews) for this analysis
      const { data: dataWithoutSmartNews, headers: headersWithoutSmartNews } = withoutSmartNewsData;
      
      const filteredDataWithoutSmartNews = dataWithoutSmartNews.filter((row: any) => {
        const views = Number(row.page_views || row['page_views'] || 0);
        return views > 1;
      });

      const hasTitleFieldEx = headersWithoutSmartNews.some((h: string) => h.toLowerCase() === 'title');
      const hasSectionFieldEx = headersWithoutSmartNews.some((h: string) => h.toLowerCase() === 'section');
      const hasDateFieldEx = headersWithoutSmartNews.some((h: string) => h.toLowerCase() === 'publish_date' || h.toLowerCase() === 'date');
      
      // Scan ALL rows and aggregate by section (same approach as "All Traffic")
      const exSmartNewsSectionsMap = new Map<string, { totalPageviews: number; articles: Set<string> }>();
      const exSmartNewsArticleViewsMap = new Map<string, number>();

      // First pass: Scan all rows and aggregate by section
      filteredDataWithoutSmartNews.forEach((row: any) => {
        const title = hasTitleFieldEx ? (row.title || row.Title || '').trim() : '';
        const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
        const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
        const section = hasSectionFieldEx ? (typeof (row.section || row.Section) === 'string' ? (row.section || row.Section).trim() : String(row.section || row.Section || '').trim()) : '';
        const publishDate = hasDateFieldEx ? (row.publish_date || row.publish_date || row.date || row.Date || '').trim() : '';

        if (!title && hasTitleFieldEx) return;
        if (!section) return; // Skip rows without sections

        const articleKey = title || `${publishDate}_${row.author || ''}`;

        // Track article views (use MAX since views are repeated across rows)
        if (!exSmartNewsArticleViewsMap.has(articleKey)) {
          exSmartNewsArticleViewsMap.set(articleKey, views);
        } else {
          exSmartNewsArticleViewsMap.set(articleKey, Math.max(exSmartNewsArticleViewsMap.get(articleKey)!, views));
        }

        // Aggregate by section
        if (!exSmartNewsSectionsMap.has(section)) {
          exSmartNewsSectionsMap.set(section, {
            totalPageviews: 0,
            articles: new Set<string>(),
          });
        }
        
        const sectionEntry = exSmartNewsSectionsMap.get(section)!;
        sectionEntry.articles.add(articleKey);
      });

      // Second pass: Set totalPageviews for each section using article totals
      exSmartNewsSectionsMap.forEach((sectionEntry, sectionName) => {
        let totalViews = 0;
        sectionEntry.articles.forEach((articleKey) => {
          const articleViews = exSmartNewsArticleViewsMap.get(articleKey) || 0;
          totalViews += articleViews;
        });
        sectionEntry.totalPageviews = totalViews;
      });

      exSmartNewsSections = Array.from(exSmartNewsSectionsMap.entries()).map(([sectionName, entry]) => ({
        name: sectionName,
        totalPageviews: entry.totalPageviews,
        postCount: entry.articles.size, // Count unique articles
        ratio: entry.articles.size > 0 ? Math.round(entry.totalPageviews / entry.articles.size) : 0,
        source: '', // Not needed
      }));
    } else {
      // If only one CSV provided, "Excluding SmartNews" will be empty or same as "All Traffic"
      // (since we can't filter SmartNews from a single CSV that contains it)
      exSmartNewsSections = [];
    }

    // Sort and get top 5 - by ratio (pageviews per post)
    // Filter out sections with only 1 article to avoid single-article sections dominating
    const top5AllByRatio = [...allSections]
      .filter(s => s.postCount > 1) // Only include sections with more than 1 article
      .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
      .slice(0, 5);

    const top5ExSmartNewsByRatio = [...exSmartNewsSections]
      .filter(s => s.postCount > 1) // Only include sections with more than 1 article
      .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
      .slice(0, 5);

    // Define popular sections to exclude from top 5 by pageviews
    const popularSections = ['news', 'top stories', 'trading ideas', "why it's moving", 'movers'];
    const isPopularSection = (name: string) => {
      const nameLower = name.toLowerCase().trim();
      return popularSections.some(pop => nameLower === pop.toLowerCase() || nameLower.includes(pop.toLowerCase()));
    };

    // Sort and get top 5 - by total pageviews (excluding popular sections)
    const top5AllByPageviews = [...allSections]
      .filter(s => !isPopularSection(s.name))
      .sort((a, b) => b.totalPageviews - a.totalPageviews)
      .slice(0, 5);

    const top5ExSmartNewsByPageviews = [...exSmartNewsSections]
      .filter(s => !isPopularSection(s.name))
      .sort((a, b) => b.totalPageviews - a.totalPageviews)
      .slice(0, 5);

    // Get the excluded popular sections for display
    const popularSectionsAll = [...allSections]
      .filter(s => isPopularSection(s.name))
      .sort((a, b) => b.totalPageviews - a.totalPageviews);

    const popularSectionsExSmartNews = [...exSmartNewsSections]
      .filter(s => isPopularSection(s.name))
      .sort((a, b) => b.totalPageviews - a.totalPageviews);
    
    console.log(`Top 5 sections by ratio (All Traffic, min 2 articles):`, 
      top5AllByRatio.map(s => [s.name, s.totalPageviews.toLocaleString(), s.postCount, s.ratio])
    );
    console.log(`Top 5 sections by ratio (Ex SmartNews, min 2 articles):`, 
      top5ExSmartNewsByRatio.map(s => [s.name, s.totalPageviews.toLocaleString(), s.postCount, s.ratio])
    );
    console.log(`Top 5 sections by pageviews (All Traffic, excluding popular):`, 
      top5AllByPageviews.map(s => [s.name, s.totalPageviews.toLocaleString(), s.postCount, s.ratio])
    );
    console.log(`Top 5 sections by pageviews (Ex SmartNews, excluding popular):`, 
      top5ExSmartNewsByPageviews.map(s => [s.name, s.totalPageviews.toLocaleString(), s.postCount, s.ratio])
    );
    console.log(`Popular sections (All Traffic):`, 
      popularSectionsAll.map(s => [s.name, s.totalPageviews.toLocaleString(), s.postCount, s.ratio])
    );
    console.log(`Popular sections (Ex SmartNews):`, 
      popularSectionsExSmartNews.map(s => [s.name, s.totalPageviews.toLocaleString(), s.postCount, s.ratio])
    );

    // --- Generate Daily Stats for Chart ---
    const dailyMap = new Map<string, { traffic: number; articles: Set<string> }>();

    articleViewsMap.forEach((views, articleKey) => {
      // Get date from articleDatesMap or try to extract from key
      let date = articleDatesMap.get(articleKey) || '';
      
      // If still no date, try to extract from the first part of articleKey if it looks like a date
      if (!date && articleKey.includes('_')) {
        const possibleDate = articleKey.split('_')[0];
        // Check if it looks like a date (YYYY-MM-DD format)
        if (possibleDate.match(/^\d{4}-\d{2}-\d{2}/)) {
          date = possibleDate;
        }
      }
      
      // If no date available, skip this article for daily stats
      if (!date || date.trim() === '') {
        return;
      }

      // Normalize date format (take just YYYY-MM-DD part if there's time)
      const normalizedDate = date.split(' ')[0].split('T')[0];

      if (!dailyMap.has(normalizedDate)) {
        dailyMap.set(normalizedDate, {
          traffic: 0,
          articles: new Set<string>(),
        });
      }

      const daily = dailyMap.get(normalizedDate)!;
      daily.traffic += views;
      daily.articles.add(articleKey);
    });

    let dailyStats: DailyStats[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        traffic: data.traffic,
        postCount: data.articles.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // If no daily stats (no dates available), create a single aggregated data point
    if (dailyStats.length === 0) {
      const totalTraffic = Array.from(articleViewsMap.values()).reduce((sum, views) => sum + views, 0);
      const totalArticles = articleViewsMap.size;
      dailyStats = [{
        date: 'All Data',
        traffic: totalTraffic,
        postCount: totalArticles,
      }];
      console.log('No date field found in CSV. Using aggregated data point.');
    } else {
      console.log(`Generated ${dailyStats.length} daily data points for chart`);
      
      // Fetch S&P 500 data for the dates we have
      const dates = dailyStats.map(d => d.date).filter(d => d !== 'All Data' && d.match(/^\d{4}-\d{2}-\d{2}/));
      if (dates.length > 0) {
        const sp500Data = await fetchSP500Data(dates);
        // Add S&P 500 data to daily stats
        dailyStats = dailyStats.map(stat => {
          if (stat.date !== 'All Data' && sp500Data.has(stat.date)) {
            return {
              ...stat,
              sp500: sp500Data.get(stat.date),
            };
          }
          return stat;
        });
      }
    }

    // --- Section 2: AI Analysis ---
    const totalTraffic = articleViewsMap.size > 0 
      ? Array.from(articleViewsMap.values()).reduce((sum, views) => sum + views, 0)
      : 0;
    
    const totalArticles = articleViewsMap.size;
    const topArticles = Array.from(articleViewsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, views]) => ({
        title: key,
        views: views,
      }));

    // Get top referrer
    const referrerMap = new Map<string, number>();
    articleReferrersMap.forEach((referrers, articleKey) => {
      const articleViews = articleViewsMap.get(articleKey) || 0;
      referrers.forEach(ref => {
        referrerMap.set(ref, (referrerMap.get(ref) || 0) + articleViews);
      });
    });
    const topReferrer = Array.from(referrerMap.entries())
      .sort((a, b) => b[1] - a[1])[0];

    const contentBreadth = allSectionsMap.size > 0 
      ? allSectionsMap.size <= 5 ? 'Low concentration in few sections' 
      : allSectionsMap.size <= 10 ? 'Moderate breadth' 
      : 'High breadth across many sections'
      : 'Unknown';

    // Get top sections for context
    const topSectionsByViews = Array.from(allSectionsMap.entries())
      .sort((a, b) => b[1].totalPageviews - a[1].totalPageviews)
      .slice(0, 5)
      .map(([name, entry]) => ({
        name,
        views: entry.totalPageviews,
        articles: entry.articles.size,
        ratio: entry.articles.size > 0 ? Math.round(entry.totalPageviews / entry.articles.size) : 0,
      }));

    const topSectionsByRatio = Array.from(allSectionsMap.entries())
      .filter(([_, entry]) => entry.articles.size > 1)
      .sort((a, b) => {
        const ratioA = a[1].articles.size > 0 ? a[1].totalPageviews / a[1].articles.size : 0;
        const ratioB = b[1].articles.size > 0 ? b[1].totalPageviews / b[1].articles.size : 0;
        return ratioB - ratioA;
      })
      .slice(0, 5)
      .map(([name, entry]) => ({
        name,
        views: entry.totalPageviews,
        articles: entry.articles.size,
        ratio: entry.articles.size > 0 ? Math.round(entry.totalPageviews / entry.articles.size) : 0,
      }));

    const analysisContext = {
      date: dailyStats.length > 0 ? dailyStats[dailyStats.length - 1].date : 'Unknown',
      daily_traffic: totalTraffic,
      articles_published: totalArticles,
      top_3_articles: topArticles,
      top_3_articles_combined_views: topArticles.reduce((sum, a) => sum + a.views, 0),
      top_3_percentage: totalTraffic > 0 ? ((topArticles.reduce((sum, a) => sum + a.views, 0) / totalTraffic) * 100).toFixed(1) : '0',
      total_sections: allSectionsMap.size,
      top_sections_by_views: topSectionsByViews,
      top_sections_by_ratio: topSectionsByRatio,
      content_breadth: contentBreadth,
    };

    const prompt = `Analyze this traffic data for a financial news site and provide detailed, actionable insights.

Data Context:
- Total Traffic: ${analysisContext.daily_traffic.toLocaleString()} views
- Articles Published: ${analysisContext.articles_published}
- Top 3 Articles Combined: ${analysisContext.top_3_articles_combined_views.toLocaleString()} views (${analysisContext.top_3_percentage}% of total traffic)
  ${analysisContext.top_3_articles.map((a, i) => `  ${i + 1}. "${a.title}" - ${a.views.toLocaleString()} views`).join('\n')}
- Total Unique Sections: ${analysisContext.total_sections}
- Top 5 Sections by Total Views:
${analysisContext.top_sections_by_views.map((s, i) => `  ${i + 1}. ${s.name}: ${s.views.toLocaleString()} views, ${s.articles} articles, ${s.ratio} avg views/article`).join('\n')}
- Top 5 Sections by Views per Article (ratio):
${analysisContext.top_sections_by_ratio.map((s, i) => `  ${i + 1}. ${s.name}: ${s.ratio} avg views/article, ${s.views.toLocaleString()} total views, ${s.articles} articles`).join('\n')}

Provide a detailed analysis with the following:

1. Traffic Pattern Analysis:
   - Determine if traffic is volume-driven (distributed across many articles) or viral-driven (concentrated in a few top performers)
   - Calculate what percentage of traffic comes from top 3, top 10, and top 20 articles
   - Analyze the distribution curve: Is traffic evenly distributed or heavily skewed?
   - Identify any patterns in article performance (e.g., do certain topics consistently perform better?)
   - Provide specific numbers and percentages to support your analysis

2. Content Breadth & Section/Topic Analysis:
   - Analyze the diversity of content across ${analysisContext.total_sections} sections
   - Identify which sections/topics drive the most traffic and which have the best performance per article
   - Compare section/topic performance: Are there clear winners, or is traffic well-distributed?
   - Analyze the relationship between section count and traffic: Does more diversity correlate with more traffic?
   - Identify opportunities: Which sections/topics show high potential but low current traffic?
   - Provide specific recommendations based on the section/topic performance data
   - Focus heavily on analyzing individual sections/topics and their performance characteristics

Output Format: Return a JSON object with ONLY these two fields:
- "traffic_pattern_analysis": Analysis in bullet point format (5-8 bullet points) covering traffic distribution, volume vs viral patterns, with specific numbers and percentages. Each bullet should be a complete, actionable insight.
- "content_breadth_analysis": Analysis in bullet point format (8-12 bullet points) focusing heavily on section/topic analysis, performance patterns, and strategic recommendations. Each bullet should analyze specific sections/topics with numbers, identify opportunities, and provide actionable recommendations.`;

    let aiAnalysis;
    try {
      console.log('Calling AI for traffic analysis...');
      const response = await aiProvider.generateCompletion(
        [
          {
            role: 'system',
            content: 'You are a traffic analysis expert for financial news sites. Provide detailed, data-driven insights about traffic patterns and content breadth. Focus heavily on analyzing individual sections/topics and their performance. Use specific numbers, percentages, and comparisons. Format all analysis as bullet points (not paragraphs). Always respond with valid JSON containing only the requested fields.',
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
          maxTokens: aiProvider.getCurrentProvider() === 'gemini' ? 8192 : 4096,
        }
      );
      console.log('AI response received, parsing...');

      // Clean and parse AI response
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
      cleanContent = repairTruncatedJSON(cleanContent);

      try {
        aiAnalysis = JSON.parse(cleanContent);
        console.log('AI analysis parsed successfully');
      } catch (parseError: any) {
        console.error('JSON Parse Error:', parseError.message);
        aiAnalysis = {
          traffic_pattern_analysis: 'Analysis unavailable due to parsing error',
          content_breadth_analysis: 'Analysis unavailable due to parsing error',
        };
      }
    } catch (aiError: any) {
      console.error('AI analysis error:', aiError);
      // If AI fails, return the math-based results without AI analysis
      aiAnalysis = {
        traffic_pattern_analysis: `AI analysis unavailable: ${aiError.message || 'Unknown error'}. Traffic data shows ${totalTraffic.toLocaleString()} total views across ${totalArticles} articles. Top 3 articles account for ${((topArticles.reduce((sum, a) => sum + a.views, 0) / totalTraffic) * 100).toFixed(1)}% of total traffic.`,
        content_breadth_analysis: `Content breadth: ${contentBreadth}. ${allSectionsMap.size} unique sections identified. Top sections by views: ${topSectionsByViews.slice(0, 3).map(s => `${s.name} (${s.views.toLocaleString()} views, ${s.articles} articles)`).join(', ')}.`,
      };
    }

    return NextResponse.json({
      success: true,
      rankings: {
        top5AllByRatio,
        top5ExSmartNewsByRatio,
        top5AllByPageviews,
        top5ExSmartNewsByPageviews,
        popularSectionsAll,
        popularSectionsExSmartNews,
      },
      dailyStats,
      analysis: aiAnalysis,
    });
  } catch (error: any) {
    console.error('Traffic analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze traffic' },
      { status: 500 }
    );
  }
}

