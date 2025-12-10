import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, generateSingleWriterData } from '@/lib/csvParser';
import { analyzeSingleWriter } from '@/lib/openai';
import { aiProvider, AIProvider } from '@/lib/aiProvider';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, fileNames, provider } = body;
    
    // Set provider if specified (with error handling)
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      try {
        aiProvider.setProvider(provider as AIProvider);
      } catch (error: any) {
        // If provider not available, log warning but continue with default
        console.warn(`Provider ${provider} not available:`, error.message);
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

    // Detect writer name from combined data
    const combinedData = {
      data: parsedDataArray.flatMap(d => d.data),
      headers: parsedDataArray[0]?.headers || [],
      fileName: parsedDataArray.map(d => d.fileName).filter(Boolean).join(', ') || undefined,
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

    // If multiple files, generate individual period data only (no combined analysis)
    if (parsedDataArray.length > 1) {
      const periodData = parsedDataArray.map((data, idx) => {
        // Process each CSV file completely independently
        const { data: fileData, headers } = data;
        
        // Filter to only this author's data from THIS file only
        const authorData = fileData.filter((row: any) => {
          const author = (row.author || row.Author || '').trim().toLowerCase();
          return author === writerName.toLowerCase();
        });
        
        // Filter out articles with 1 or fewer page views
        const filteredData = authorData.filter((row: any) => {
          const views = Number(row.page_views || row['page_views'] || 0);
          return views > 1;
        });
        
        // Generate writer data for this specific file
        const writerData = generateSingleWriterData(data, writerName);
        const timePeriod = extractTimePeriod(fileData);
        
        // Calculate stats for each period (deduplicate within this file)
        const hasTitleField = headers.some((h: string) => h.toLowerCase() === 'title');
        
        // Deduplicate articles for stats (same logic as generateSingleWriterData)
        const articleMap = new Map<string, any>();
        filteredData.forEach((row: any, index: number) => {
          const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
          const publishDate = row.publish_date || row.publish_date || '';
          if (hasTitleField && !title) return;
          
          let articleKey: string;
          if (title) {
            articleKey = title; // Use title as key for deduplication
          } else if (publishDate) {
            articleKey = `${publishDate}_${writerName}`;
          } else {
            articleKey = `article_${index}_${writerName}`;
          }
          
          // If article already exists, accumulate views (for multi-section articles)
          const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
          const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
          
          if (!articleMap.has(articleKey)) {
            articleMap.set(articleKey, {
              title: title || `Article from ${publishDate || 'Unknown Date'}`,
              page_views: 0,
            });
          }
          
          // Accumulate views for articles that appear multiple times (different sections)
          const article = articleMap.get(articleKey)!;
          article.page_views += views;
        });
        
        const articles = Array.from(articleMap.values());
        const totalViews = articles.reduce((sum, a) => sum + a.page_views, 0);
        const avgViewsPerPost = articles.length > 0 ? totalViews / articles.length : 0;
        const topArticles = articles.sort((a, b) => b.page_views - a.page_views).slice(0, 5);
        
        return {
          fileName: data.fileName || `File ${idx + 1}`,
          writerData,
          timePeriod: timePeriod.period,
          earliestDate: timePeriod.earliest,
          latestDate: timePeriod.latest,
          stats: {
            articleCount: articles.length,
            totalViews,
            avgViewsPerPost: Math.round(avgViewsPerPost),
            topArticles,
          },
        };
      });

      // Sort periods by earliest date to determine sequence
      const sortedPeriods = [...periodData].sort((a, b) => {
        if (a.earliestDate === 'Unknown' || b.earliestDate === 'Unknown') return 0;
        return a.earliestDate.localeCompare(b.earliestDate);
      });

      // Return minimal analysis with just key takeaways, no combined stats
      return NextResponse.json({
        success: true,
        analysis: {
          keyTakeaways: [
            `Analyzing ${parsedDataArray.length} separate time periods for ${writerName}`,
            `Click "Compare Periods" to see detailed comparison between periods`,
          ],
        },
        dataCount: parsedDataArray.length,
        fileNames: parsedDataArray.map(d => d.fileName).filter(Boolean),
        periods: sortedPeriods,
        writerName,
      });
    } else {
      // Single file - use existing logic
      const providerOverride = provider && (provider === 'openai' || provider === 'gemini') ? provider as AIProvider : undefined;
      const analysis = await analyzeSingleWriter(combinedData, providerOverride);
      const timePeriod = extractTimePeriod(combinedData.data);

      return NextResponse.json({
        success: true,
        analysis,
        dataCount: 1,
        fileNames: parsedDataArray.map(d => d.fileName).filter(Boolean),
        timePeriod: timePeriod.period,
        writerName,
      });
    }
  } catch (error: any) {
    console.error('Single writer analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze writer data' },
      { status: 500 }
    );
  }
}

