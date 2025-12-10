'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingDown, Loader2 } from 'lucide-react';
import { parseCSV } from '@/lib/csvParser';

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

interface ArticleAnalysis {
  articleTitle: string;
  articleViews: number;
  analysis: string | string[];
  keyFactors: string[];
  recommendations: string[];
  comparisonToTopPerformers?: string | string[];
  referrerAnalysis?: string | string[];
}

interface ArticlePerformanceAnalyzerProps {
  csvData: string[];
  fileNames: string[];
  aiProvider: string;
}

export default function ArticlePerformanceAnalyzer({
  csvData,
  fileNames,
  aiProvider,
}: ArticlePerformanceAnalyzerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [lowPerformingArticles, setLowPerformingArticles] = useState<Article[]>([]);
  const [analysis, setAnalysis] = useState<ArticleAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLowPerformers, setShowLowPerformers] = useState(false);

  // Extract articles from CSV data
  useEffect(() => {
    if (csvData.length === 0) {
      setLowPerformingArticles([]);
      return;
    }

    setIsLoadingArticles(true);
    try {
      // Parse CSV data using the proper parser
      const allArticles: Article[] = [];
      const articleMap = new Map<string, Article>();
      
      csvData.forEach((csv, idx) => {
        const parsedData = parseCSV(csv, fileNames?.[idx]);
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

      // Sort by views ascending and take bottom 20
      const sorted = Array.from(articleMap.values()).sort((a, b) => a.page_views - b.page_views);
      setLowPerformingArticles(sorted.slice(0, 20));
    } catch (err) {
      console.error('Error extracting articles:', err);
      setError('Failed to extract articles from CSV data');
    } finally {
      setIsLoadingArticles(false);
    }
  }, [csvData, fileNames]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter an article title to search');
      return;
    }

    if (csvData.length === 0) {
      setError('Please upload CSV data first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch('/api/analyze-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData,
          fileNames,
          articleTitle: searchQuery.trim(),
          provider: aiProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze article');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setSelectedArticle(data.article);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze article');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectLowPerformer = async (article: Article) => {
    setSelectedArticle(article);
    setSearchQuery(article.title);
    setShowLowPerformers(false);
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch('/api/analyze-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData,
          fileNames,
          articleTitle: article.title,
          provider: aiProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze article');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze article');
    } finally {
      setIsLoading(false);
    }
  };

  if (csvData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-blue-600" />
          Article Performance Analyzer
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload CSV data to analyze why articles didn't perform well.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <TrendingDown className="w-6 h-6 text-blue-600" />
        Article Performance Analyzer
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Find out why an article didn't perform well by analyzing its headline, date, and comparing it to top performers.
      </p>

      {/* Search Section */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by article title..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>

        {/* Show Low Performers Button */}
        <button
          onClick={() => setShowLowPerformers(!showLowPerformers)}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
        >
          {showLowPerformers ? 'Hide' : 'Show'} Lowest Performing Articles
        </button>

        {/* Low Performers List */}
        {showLowPerformers && (
          <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
            {isLoadingArticles ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">Loading articles...</p>
              </div>
            ) : lowPerformingArticles.length === 0 ? (
              <p className="text-gray-500 text-sm">No articles found in CSV data.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select an article to analyze:
                </p>
                <div className="space-y-2">
                  {lowPerformingArticles.map((article, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectLowPerformer(article)}
                      className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                            {article.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {article.author} • {article.page_views.toLocaleString()} views
                            {article.publish_date && ` • ${article.publish_date}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && selectedArticle && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold mb-2">Analysis for:</h3>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {selectedArticle.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {selectedArticle.author} • {selectedArticle.page_views.toLocaleString()} views
              {selectedArticle.publish_date && ` • Published: ${selectedArticle.publish_date}`}
            </p>
          </div>

          <div className="space-y-4">
            {/* Key Factors */}
            {analysis.keyFactors && analysis.keyFactors.length > 0 && (
              <div>
                <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
                  Key Factors Affecting Performance:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                  {analysis.keyFactors.map((factor, idx) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detailed Analysis */}
            {analysis.analysis && (
              <div>
                <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
                  Detailed Analysis:
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  {Array.isArray(analysis.analysis) ? (
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      {analysis.analysis.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {analysis.analysis}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comparison to Top Performers */}
            {analysis.comparisonToTopPerformers && (
              <div>
                <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
                  Comparison to Top Performers:
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  {Array.isArray(analysis.comparisonToTopPerformers) ? (
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      {analysis.comparisonToTopPerformers.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {analysis.comparisonToTopPerformers}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Referrer Analysis */}
            {analysis.referrerAnalysis && (
              <div>
                <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
                  Referrer Performance Analysis:
                </h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  {Array.isArray(analysis.referrerAnalysis) ? (
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      {analysis.referrerAnalysis.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {analysis.referrerAnalysis}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
                  Recommendations for Future Articles:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

