import Papa from 'papaparse';

export interface ParsedCSV {
  data: any[];
  headers: string[];
  fileName?: string;
}

export function parseCSV(csvContent: string, fileName?: string): ParsedCSV {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => {
      // Try to convert numeric strings to numbers
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const num = Number(trimmed);
      return isNaN(num) ? trimmed : num;
    },
  });

  const headers = result.meta.fields || [];
  const data = result.data as any[];

  return {
    data,
    headers,
    fileName,
  };
}

export function getDataSummary(parsedData: ParsedCSV): string {
  const { data, headers } = parsedData;
  
  // Filter out articles with 1 or fewer page views
  const filteredData = data.filter((row: any) => {
    const views = Number(row.page_views || row['page_views'] || 0);
    return views > 1;
  });
  
  let summary = `=== DETAILED DATA ANALYSIS ===\n\n`;
  summary += `Total Records (after filtering): ${filteredData.length} (${data.length - filteredData.length} records with ≤1 views excluded)\n`;
  summary += `Columns: ${headers.join(', ')}\n\n`;
  
  // Check if title field exists
  const hasTitleField = headers.some(h => h.toLowerCase() === 'title');
  
  // Get unique articles (group by title if available, otherwise by date+author or just treat each row as an article)
  // Filter out rows with empty titles if title field exists (they're likely data quality issues)
  const articleMap = new Map<string, any>();
  filteredData.forEach((row, index) => {
    const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
    const author = row.author || row.Author || 'Unknown';
    const publishDate = row.publish_date || row.publish_date || '';
    
    // Skip rows with empty titles if title field exists (data quality issue)
    if (hasTitleField && !title) {
      return; // Skip this row - it's missing a title
    }
    
    // Create article identifier: use title if available, otherwise use date+author, or row index as fallback
    let articleKey: string;
    if (title) {
      articleKey = title;
    } else if (publishDate) {
      // Group by date+author (without index) so multiple rows on same date for same author are one article
      articleKey = `${publishDate}_${author}`;
    } else {
      articleKey = `article_${index}`;
    }
    
    if (!articleMap.has(articleKey)) {
      articleMap.set(articleKey, {
        title: title || `Article from ${publishDate || 'Unknown Date'}`,
        author,
        publish_date: publishDate,
        page_views: 0,
        page_uniques: 0,
        page_views_quality: 0,
        page_avg_time: Number(row.page_avg_time || row['page_avg_time'] || 0),
        sections: new Set<string>(),
        referrers: new Set<string>(),
        hasUniques: false,
        hasQualityViews: false,
        hasAvgTime: false,
      });
    }
    
    const article = articleMap.get(articleKey)!;
    // Get views value - handle both number (from Papa.parse transform) and string cases
    // Use nullish coalescing to properly handle 0 values
    const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
    const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
    const uniquesRaw = row.page_uniques ?? row['page_uniques'] ?? 0;
    const uniques = typeof uniquesRaw === 'number' ? uniquesRaw : (Number(uniquesRaw) || 0);
    const qualityViewsRaw = row.page_views_quality ?? row['page_views_quality'] ?? 0;
    const qualityViews = typeof qualityViewsRaw === 'number' ? qualityViewsRaw : (Number(qualityViewsRaw) || 0);
    const avgTimeRaw = row.page_avg_time ?? row['page_avg_time'] ?? 0;
    const avgTime = typeof avgTimeRaw === 'number' ? avgTimeRaw : (Number(avgTimeRaw) || 0);
    
    // Each article has a single total page view number repeated across multiple rows
    // (one row per section/referrer combination). Use MAX to get the single total value.
    // Since all rows for the same article have the same view count, MAX = that value.
    article.page_views = Math.max(article.page_views, views);
    article.page_uniques = Math.max(article.page_uniques, uniques);
    article.page_views_quality = Math.max(article.page_views_quality, qualityViews);
    if (row.section || row.Section) article.sections.add(row.section || row.Section);
    if (row.referrer || row.Referrer) article.referrers.add(row.referrer || row.Referrer);
    // Use max avg_time for the article
    if (avgTime > article.page_avg_time) article.page_avg_time = avgTime;
    
    // Track which columns exist
    if (!article.hasUniques && uniques > 0) article.hasUniques = true;
    if (!article.hasQualityViews && qualityViews > 0) article.hasQualityViews = true;
    if (!article.hasAvgTime && avgTime > 0) article.hasAvgTime = true;
  });
  
  const articles = Array.from(articleMap.values());
  const totalPageViews = articles.reduce((sum, a) => sum + a.page_views, 0);
  const totalUniques = articles.reduce((sum, a) => sum + a.page_uniques, 0);
  const totalQualityViews = articles.reduce((sum, a) => sum + a.page_views_quality, 0);
  
  // Check if columns exist in the data
  const hasUniquesColumn = articles.some(a => a.hasUniques);
  const hasQualityViewsColumn = articles.some(a => a.hasQualityViews);
  const hasAvgTimeColumn = articles.some(a => a.hasAvgTime);
  
  // Top Articles by Page Views
  summary += `=== TOP 10 ARTICLES BY PAGE VIEWS ===\n`;
  articles
    .sort((a, b) => b.page_views - a.page_views)
    .slice(0, 10)
    .forEach((article, idx) => {
      const pct = ((article.page_views / totalPageViews) * 100).toFixed(2);
      summary += `${idx + 1}. "${article.title}" by ${article.author}\n`;
      summary += `   Views: ${article.page_views.toLocaleString()} (${pct}% of total)\n`;
      summary += `   Uniques: ${article.page_uniques.toLocaleString()}\n`;
      summary += `   Quality Views: ${article.page_views_quality.toLocaleString()}\n`;
      summary += `   Avg Time: ${article.page_avg_time}s\n\n`;
    });
  
  // Top Articles by Uniques
  summary += `=== TOP 10 ARTICLES BY UNIQUE VISITORS ===\n`;
  articles
    .sort((a, b) => b.page_uniques - a.page_uniques)
    .slice(0, 10)
    .forEach((article, idx) => {
      const pct = ((article.page_uniques / totalUniques) * 100).toFixed(2);
      summary += `${idx + 1}. "${article.title}" by ${article.author}\n`;
      summary += `   Uniques: ${article.page_uniques.toLocaleString()} (${pct}% of total)\n`;
      summary += `   Views: ${article.page_views.toLocaleString()}\n`;
      if (hasQualityViewsColumn) {
        summary += `   Quality Views: ${article.page_views_quality.toLocaleString()}\n`;
      }
      summary += `\n`;
    });
  
  // Top Articles by Quality Views
  summary += `=== TOP 10 ARTICLES BY QUALITY VIEWS ===\n`;
  articles
    .sort((a, b) => b.page_views_quality - a.page_views_quality)
    .slice(0, 10)
    .forEach((article, idx) => {
      const pct = totalQualityViews > 0 ? ((article.page_views_quality / totalQualityViews) * 100).toFixed(2) : '0.00';
      summary += `${idx + 1}. "${article.title}" by ${article.author}\n`;
      summary += `   Quality Views: ${article.page_views_quality.toLocaleString()} (${pct}% of total)\n`;
      summary += `   Quality %: ${((article.page_views_quality / article.page_views) * 100).toFixed(1)}% of article views\n`;
      if (hasUniquesColumn) {
        summary += `   Uniques: ${article.page_uniques.toLocaleString()}\n`;
      }
      summary += `\n`;
    });
  
  // Author Performance (using filtered articles)
  const authorMap = new Map<string, { name: string; totalViews: number; totalUniques: number; articleCount: number; avgTime: number }>();
  articles.forEach(article => {
    const author = article.author;
    if (!authorMap.has(author)) {
      authorMap.set(author, { name: author, totalViews: 0, totalUniques: 0, articleCount: 0, avgTime: 0 });
    }
    const stats = authorMap.get(author)!;
    stats.totalViews += article.page_views;
    stats.totalUniques += article.page_uniques;
    stats.articleCount += 1;
    stats.avgTime = (stats.avgTime * (stats.articleCount - 1) + article.page_avg_time) / stats.articleCount;
  });
  
  summary += `=== AUTHOR PERFORMANCE ===\n`;
  Array.from(authorMap.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .forEach((author, idx) => {
      const viewsPct = ((author.totalViews / totalPageViews) * 100).toFixed(2);
      const uniquesPct = ((author.totalUniques / totalUniques) * 100).toFixed(2);
      summary += `${idx + 1}. ${author.name}\n`;
      summary += `   Total Views: ${author.totalViews.toLocaleString()} (${viewsPct}% of total)\n`;
      if (hasUniquesColumn && totalUniques > 0) {
        summary += `   Total Uniques: ${author.totalUniques.toLocaleString()} (${uniquesPct}% of total)\n`;
      }
      summary += `   Articles: ${author.articleCount}\n`;
      summary += `   Avg Views/Article: ${Math.round(author.totalViews / author.articleCount).toLocaleString()}\n`;
      if (hasAvgTimeColumn && author.avgTime > 0) {
        summary += `   Avg Time: ${Math.round(author.avgTime)}s\n`;
      }
      summary += `\n`;
    });
  
  // Author-specific article breakdown
  summary += `=== AUTHOR ARTICLE BREAKDOWN ===\n`;
  summary += `For each author, showing their most and least successful articles:\n\n`;
  
  Array.from(authorMap.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .forEach((authorStats) => {
      const authorArticles = articles
        .filter(a => a.author === authorStats.name)
        .sort((a, b) => b.page_views - a.page_views);
      
      if (authorArticles.length === 0) return;
      
      summary += `--- ${authorStats.name} ---\n`;
      summary += `Total Articles: ${authorArticles.length}\n`;
      summary += `Total Views: ${authorStats.totalViews.toLocaleString()}\n\n`;
      
      // Most successful articles (top 5)
      summary += `MOST SUCCESSFUL ARTICLES (Top ${Math.min(5, authorArticles.length)}):\n`;
      authorArticles.slice(0, Math.min(5, authorArticles.length)).forEach((article, idx) => {
        const pctOfAuthorTotal = ((article.page_views / authorStats.totalViews) * 100).toFixed(2);
        const pctOfOverall = ((article.page_views / totalPageViews) * 100).toFixed(2);
        const qualityPct = article.page_views > 0 ? ((article.page_views_quality / article.page_views) * 100).toFixed(1) : '0.0';
        summary += `${idx + 1}. "${article.title}"\n`;
        summary += `   Views: ${article.page_views.toLocaleString()} (${pctOfAuthorTotal}% of author's total, ${pctOfOverall}% of overall)\n`;
        summary += `   Uniques: ${article.page_uniques.toLocaleString()}\n`;
        summary += `   Quality Views: ${article.page_views_quality.toLocaleString()} (${qualityPct}% quality rate)\n`;
        summary += `   Avg Time: ${article.page_avg_time}s\n`;
        summary += `   Publish Date: ${article.publish_date}\n\n`;
      });
      
      // Least successful articles (bottom 5)
      if (authorArticles.length > 5) {
        summary += `LEAST SUCCESSFUL ARTICLES (Bottom ${Math.min(5, authorArticles.length - 5)}):\n`;
        authorArticles.slice(-Math.min(5, authorArticles.length)).reverse().forEach((article, idx) => {
          const pctOfAuthorTotal = ((article.page_views / authorStats.totalViews) * 100).toFixed(2);
          const pctOfOverall = ((article.page_views / totalPageViews) * 100).toFixed(2);
          const qualityPct = article.page_views > 0 ? ((article.page_views_quality / article.page_views) * 100).toFixed(1) : '0.0';
          summary += `${idx + 1}. "${article.title}"\n`;
          summary += `   Views: ${article.page_views.toLocaleString()} (${pctOfAuthorTotal}% of author's total, ${pctOfOverall}% of overall)\n`;
          summary += `   Uniques: ${article.page_uniques.toLocaleString()}\n`;
          summary += `   Quality Views: ${article.page_views_quality.toLocaleString()} (${qualityPct}% quality rate)\n`;
          summary += `   Avg Time: ${article.page_avg_time}s\n`;
          summary += `   Publish Date: ${article.publish_date}\n\n`;
        });
      }
      
      // Author statistics
      const topArticle = authorArticles[0];
      const bottomArticle = authorArticles[authorArticles.length - 1];
      const avgViews = authorStats.totalViews / authorArticles.length;
      summary += `AUTHOR STATISTICS:\n`;
      summary += `   Best Article: ${topArticle.page_views.toLocaleString()} views\n`;
      summary += `   Worst Article: ${bottomArticle.page_views.toLocaleString()} views\n`;
      summary += `   Performance Range: ${((topArticle.page_views / bottomArticle.page_views)).toFixed(1)}x difference\n`;
      summary += `   Articles Above Average: ${authorArticles.filter(a => a.page_views > avgViews).length} (${((authorArticles.filter(a => a.page_views > avgViews).length / authorArticles.length) * 100).toFixed(1)}%)\n`;
      summary += `   Articles Below Average: ${authorArticles.filter(a => a.page_views < avgViews).length} (${((authorArticles.filter(a => a.page_views < avgViews).length / authorArticles.length) * 100).toFixed(1)}%)\n\n`;
    });
  
  // Section Performance (using filtered data)
  const sectionMap = new Map<string, { name: string; totalViews: number; articleCount: number }>();
  filteredData.forEach(row => {
    const section = row.section || 'Unknown';
    const views = Number(row.page_views || 0);
    if (!sectionMap.has(section)) {
      sectionMap.set(section, { name: section, totalViews: 0, articleCount: 0 });
    }
    const stats = sectionMap.get(section)!;
    stats.totalViews += views;
    stats.articleCount += 1;
  });
  
  summary += `=== SECTION PERFORMANCE ===\n`;
  Array.from(sectionMap.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 15)
    .forEach((section, idx) => {
      const pct = ((section.totalViews / totalPageViews) * 100).toFixed(2);
      summary += `${idx + 1}. ${section.name}: ${section.totalViews.toLocaleString()} views (${pct}% of total), ${section.articleCount} articles\n`;
    });
  summary += `\n`;
  
  // Referrer Analysis (using filtered data)
  const referrerMap = new Map<string, { name: string; totalViews: number; articleCount: number }>();
  filteredData.forEach(row => {
    const referrer = row.referrer || 'Unknown';
    const views = Number(row.page_views || 0);
    if (!referrerMap.has(referrer)) {
      referrerMap.set(referrer, { name: referrer, totalViews: 0, articleCount: 0 });
    }
    const stats = referrerMap.get(referrer)!;
    stats.totalViews += views;
    stats.articleCount += 1;
  });
  
  summary += `=== TOP REFERRERS ===\n`;
  Array.from(referrerMap.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10)
    .forEach((ref, idx) => {
      const pct = ((ref.totalViews / totalPageViews) * 100).toFixed(2);
      summary += `${idx + 1}. ${ref.name}: ${ref.totalViews.toLocaleString()} views (${pct}% of total)\n`;
    });
  summary += `\n`;
  
  // Overall Statistics
  summary += `=== OVERALL STATISTICS ===\n`;
  summary += `Total Page Views: ${totalPageViews.toLocaleString()}\n`;
  summary += `Total Unique Visitors: ${totalUniques.toLocaleString()}\n`;
  summary += `Total Quality Views: ${totalQualityViews.toLocaleString()}\n`;
  summary += `Quality View Rate: ${((totalQualityViews / totalPageViews) * 100).toFixed(2)}%\n`;
  summary += `Unique Articles: ${articles.length}\n`;
  summary += `Unique Authors: ${authorMap.size}\n`;
  summary += `Unique Sections: ${sectionMap.size}\n`;
  summary += `Unique Referrers: ${referrerMap.size}\n`;
  
  const avgViewsPerArticle = totalPageViews / articles.length;
  const avgUniquesPerArticle = totalUniques / articles.length;
  summary += `Average Views per Article: ${Math.round(avgViewsPerArticle).toLocaleString()}\n`;
  summary += `Average Uniques per Article: ${Math.round(avgUniquesPerArticle).toLocaleString()}\n`;
  
  // Articles with 0 time
  const zeroTimeArticles = articles.filter(a => a.page_avg_time === 0).length;
  summary += `Articles with 0 avg time: ${zeroTimeArticles} (${((zeroTimeArticles / articles.length) * 100).toFixed(2)}%)\n`;
  
  return summary;
}

export interface WriterRanking {
  rank: number;
  name: string;
  totalViews: number;
  totalUniques: number;
  articleCount: number;
  avgViewsPerArticle: number;
  percentOfTotal: number;
  bestArticleViews: number;
  bestArticleTitle: string;
}

export function generateSingleWriterData(parsedData: ParsedCSV, authorName: string): string {
  const { data, headers } = parsedData;
  
  // Filter to only this author's data
  const authorData = data.filter((row: any) => {
    const author = (row.author || row.Author || '').trim().toLowerCase();
    return author === authorName.toLowerCase();
  });
  
  if (authorData.length === 0) {
    return `No data found for author: ${authorName}`;
  }
  
  // Filter out articles with 1 or fewer page views
  const filteredData = authorData.filter((row: any) => {
    const views = Number(row.page_views || row['page_views'] || 0);
    return views > 1;
  });
  
  const hasTitleField = headers.some(h => h.toLowerCase() === 'title');
  const hasSectionField = headers.some(h => h.toLowerCase() === 'section');
  const hasReferrerField = headers.some(h => h.toLowerCase() === 'referrer');
  
  // Deduplicate articles
  const articleMap = new Map<string, any>();
  filteredData.forEach((row, index) => {
    const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
    const publishDate = row.publish_date || row.publish_date || '';
    
    if (hasTitleField && !title) {
      return;
    }
    
    let articleKey: string;
    if (title) {
      articleKey = title;
    } else if (publishDate) {
      articleKey = `${publishDate}_${authorName}`;
    } else {
      articleKey = `article_${index}_${authorName}`;
    }
    
    if (!articleMap.has(articleKey)) {
      articleMap.set(articleKey, {
        title: title || `Article from ${publishDate || 'Unknown Date'}`,
        publish_date: publishDate,
        page_views: 0,
        page_uniques: 0,
        page_views_quality: 0,
        page_avg_time: Number(row.page_avg_time || row['page_avg_time'] || 0),
        sections: new Set<string>(),
        referrers: new Set<string>(),
        hasUniques: false,
        hasQualityViews: false,
        hasAvgTime: false,
      });
    }
    
    const article = articleMap.get(articleKey)!;
    const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
    const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
    const uniquesRaw = row.page_uniques ?? row['page_uniques'] ?? 0;
    const uniques = typeof uniquesRaw === 'number' ? uniquesRaw : (Number(uniquesRaw) || 0);
    const qualityViewsRaw = row.page_views_quality ?? row['page_views_quality'] ?? 0;
    const qualityViews = typeof qualityViewsRaw === 'number' ? qualityViewsRaw : (Number(qualityViewsRaw) || 0);
    const avgTimeRaw = row.page_avg_time ?? row['page_avg_time'] ?? 0;
    const avgTime = typeof avgTimeRaw === 'number' ? avgTimeRaw : (Number(avgTimeRaw) || 0);
    
    article.page_views += views;
    article.page_uniques += uniques;
    article.page_views_quality += qualityViews;
    if (row.section || row.Section) article.sections.add(row.section || row.Section);
    if (row.referrer || row.Referrer) article.referrers.add(row.referrer || row.Referrer);
    if (avgTime > article.page_avg_time) article.page_avg_time = avgTime;
    
    if (!article.hasUniques && uniques > 0) article.hasUniques = true;
    if (!article.hasQualityViews && qualityViews > 0) article.hasQualityViews = true;
    if (!article.hasAvgTime && avgTime > 0) article.hasAvgTime = true;
  });
  
  const articles = Array.from(articleMap.values());
  const totalPageViews = articles.reduce((sum, a) => sum + a.page_views, 0);
  const totalUniques = articles.reduce((sum, a) => sum + a.page_uniques, 0);
  const totalQualityViews = articles.reduce((sum, a) => sum + a.page_views_quality, 0);
  
  const hasUniquesColumn = articles.some(a => a.hasUniques);
  const hasQualityViewsColumn = articles.some(a => a.hasQualityViews);
  const hasAvgTimeColumn = articles.some(a => a.hasAvgTime);
  
  let summary = `=== SINGLE WRITER PERFORMANCE ANALYSIS ===\n\n`;
  summary += `Writer: ${authorName}\n`;
  summary += `Total Articles: ${articles.length}\n`;
  summary += `Total Page Views: ${totalPageViews.toLocaleString()}\n`;
  if (hasUniquesColumn) {
    summary += `Total Unique Visitors: ${totalUniques.toLocaleString()}\n`;
  }
  if (hasQualityViewsColumn) {
    summary += `Total Quality Views: ${totalQualityViews.toLocaleString()}\n`;
    summary += `Quality View Rate: ${((totalQualityViews / totalPageViews) * 100).toFixed(2)}%\n`;
  }
  summary += `Average Views per Article: ${Math.round(totalPageViews / articles.length).toLocaleString()}\n`;
  if (hasAvgTimeColumn) {
    const avgTime = articles.reduce((sum, a) => sum + a.page_avg_time, 0) / articles.length;
    summary += `Average Time on Page: ${Math.round(avgTime)}s\n`;
  }
  summary += `\n`;
  
  // Top performing articles
  summary += `=== TOP 10 ARTICLES BY PAGE VIEWS ===\n`;
  articles
    .sort((a, b) => b.page_views - a.page_views)
    .slice(0, 10)
    .forEach((article, idx) => {
      const pct = ((article.page_views / totalPageViews) * 100).toFixed(2);
      summary += `${idx + 1}. "${article.title}"\n`;
      summary += `   Views: ${article.page_views.toLocaleString()} (${pct}% of writer's total)\n`;
      if (hasUniquesColumn) {
        summary += `   Uniques: ${article.page_uniques.toLocaleString()}\n`;
      }
      if (hasQualityViewsColumn) {
        summary += `   Quality Views: ${article.page_views_quality.toLocaleString()}\n`;
        summary += `   Quality Rate: ${((article.page_views_quality / article.page_views) * 100).toFixed(1)}%\n`;
      }
      if (hasAvgTimeColumn) {
        summary += `   Avg Time: ${article.page_avg_time}s\n`;
      }
      summary += `   Publish Date: ${article.publish_date || 'N/A'}\n\n`;
    });
  
  // Bottom performing articles
  if (articles.length > 10) {
    summary += `=== BOTTOM 10 ARTICLES BY PAGE VIEWS ===\n`;
    articles
      .sort((a, b) => a.page_views - b.page_views)
      .slice(0, 10)
      .forEach((article, idx) => {
        const pct = ((article.page_views / totalPageViews) * 100).toFixed(2);
        summary += `${idx + 1}. "${article.title}"\n`;
        summary += `   Views: ${article.page_views.toLocaleString()} (${pct}% of writer's total)\n`;
        if (hasUniquesColumn) {
          summary += `   Uniques: ${article.page_uniques.toLocaleString()}\n`;
        }
        if (hasQualityViewsColumn) {
          summary += `   Quality Views: ${article.page_views_quality.toLocaleString()}\n`;
          summary += `   Quality Rate: ${((article.page_views_quality / article.page_views) * 100).toFixed(1)}%\n`;
        }
        if (hasAvgTimeColumn) {
          summary += `   Avg Time: ${article.page_avg_time}s\n`;
        }
        summary += `   Publish Date: ${article.publish_date || 'N/A'}\n\n`;
      });
  }
  
  // Performance over time
  summary += `=== PERFORMANCE OVER TIME ===\n`;
  const articlesByDate = articles
    .filter(a => a.publish_date)
    .sort((a, b) => a.publish_date.localeCompare(b.publish_date));
  
  if (articlesByDate.length > 0) {
    const firstDate = articlesByDate[0].publish_date;
    const lastDate = articlesByDate[articlesByDate.length - 1].publish_date;
    summary += `Date Range: ${firstDate} to ${lastDate}\n`;
    
    // Monthly breakdown
    const monthlyMap = new Map<string, { views: number; count: number }>();
    articlesByDate.forEach(article => {
      const month = article.publish_date.substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { views: 0, count: 0 });
      }
      const stats = monthlyMap.get(month)!;
      stats.views += article.page_views;
      stats.count += 1;
    });
    
    summary += `\nMonthly Breakdown:\n`;
    Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([month, stats]) => {
        summary += `  ${month}: ${stats.views.toLocaleString()} views, ${stats.count} articles, avg ${Math.round(stats.views / stats.count).toLocaleString()} views/article\n`;
      });
  }
  summary += `\n`;
  
  // Section performance
  if (hasSectionField) {
    summary += `=== SECTION PERFORMANCE ===\n`;
    const sectionMap = new Map<string, { views: number; count: number }>();
    articles.forEach(article => {
      article.sections.forEach((section: string) => {
        if (!sectionMap.has(section)) {
          sectionMap.set(section, { views: 0, count: 0 });
        }
        const stats = sectionMap.get(section)!;
        stats.views += article.page_views;
        stats.count += 1;
      });
    });
    
    Array.from(sectionMap.entries())
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .forEach(([section, stats], idx) => {
        const pct = ((stats.views / totalPageViews) * 100).toFixed(2);
        summary += `${idx + 1}. ${section}: ${stats.views.toLocaleString()} views (${pct}%), ${stats.count} articles\n`;
      });
    summary += `\n`;
  }
  
  // Referrer performance
  if (hasReferrerField) {
    summary += `=== TOP REFERRERS ===\n`;
    const referrerMap = new Map<string, { views: number; count: number }>();
    articles.forEach(article => {
      article.referrers.forEach((referrer: string) => {
        if (!referrerMap.has(referrer)) {
          referrerMap.set(referrer, { views: 0, count: 0 });
        }
        const stats = referrerMap.get(referrer)!;
        stats.views += article.page_views;
        stats.count += 1;
      });
    });
    
    Array.from(referrerMap.entries())
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .forEach(([referrer, stats], idx) => {
        const pct = ((stats.views / totalPageViews) * 100).toFixed(2);
        summary += `${idx + 1}. ${referrer}: ${stats.views.toLocaleString()} views (${pct}%), ${stats.count} articles\n`;
      });
    summary += `\n`;
  }
  
  // Performance consistency
  summary += `=== PERFORMANCE CONSISTENCY ===\n`;
  const avgViews = totalPageViews / articles.length;
  const aboveAvg = articles.filter(a => a.page_views > avgViews).length;
  const belowAvg = articles.filter(a => a.page_views < avgViews).length;
  const bestArticle = articles.sort((a, b) => b.page_views - a.page_views)[0];
  const worstArticle = articles.sort((a, b) => a.page_views - b.page_views)[0];
  
  summary += `Articles Above Average: ${aboveAvg} (${((aboveAvg / articles.length) * 100).toFixed(1)}%)\n`;
  summary += `Articles Below Average: ${belowAvg} (${((belowAvg / articles.length) * 100).toFixed(1)}%)\n`;
  summary += `Best Article: "${bestArticle.title}" - ${bestArticle.page_views.toLocaleString()} views\n`;
  summary += `Worst Article: "${worstArticle.title}" - ${worstArticle.page_views.toLocaleString()} views\n`;
  if (worstArticle.page_views > 0) {
    summary += `Performance Range: ${(bestArticle.page_views / worstArticle.page_views).toFixed(1)}x difference\n`;
  }
  
  return summary;
}

export function generateWriterRankings(parsedData: ParsedCSV): WriterRanking[] {
  const { data, headers } = parsedData;
  
  // Filter out articles with 1 or fewer page views
  const filteredData = data.filter((row: any) => {
    const views = Number(row.page_views || row['page_views'] || 0);
    return views > 1;
  });
  
  const hasTitleField = headers.some(h => h.toLowerCase() === 'title');
  
  // First, deduplicate articles by title (same logic as generateStatsByAuthor)
  // Use EXACT same key format and logic as generateStatsByAuthor for consistency
  const articleMap = new Map<string, any>();
  filteredData.forEach((row, index) => {
    const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
    const author = row.author || row.Author || 'Unknown';
    const publishDate = row.publish_date || row.publish_date || '';
    
    // Skip rows with empty titles if title field exists
    if (hasTitleField && !title) {
      return;
    }
    
    // Create article identifier - use EXACT same format as generateStatsByAuthor (line 741-749)
    let articleKey: string;
    if (title) {
      articleKey = title; // Same as generateStatsByAuthor - just use title
    } else if (publishDate) {
      articleKey = `${publishDate}_${author}`;
    } else {
      articleKey = `article_${index}`;
    }
    
    const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
    const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
    const uniquesRaw = row.page_uniques ?? row['page_uniques'] ?? 0;
    const uniques = typeof uniquesRaw === 'number' ? uniquesRaw : (Number(uniquesRaw) || 0);
    
    if (!articleMap.has(articleKey)) {
      articleMap.set(articleKey, {
        title: title || `Article from ${publishDate || 'Unknown Date'}`,
        author,
        views: 0,
        uniques: 0,
      });
    }
    
    // Each article has a single total page view number repeated across multiple rows
    // (one row per section/referrer combination). Use MAX to get the single total value.
    // Since all rows for the same article have the same view count, MAX = that value.
    const article = articleMap.get(articleKey)!;
    article.views = Math.max(article.views, views);
    article.uniques = Math.max(article.uniques, uniques);
  });
  
  const articles = Array.from(articleMap.values());
  
  // Build author map from deduplicated articles
  const authorMap = new Map<string, {
    name: string;
    totalViews: number;
    totalUniques: number;
    articleCount: number;
    articles: any[];
  }>();
  
  articles.forEach(article => {
    const author = article.author;
    
    if (!authorMap.has(author)) {
      authorMap.set(author, {
        name: author,
        totalViews: 0,
        totalUniques: 0,
        articleCount: 0,
        articles: [],
      });
    }
    
    const stats = authorMap.get(author)!;
    stats.totalViews += article.views;
    stats.totalUniques += article.uniques;
    stats.articleCount += 1;
    stats.articles.push({
      title: article.title,
      views: article.views,
    });
  });
  
  const totalPageViews = Array.from(authorMap.values()).reduce((sum, a) => sum + a.totalViews, 0);
  
  // Convert to rankings array and sort by total views
  const rankings: WriterRanking[] = Array.from(authorMap.values())
    .map(stats => {
      const bestArticle = stats.articles.sort((a, b) => b.views - a.views)[0];
      return {
        rank: 0, // Will be set after sorting
        name: stats.name,
        totalViews: stats.totalViews,
        totalUniques: stats.totalUniques,
        articleCount: stats.articleCount,
        avgViewsPerArticle: Math.round(stats.totalViews / stats.articleCount),
        percentOfTotal: (stats.totalViews / totalPageViews) * 100,
        bestArticleViews: bestArticle?.views || 0,
        bestArticleTitle: bestArticle?.title || 'N/A',
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews)
    .map((ranking, index) => ({
      ...ranking,
      rank: index + 1,
    }));
  
  return rankings;
}

export function generateStatsByAuthor(parsedData: ParsedCSV): string {
  const { data, headers } = parsedData;
  
  // Filter out articles with 1 or fewer page views
  const filteredData = data.filter((row: any) => {
    const views = Number(row.page_views || row['page_views'] || 0);
    return views > 1;
  });
  
  // Check which fields exist in the CSV
  const hasTitleField = headers.some(h => h.toLowerCase() === 'title');
  const hasSectionField = headers.some(h => h.toLowerCase() === 'section');
  const hasReferrerField = headers.some(h => h.toLowerCase() === 'referrer');
  
  // Get unique articles (group by title if available, otherwise by date+author or treat each row as an article)
  // Filter out rows with empty titles if title field exists (they're likely data quality issues)
  const articleMap = new Map<string, any>();
  filteredData.forEach((row, index) => {
    const title = hasTitleField ? (row.title || row.Title || '').trim() : '';
    const author = row.author || row.Author || 'Unknown';
    const publishDate = row.publish_date || row.publish_date || '';
    
    // Skip rows with empty titles if title field exists (data quality issue)
    if (hasTitleField && !title) {
      return; // Skip this row
    }
    
    // Create article identifier: use title if available, otherwise use date+author, or row index as fallback
    let articleKey: string;
    if (title) {
      articleKey = title;
    } else if (publishDate) {
      // Group by date+author (without index) so multiple rows on same date for same author are one article
      articleKey = `${publishDate}_${author}`;
    } else {
      articleKey = `article_${index}`;
    }
    
    if (!articleMap.has(articleKey)) {
      articleMap.set(articleKey, {
        title: title || `Article from ${publishDate || 'Unknown Date'}`,
        author,
        publish_date: publishDate,
        page_views: 0,
        page_uniques: 0,
        page_views_quality: 0,
        page_avg_time: Number(row.page_avg_time || row['page_avg_time'] || 0),
        sections: new Set<string>(),
        referrers: new Set<string>(),
        hasUniques: false,
        hasQualityViews: false,
        hasAvgTime: false,
      });
    }
    
    const article = articleMap.get(articleKey)!;
    // Get views value - handle both number (from Papa.parse transform) and string cases
    // Use nullish coalescing to properly handle 0 values
    const viewsRaw = row.page_views ?? row['page_views'] ?? 0;
    const views = typeof viewsRaw === 'number' ? viewsRaw : (Number(viewsRaw) || 0);
    const uniquesRaw = row.page_uniques ?? row['page_uniques'] ?? 0;
    const uniques = typeof uniquesRaw === 'number' ? uniquesRaw : (Number(uniquesRaw) || 0);
    const qualityViewsRaw = row.page_views_quality ?? row['page_views_quality'] ?? 0;
    const qualityViews = typeof qualityViewsRaw === 'number' ? qualityViewsRaw : (Number(qualityViewsRaw) || 0);
    const avgTimeRaw = row.page_avg_time ?? row['page_avg_time'] ?? 0;
    const avgTime = typeof avgTimeRaw === 'number' ? avgTimeRaw : (Number(avgTimeRaw) || 0);
    
    // Each article has a single total page view number repeated across multiple rows
    // (one row per section/referrer combination). Use MAX to get the single total value.
    // Since all rows for the same article have the same view count, MAX = that value.
    article.page_views = Math.max(article.page_views, views);
    article.page_uniques = Math.max(article.page_uniques, uniques);
    article.page_views_quality = Math.max(article.page_views_quality, qualityViews);
    
    if (row.section || row.Section) article.sections.add(row.section || row.Section);
    if (row.referrer || row.Referrer) article.referrers.add(row.referrer || row.Referrer);
    if (avgTime > article.page_avg_time) article.page_avg_time = avgTime;
    
    // Track which columns exist
    if (!article.hasUniques && uniques > 0) article.hasUniques = true;
    if (!article.hasQualityViews && qualityViews > 0) article.hasQualityViews = true;
    if (!article.hasAvgTime && avgTime > 0) article.hasAvgTime = true;
  });
  
  const articles = Array.from(articleMap.values());
  const totalPageViews = articles.reduce((sum, a) => sum + a.page_views, 0);
  const totalUniques = articles.reduce((sum, a) => sum + a.page_uniques, 0);
  const totalQualityViews = articles.reduce((sum, a) => sum + a.page_views_quality, 0);
  
  // Check if columns exist in the data
  const hasUniquesColumn = articles.some(a => a.hasUniques);
  const hasQualityViewsColumn = articles.some(a => a.hasQualityViews);
  const hasAvgTimeColumn = articles.some(a => a.hasAvgTime);
  
  // Build author map with all stats
  const authorMap = new Map<string, {
    name: string;
    articles: any[];
    totalViews: number;
    totalUniques: number;
    totalQualityViews: number;
    sections: Map<string, number>;
    referrers: Map<string, number>;
    publishDates: string[];
  }>();
  
  articles.forEach(article => {
    const author = article.author;
    if (!authorMap.has(author)) {
      authorMap.set(author, {
        name: author,
        articles: [],
        totalViews: 0,
        totalUniques: 0,
        totalQualityViews: 0,
        sections: new Map(),
        referrers: new Map(),
        publishDates: [],
      });
    }
    const stats = authorMap.get(author)!;
    stats.articles.push(article);
    stats.totalViews += article.page_views;
    stats.totalUniques += article.page_uniques;
    stats.totalQualityViews += article.page_views_quality;
    if (article.publish_date) stats.publishDates.push(article.publish_date);
    
    article.sections.forEach((section: string) => {
      const views = article.page_views;
      stats.sections.set(section, (stats.sections.get(section) || 0) + views);
    });
    
    article.referrers.forEach((referrer: string) => {
      const views = article.page_views;
      stats.referrers.set(referrer, (stats.referrers.get(referrer) || 0) + views);
    });
  });
  
  let statsOutput = `STATS BY AUTHOR\n`;
  statsOutput += `===============\n\n`;
  
  // Sort authors by total views
  const sortedAuthors = Array.from(authorMap.values())
    .sort((a, b) => b.totalViews - a.totalViews);
  
  sortedAuthors.forEach((authorStats, idx) => {
    // Sort articles by views (descending), then by publish date (ascending) for tie-breaking
    // This ensures that when multiple articles have the same view count, we consistently pick the earliest one as "worst"
    const articles = authorStats.articles.sort((a, b) => {
      if (b.page_views !== a.page_views) {
        return b.page_views - a.page_views; // Primary sort: views descending
      }
      // Tie-breaker: earlier publish date = worse (lower performance over time)
      const dateA = a.publish_date || '';
      const dateB = b.publish_date || '';
      return dateA.localeCompare(dateB); // Ascending date order
    });
    const articleCount = articles.length;
    const avgViews = authorStats.totalViews / articleCount;
    const avgUniques = authorStats.totalUniques / articleCount;
    const avgQualityRate = authorStats.totalViews > 0 
      ? ((authorStats.totalQualityViews / authorStats.totalViews) * 100).toFixed(2)
      : '0.00';
    const avgTime = articles.reduce((sum, a) => sum + a.page_avg_time, 0) / articleCount;
    
    const bestArticle = articles[0];
    const worstArticle = articles[articles.length - 1];
    const articlesAboveAvg = articles.filter(a => a.page_views > avgViews).length;
    const articlesBelowAvg = articles.filter(a => a.page_views < avgViews).length;
    
    // Top sections
    const topSections = Array.from(authorStats.sections.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Top referrers
    const topReferrers = Array.from(authorStats.referrers.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Date range
    const sortedDates = authorStats.publishDates
      .filter(d => d && d.trim() !== '')
      .sort();
    const earliestDate = sortedDates[0] || 'N/A';
    const latestDate = sortedDates[sortedDates.length - 1] || 'N/A';
    
    statsOutput += `=== ${authorStats.name.toUpperCase()} ===\n\n`;
    statsOutput += `Total Articles Published: ${articleCount}\n`;
    statsOutput += `Total Page Views: ${authorStats.totalViews.toLocaleString()} (${((authorStats.totalViews / totalPageViews) * 100).toFixed(2)}% of overall)\n`;
    
    if (hasUniquesColumn && totalUniques > 0) {
      statsOutput += `Total Unique Visitors: ${authorStats.totalUniques.toLocaleString()} (${((authorStats.totalUniques / totalUniques) * 100).toFixed(2)}% of overall)\n`;
      statsOutput += `Average Uniques per Article: ${Math.round(avgUniques).toLocaleString()}\n`;
    }
    
    if (hasQualityViewsColumn && totalQualityViews > 0) {
      statsOutput += `Total Quality Views: ${authorStats.totalQualityViews.toLocaleString()} (${((authorStats.totalQualityViews / totalQualityViews) * 100).toFixed(2)}% of overall)\n`;
      statsOutput += `Average Quality View Rate: ${avgQualityRate}%\n`;
    }
    
    statsOutput += `Average Views per Article: ${Math.round(avgViews).toLocaleString()}\n`;
    
    if (hasAvgTimeColumn && avgTime > 0) {
      statsOutput += `Average Time on Page: ${Math.round(avgTime)}s\n`;
    }
    
    statsOutput += `\n`;
    
    statsOutput += `Best Performing Article:\n`;
    statsOutput += `  Title: "${bestArticle.title}"\n`;
    statsOutput += `  Views: ${bestArticle.page_views.toLocaleString()}\n`;
    if (hasUniquesColumn) {
      statsOutput += `  Uniques: ${bestArticle.page_uniques.toLocaleString()}\n`;
    }
    if (hasQualityViewsColumn) {
      statsOutput += `  Quality Views: ${bestArticle.page_views_quality.toLocaleString()}\n`;
      const bestQualityRate = bestArticle.page_views > 0 
        ? ((bestArticle.page_views_quality / bestArticle.page_views) * 100).toFixed(1)
        : '0.0';
      statsOutput += `  Quality Rate: ${bestQualityRate}%\n`;
    }
    if (hasAvgTimeColumn) {
      statsOutput += `  Avg Time: ${bestArticle.page_avg_time}s\n`;
    }
    statsOutput += `  Publish Date: ${bestArticle.publish_date || 'N/A'}\n\n`;
    
    statsOutput += `Worst Performing Article:\n`;
    statsOutput += `  Title: "${worstArticle.title}"\n`;
    statsOutput += `  Views: ${worstArticle.page_views.toLocaleString()}\n`;
    if (hasUniquesColumn) {
      statsOutput += `  Uniques: ${worstArticle.page_uniques.toLocaleString()}\n`;
    }
    if (hasQualityViewsColumn) {
      statsOutput += `  Quality Views: ${worstArticle.page_views_quality.toLocaleString()}\n`;
      const worstQualityRate = worstArticle.page_views > 0 
        ? ((worstArticle.page_views_quality / worstArticle.page_views) * 100).toFixed(1)
        : '0.0';
      statsOutput += `  Quality Rate: ${worstQualityRate}%\n`;
    }
    if (hasAvgTimeColumn) {
      statsOutput += `  Avg Time: ${worstArticle.page_avg_time}s\n`;
    }
    statsOutput += `  Publish Date: ${worstArticle.publish_date || 'N/A'}\n\n`;
    
    statsOutput += `Performance Consistency:\n`;
    statsOutput += `  Articles Above Average: ${articlesAboveAvg} (${((articlesAboveAvg / articleCount) * 100).toFixed(1)}%)\n`;
    statsOutput += `  Articles Below Average: ${articlesBelowAvg} (${((articlesBelowAvg / articleCount) * 100).toFixed(1)}%)\n`;
    if (worstArticle.page_views > 0) {
      const performanceRange = (bestArticle.page_views / worstArticle.page_views).toFixed(1);
      statsOutput += `  Performance Range: ${performanceRange}x difference between best and worst\n`;
    }
    statsOutput += `\n`;
    
    // Only show sections if the column exists in the CSV
    if (hasSectionField && topSections.length > 0) {
      statsOutput += `Top Sections:\n`;
      topSections.forEach(([section, views], idx) => {
        const pct = ((views / authorStats.totalViews) * 100).toFixed(2);
        statsOutput += `  ${idx + 1}. ${section}: ${views.toLocaleString()} views (${pct}% of author's total)\n`;
      });
      statsOutput += `\n`;
    }
    
    // Only show referrers if the column exists in the CSV
    if (hasReferrerField && topReferrers.length > 0) {
      statsOutput += `Top Referrers:\n`;
      topReferrers.forEach(([referrer, views], idx) => {
        const pct = ((views / authorStats.totalViews) * 100).toFixed(2);
        statsOutput += `  ${idx + 1}. ${referrer}: ${views.toLocaleString()} views (${pct}% of author's total)\n`;
      });
      statsOutput += `\n`;
    }
    
    statsOutput += `Date Range:\n`;
    statsOutput += `  Earliest: ${earliestDate}\n`;
    statsOutput += `  Latest: ${latestDate}\n`;
    statsOutput += `\n`;
    statsOutput += `---\n\n`;
  });
  
  return statsOutput;
}

