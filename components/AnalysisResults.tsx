'use client';

import { useState } from 'react';
import { CheckCircle2, TrendingUp, BarChart3, Trophy, Award, Medal, Presentation } from 'lucide-react';

interface WriterRanking {
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

interface PeriodData {
  fileName: string;
  writerData: string;
  timePeriod: string;
  earliestDate: string;
  latestDate: string;
  stats?: {
    articleCount: number;
    totalViews: number;
    avgViewsPerPost: number;
    topArticles: Array<{ title: string; page_views: number }>;
  };
}

interface AnalysisResult {
  keyTakeaways: string[];
  recommendations?: string[];
  writerFeedback?: string;
  timePeriod?: string;
  periods?: PeriodData[];
  writerName?: string;
  statsByAuthor?: string;
  writerRankings?: WriterRanking[];
  individualStats?: string[]; // For comparison mode (2 files)
  periodComparison?: {
    performanceTrends?: string;
    storyTypeAnalysis?: string;
    headlineAnalysis?: string;
    contentChanges?: string;
    sequentialAnalysis?: string;
    keyInsights?: string;
    recommendations?: string;
  };
  comparison?: {
    authorComparisons?: string | Array<{ author: string; bullets: string[] }>;
    overallSummary?: string | string[];
    keyDifferences?: string | string[];
    dataset1Stats?: string;
    dataset2Stats?: string;
  };
  metricsComparison?: {
    overallMetrics?: string[];
    sectionComparison?: string[];
    referrerComparison?: string[];
    topArticlesComparison?: string[];
    keyInsights?: string[];
  };
  deeperAnalysis?: {
    titleAnalysis?: string;
    subjectAnalysis?: string;
    temporalAnalysis?: string;
    strategicInsights?: string;
    // Single writer mode fields
    viewsPerPostAnalysis?: string;
    contentStrategyInsights?: string;
    performanceTrends?: string;
    actionableRecommendations?: string;
  };
  meetingSummary?: string[];
}

interface AnalysisResultsProps {
  result: AnalysisResult;
  isLoading?: boolean;
  onGenerateRecommendations?: () => void;
  isLoadingRecommendations?: boolean;
  onGenerateDeeperAnalysis?: () => void;
  isLoadingDeeperAnalysis?: boolean;
  onGenerateComparison?: () => void;
  isLoadingComparison?: boolean;
  onComparePeriods?: () => void;
  isLoadingPeriodComparison?: boolean;
  onGenerateMetricsComparison?: () => void;
  isLoadingMetricsComparison?: boolean;
  onGenerateMeetingSummary?: () => void;
  isLoadingMeetingSummary?: boolean;
  fileCount?: number;
  fileNames?: string[];
  analysisMode?: 'team' | 'single-writer' | null;
}

export default function AnalysisResults({ 
  result, 
  isLoading, 
  onGenerateRecommendations,
  isLoadingRecommendations,
  onGenerateDeeperAnalysis,
  isLoadingDeeperAnalysis,
  onGenerateComparison,
  isLoadingComparison,
  onComparePeriods,
  isLoadingPeriodComparison,
  onGenerateMetricsComparison,
  isLoadingMetricsComparison,
  onGenerateMeetingSummary,
  isLoadingMeetingSummary,
  fileCount = 1,
  fileNames = [],
  analysisMode = null
}: AnalysisResultsProps) {
  const isComparisonMode = fileCount === 2 && analysisMode === 'team';
  const isSingleWriterMode = analysisMode === 'single-writer';
  const hasMultiplePeriods = isSingleWriterMode && result.periods && result.periods.length > 1;
  const [viewMode, setViewMode] = useState<'combined' | 'comparison'>('combined');
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comparison Mode Header with Toggle */}
      {isComparisonMode && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Comparison Mode
              </h3>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-lg p-1 border border-blue-200 dark:border-blue-600">
              <button
                onClick={() => setViewMode('combined')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'combined'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                Combined
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'comparison'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                Side-by-Side
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Dataset 1:</span>
              <span className="ml-2 text-blue-700 dark:text-blue-300">{fileNames[0] || 'File 1'}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Dataset 2:</span>
              <span className="ml-2 text-blue-700 dark:text-blue-300">{fileNames[1] || 'File 2'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Key Takeaways */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isSingleWriterMode 
              ? 'Writer Performance Takeaways' 
              : isComparisonMode 
                ? 'Key Takeaways (Comparison)' 
                : 'Key Takeaways'}
          </h2>
        </div>
        <ul className="space-y-2">
          {result.keyTakeaways.map((takeaway, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">•</span>
              <span className="text-gray-700 dark:text-gray-300">{takeaway}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Writer Rankings by Total Pageviews - Only show for team mode */}
      {!isSingleWriterMode && result.writerRankings && result.writerRankings.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-6 border-2 border-amber-200 dark:border-amber-800 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Writer Rankings by Total Pageviews
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-amber-300 dark:border-amber-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Writer</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Total Views</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">% of Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Articles</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Avg Views/Article</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Best Article</th>
                </tr>
              </thead>
              <tbody>
                {result.writerRankings.map((writer, index) => {
                  // Determine medal icon for top 3
                  let RankIcon = null;
                  let rankColor = '';
                  if (writer.rank === 1) {
                    RankIcon = Trophy;
                    rankColor = 'text-yellow-500';
                  } else if (writer.rank === 2) {
                    RankIcon = Medal;
                    rankColor = 'text-gray-400';
                  } else if (writer.rank === 3) {
                    RankIcon = Award;
                    rankColor = 'text-amber-700';
                  }
                  
                  return (
                    <tr 
                      key={index} 
                      className={`border-b border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors ${
                        writer.rank <= 3 ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {RankIcon ? (
                            <RankIcon className={`w-5 h-5 ${rankColor}`} />
                          ) : (
                            <span className="text-gray-600 dark:text-gray-400 font-medium">{writer.rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-900 dark:text-gray-100">
                        {writer.name}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-900 dark:text-gray-100">
                        {writer.totalViews.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                        {writer.percentOfTotal.toFixed(2)}%
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                        {writer.articleCount}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                        {writer.avgViewsPerArticle.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate" title={writer.bestArticleTitle}>
                        {writer.bestArticleTitle}
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({writer.bestArticleViews.toLocaleString()} views)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Summary Stats */}
          <div className="mt-6 pt-4 border-t border-amber-300 dark:border-amber-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {result.writerRankings.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Writers</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {result.writerRankings.reduce((sum, w) => sum + w.totalViews, 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Pageviews</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {result.writerRankings.reduce((sum, w) => sum + w.articleCount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Articles</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Writer Rankings by Average Views per Post - Only show for team mode */}
      {!isSingleWriterMode && result.writerRankings && result.writerRankings.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-6 border-2 border-emerald-200 dark:border-emerald-800 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Writer Rankings by Avg Views per Post
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">(Efficiency)</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-emerald-300 dark:border-emerald-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Writer</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Avg Views/Post</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Total Views</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Articles</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">% of Total</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">Best Article</th>
                </tr>
              </thead>
              <tbody>
                {[...result.writerRankings]
                  .sort((a, b) => b.avgViewsPerArticle - a.avgViewsPerArticle)
                  .map((writer, index) => {
                    const efficiencyRank = index + 1;
                    // Determine medal icon for top 3
                    let RankIcon = null;
                    let rankColor = '';
                    if (efficiencyRank === 1) {
                      RankIcon = Trophy;
                      rankColor = 'text-emerald-500';
                    } else if (efficiencyRank === 2) {
                      RankIcon = Medal;
                      rankColor = 'text-gray-400';
                    } else if (efficiencyRank === 3) {
                      RankIcon = Award;
                      rankColor = 'text-teal-600';
                    }
                    
                    return (
                      <tr 
                        key={index} 
                        className={`border-b border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors ${
                          efficiencyRank <= 3 ? 'bg-emerald-100 dark:bg-emerald-900/20' : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {RankIcon ? (
                              <RankIcon className={`w-5 h-5 ${rankColor}`} />
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400 font-medium">{efficiencyRank}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-gray-900 dark:text-gray-100">
                          {writer.name}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
                          {writer.avgViewsPerArticle.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                          {writer.totalViews.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                          {writer.articleCount}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                          {writer.percentOfTotal.toFixed(2)}%
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate" title={writer.bestArticleTitle}>
                          {writer.bestArticleTitle}
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({writer.bestArticleViews.toLocaleString()} views)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          
          {/* Efficiency Stats */}
          <div className="mt-6 pt-4 border-t border-emerald-300 dark:border-emerald-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.round(result.writerRankings.reduce((sum, w) => sum + w.avgViewsPerArticle, 0) / result.writerRankings.length).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Overall Avg Views/Post</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.max(...result.writerRankings.map(w => w.avgViewsPerArticle)).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Highest Avg Views/Post</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.min(...result.writerRankings.map(w => w.avgViewsPerArticle)).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Lowest Avg Views/Post</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Comparison - Side by Side (Single Writer Multiple Files) */}
      {isSingleWriterMode && result.periods && result.periods.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Performance by Period
              </h2>
            </div>
            {!result.periodComparison && onComparePeriods && (
              <button
                onClick={onComparePeriods}
                disabled={isLoadingPeriodComparison}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                {isLoadingPeriodComparison ? 'Comparing...' : 'Compare Periods'}
              </button>
            )}
          </div>
          
          {/* Check for date overlap warning */}
          {result.periods.length === 2 && (() => {
            const period1 = result.periods[0];
            const period2 = result.periods[1];
            const hasOverlap = period1.earliestDate !== 'Unknown' && period2.earliestDate !== 'Unknown' &&
                              period1.latestDate !== 'Unknown' && period2.latestDate !== 'Unknown' &&
                              period1.latestDate >= period2.earliestDate;
            
            return hasOverlap ? (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> These periods have overlapping date ranges. Articles published during the overlap period ({period2.earliestDate} to {period1.latestDate}) will appear in both files.
                </p>
              </div>
            ) : null;
          })()}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {result.periods.map((period, idx) => (
              <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="mb-4 pb-3 border-b border-gray-300 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Period {idx + 1}: {period.fileName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {period.timePeriod}
                  </p>
                  {period.stats && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {period.stats.articleCount}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Articles</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {period.stats.totalViews.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Total Views</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {period.stats.avgViewsPerPost.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Avg/Post</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line font-mono text-xs max-h-96 overflow-y-auto">
                    {period.writerData}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Period Comparison Results */}
      {isSingleWriterMode && result.periods && result.periods.length > 1 && result.periodComparison && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Period Comparison Analysis
            </h2>
          </div>
          
          {isLoadingPeriodComparison ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {result.periodComparison.performanceTrends && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Performance Trends
                  </h3>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {typeof result.periodComparison.performanceTrends === 'string' 
                      ? result.periodComparison.performanceTrends.split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : <div className="font-mono text-xs">{JSON.stringify(result.periodComparison.performanceTrends, null, 2)}</div>}
                  </div>
                </div>
              )}
              
              {result.periodComparison.storyTypeAnalysis && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Story Type Performance Analysis
                  </h3>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {typeof result.periodComparison.storyTypeAnalysis === 'string' 
                      ? result.periodComparison.storyTypeAnalysis.split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : <div className="font-mono text-xs">{JSON.stringify(result.periodComparison.storyTypeAnalysis, null, 2)}</div>}
                  </div>
                </div>
              )}
              
              {result.periodComparison.headlineAnalysis && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Headline Pattern Analysis
                  </h3>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {typeof result.periodComparison.headlineAnalysis === 'string' 
                      ? result.periodComparison.headlineAnalysis.split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : <div className="font-mono text-xs">{JSON.stringify(result.periodComparison.headlineAnalysis, null, 2)}</div>}
                  </div>
                </div>
              )}
              
              {result.periodComparison.contentChanges && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Content Changes
                  </h3>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {typeof result.periodComparison.contentChanges === 'string' 
                      ? result.periodComparison.contentChanges.split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : <div className="font-mono text-xs">{JSON.stringify(result.periodComparison.contentChanges, null, 2)}</div>}
                  </div>
                </div>
              )}
              
              {result.periodComparison.sequentialAnalysis && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Sequential Analysis
                  </h3>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {typeof result.periodComparison.sequentialAnalysis === 'string' 
                      ? result.periodComparison.sequentialAnalysis.split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : <div className="font-mono text-xs">{JSON.stringify(result.periodComparison.sequentialAnalysis, null, 2)}</div>}
                  </div>
                </div>
              )}
              
              {result.periodComparison.keyInsights && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Key Insights
                  </h3>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {typeof result.periodComparison.keyInsights === 'string' 
                      ? result.periodComparison.keyInsights.split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : <div className="font-mono text-xs">{JSON.stringify(result.periodComparison.keyInsights, null, 2)}</div>}
                  </div>
                </div>
              )}
              
              {result.periodComparison.recommendations && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Recommendations
                  </h3>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {typeof result.periodComparison.recommendations === 'string' 
                      ? result.periodComparison.recommendations.split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : <div className="font-mono text-xs">{JSON.stringify(result.periodComparison.recommendations, null, 2)}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats By Author - Only show if not multiple periods (multiple periods show separately above) */}
      {result.statsByAuthor && !hasMultiplePeriods && (
        <>
          {/* Combined View */}
          {(!isComparisonMode || viewMode === 'combined') && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6 text-indigo-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {isSingleWriterMode 
                    ? 'Detailed Writer Performance Analysis' 
                    : isComparisonMode 
                      ? 'Stats By Author (Combined)' 
                      : 'Stats By Author'}
                </h2>
              </div>
              <div className="prose dark:prose-invert max-w-none">
                <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line font-mono text-sm max-h-96 overflow-y-auto pr-2">
                  {typeof result.statsByAuthor === 'string' 
                    ? result.statsByAuthor 
                    : JSON.stringify(result.statsByAuthor, null, 2)}
                </div>
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison View */}
          {isComparisonMode && viewMode === 'comparison' && result.individualStats && result.individualStats.length === 2 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6 text-indigo-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Stats By Author (Side-by-Side Comparison)
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {result.individualStats.map((stats, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                      {fileNames[idx] || `Dataset ${idx + 1}`}
                    </h3>
                    <div className="prose dark:prose-invert max-w-none">
                      <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line font-mono text-xs max-h-96 overflow-y-auto pr-2">
                        {typeof stats === 'string' 
                          ? stats 
                          : JSON.stringify(stats, null, 2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Comparison Analysis (for 2 files) - Only show for team mode */}
      {isComparisonMode && !isSingleWriterMode && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Dataset Comparison Analysis
              </h2>
            </div>
            {!result.comparison && onGenerateComparison && (
              <button
                onClick={onGenerateComparison}
                disabled={isLoadingComparison}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                {isLoadingComparison ? 'Generating...' : 'Generate Comparison Analysis'}
              </button>
            )}
          </div>
          
          {isLoadingComparison ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
            </div>
          ) : result.comparison ? (
            <div className="space-y-6">
              {result.comparison.authorComparisons && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Author-by-Author Comparison
                  </h3>
                  <div className="space-y-4">
                    {Array.isArray(result.comparison.authorComparisons) ? (
                      result.comparison.authorComparisons.map((authorComp: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {authorComp.author || `Author ${idx + 1}`}
                          </h4>
                          <ul className="space-y-1.5 ml-4">
                            {Array.isArray(authorComp.bullets) ? (
                              authorComp.bullets.map((bullet: string, bulletIdx: number) => (
                                <li key={bulletIdx} className="text-gray-700 dark:text-gray-300 text-sm">
                                  {bullet.startsWith('•') ? bullet : `• ${bullet}`}
                                </li>
                              ))
                            ) : (
                              <li className="text-gray-700 dark:text-gray-300 text-sm">
                                {typeof authorComp.bullets === 'string' ? authorComp.bullets : JSON.stringify(authorComp)}
                              </li>
                            )}
                          </ul>
                        </div>
                      ))
                    ) : typeof result.comparison.authorComparisons === 'string' ? (
                      <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line text-sm">
                        {result.comparison.authorComparisons}
                      </div>
                    ) : (
                      <div className="text-gray-700 dark:text-gray-300 text-sm font-mono">
                        {JSON.stringify(result.comparison.authorComparisons, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {result.comparison.overallSummary && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Overall Comparison Summary
                  </h3>
                  <ul className="space-y-2 ml-4">
                    {Array.isArray(result.comparison.overallSummary) ? (
                      result.comparison.overallSummary.map((item: string, idx: number) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                          {item.startsWith('•') ? item : `• ${item}`}
                        </li>
                      ))
                    ) : typeof result.comparison.overallSummary === 'string' ? (
                      result.comparison.overallSummary.split('\n').map((line: string, idx: number) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                          {line.trim() ? (line.trim().startsWith('•') ? line.trim() : `• ${line.trim()}`) : null}
                        </li>
                      )).filter(Boolean)
                    ) : (
                      <li className="text-gray-700 dark:text-gray-300 text-sm font-mono">
                        {JSON.stringify(result.comparison.overallSummary, null, 2)}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {result.comparison.keyDifferences && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Key Differences
                  </h3>
                  <ul className="space-y-2 ml-4">
                    {Array.isArray(result.comparison.keyDifferences) ? (
                      result.comparison.keyDifferences.map((item: string, idx: number) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                          {item.startsWith('•') ? item : `• ${item}`}
                        </li>
                      ))
                    ) : typeof result.comparison.keyDifferences === 'string' ? (
                      result.comparison.keyDifferences.split('\n').map((line: string, idx: number) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                          {line.trim() ? (line.trim().startsWith('•') ? line.trim() : `• ${line.trim()}`) : null}
                        </li>
                      )).filter(Boolean)
                    ) : (
                      <li className="text-gray-700 dark:text-gray-300 text-sm font-mono">
                        {JSON.stringify(result.comparison.keyDifferences, null, 2)}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Click "Generate Comparison Analysis" to get detailed author-by-author comparisons between the two datasets.
            </p>
          )}
        </div>
      )}

      {/* Metrics Comparison (for 2 files) - Only show for team mode */}
      {isComparisonMode && !isSingleWriterMode && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Metrics Comparison (Non-Author)
              </h2>
            </div>
            {!result.metricsComparison && onGenerateMetricsComparison && (
              <button
                onClick={onGenerateMetricsComparison}
                disabled={isLoadingMetricsComparison}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                {isLoadingMetricsComparison ? 'Generating...' : 'Compare Metrics'}
              </button>
            )}
          </div>
          
          {isLoadingMetricsComparison ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
            </div>
          ) : result.metricsComparison ? (
            <div className="space-y-6">
              {result.metricsComparison.overallMetrics && result.metricsComparison.overallMetrics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Overall Metrics
                  </h3>
                  <ul className="space-y-2 ml-4">
                    {result.metricsComparison.overallMetrics.map((item: string, idx: number) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                        {item.startsWith('•') ? item : `• ${item}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.metricsComparison.sectionComparison && result.metricsComparison.sectionComparison.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Section Performance Comparison
                  </h3>
                  <ul className="space-y-2 ml-4">
                    {result.metricsComparison.sectionComparison.map((item: string, idx: number) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                        {item.startsWith('•') ? item : `• ${item}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.metricsComparison.referrerComparison && result.metricsComparison.referrerComparison.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Referrer Performance Comparison
                  </h3>
                  <ul className="space-y-2 ml-4">
                    {result.metricsComparison.referrerComparison.map((item: string, idx: number) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                        {item.startsWith('•') ? item : `• ${item}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.metricsComparison.topArticlesComparison && result.metricsComparison.topArticlesComparison.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Top Articles Comparison
                  </h3>
                  <ul className="space-y-2 ml-4">
                    {result.metricsComparison.topArticlesComparison.map((item: string, idx: number) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                        {item.startsWith('•') ? item : `• ${item}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.metricsComparison.keyInsights && result.metricsComparison.keyInsights.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    Key Insights
                  </h3>
                  <ul className="space-y-2 ml-4">
                    {result.metricsComparison.keyInsights.map((item: string, idx: number) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                        {item.startsWith('•') ? item : `• ${item}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Click "Compare Metrics" to analyze non-author metrics like sections, referrers, top articles, and overall pageviews between the two datasets.
            </p>
          )}
        </div>
      )}

      {/* Deeper Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {isSingleWriterMode ? 'Performance Deep Dive' : 'Deeper Analysis'}
            </h2>
          </div>
          {!result.deeperAnalysis && onGenerateDeeperAnalysis && (
            <button
              onClick={onGenerateDeeperAnalysis}
              disabled={isLoadingDeeperAnalysis}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              {isLoadingDeeperAnalysis ? 'Analyzing...' : 'Generate Deeper Analysis'}
            </button>
          )}
        </div>
        
        {isLoadingDeeperAnalysis ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
        ) : result.deeperAnalysis ? (
          <div className="prose dark:prose-invert max-w-none">
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line text-sm space-y-6">
              {isSingleWriterMode ? (
                // Single Writer Mode - New Format
                <>
                  {result.deeperAnalysis.viewsPerPostAnalysis && (
                    <div>
                      <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                        === VIEWS PER POST PERFORMANCE ANALYSIS ===
                      </div>
                      <div className="pl-2">
                        {typeof result.deeperAnalysis.viewsPerPostAnalysis === 'string' 
                          ? result.deeperAnalysis.viewsPerPostAnalysis
                              .split(/•/)
                              .filter(line => line.trim())
                              .map((line: string, idx: number) => (
                                <div key={idx} className="mb-2 flex items-start gap-2">
                                  <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                                  <span className="flex-1">{line.trim()}</span>
                                </div>
                              ))
                          : JSON.stringify(result.deeperAnalysis.viewsPerPostAnalysis, null, 2)}
                      </div>
                    </div>
                  )}
                  {result.deeperAnalysis.contentStrategyInsights && (
                    <div>
                      <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                        === CONTENT STRATEGY INSIGHTS ===
                      </div>
                      <div className="pl-2">
                        {typeof result.deeperAnalysis.contentStrategyInsights === 'string' 
                          ? result.deeperAnalysis.contentStrategyInsights
                              .split(/•/)
                              .filter(line => line.trim())
                              .map((line: string, idx: number) => (
                                <div key={idx} className="mb-2 flex items-start gap-2">
                                  <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                                  <span className="flex-1">{line.trim()}</span>
                                </div>
                              ))
                          : JSON.stringify(result.deeperAnalysis.contentStrategyInsights, null, 2)}
                      </div>
                    </div>
                  )}
                  {result.deeperAnalysis.performanceTrends && (
                    <div>
                      <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                        === PERFORMANCE TRENDS & PATTERNS ===
                      </div>
                      <div className="pl-2">
                        {typeof result.deeperAnalysis.performanceTrends === 'string' 
                          ? result.deeperAnalysis.performanceTrends
                              .split(/•/)
                              .filter(line => line.trim())
                              .map((line: string, idx: number) => (
                                <div key={idx} className="mb-2 flex items-start gap-2">
                                  <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                                  <span className="flex-1">{line.trim()}</span>
                                </div>
                              ))
                          : JSON.stringify(result.deeperAnalysis.performanceTrends, null, 2)}
                      </div>
                    </div>
                  )}
                  {result.deeperAnalysis.actionableRecommendations && (
                    <div>
                      <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                        === ACTIONABLE RECOMMENDATIONS ===
                      </div>
                      <div className="pl-2">
                        {typeof result.deeperAnalysis.actionableRecommendations === 'string' 
                          ? result.deeperAnalysis.actionableRecommendations
                              .split(/•/)
                              .filter(line => line.trim())
                              .map((line: string, idx: number) => (
                                <div key={idx} className="mb-2 flex items-start gap-2">
                                  <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                                  <span className="flex-1">{line.trim()}</span>
                                </div>
                              ))
                          : JSON.stringify(result.deeperAnalysis.actionableRecommendations, null, 2)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Team Mode - Original Format
                <>
              {result.deeperAnalysis.titleAnalysis && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    === TITLE ANALYSIS ===
                  </div>
                  <div className="pl-2">
                    {typeof result.deeperAnalysis.titleAnalysis === 'string' 
                      ? result.deeperAnalysis.titleAnalysis
                          .split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : JSON.stringify(result.deeperAnalysis.titleAnalysis, null, 2)}
                  </div>
                </div>
              )}
              {result.deeperAnalysis.subjectAnalysis && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    === SUBJECT MATTER ANALYSIS ===
                  </div>
                  <div className="pl-2">
                    {typeof result.deeperAnalysis.subjectAnalysis === 'string' 
                      ? result.deeperAnalysis.subjectAnalysis
                          .split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : JSON.stringify(result.deeperAnalysis.subjectAnalysis, null, 2)}
                  </div>
                </div>
              )}
              {result.deeperAnalysis.temporalAnalysis && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    === TEMPORAL PATTERNS ===
                  </div>
                  <div className="pl-2">
                    {typeof result.deeperAnalysis.temporalAnalysis === 'string' 
                      ? result.deeperAnalysis.temporalAnalysis
                          .split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : JSON.stringify(result.deeperAnalysis.temporalAnalysis, null, 2)}
                  </div>
                </div>
              )}
              {result.deeperAnalysis.strategicInsights && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                    === STRATEGIC INSIGHTS ===
                  </div>
                  <div className="pl-2">
                    {typeof result.deeperAnalysis.strategicInsights === 'string' 
                      ? result.deeperAnalysis.strategicInsights
                          .split(/•/)
                          .filter(line => line.trim())
                          .map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))
                      : JSON.stringify(result.deeperAnalysis.strategicInsights, null, 2)}
                  </div>
                </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isSingleWriterMode 
              ? 'Click "Generate Deeper Analysis" to get detailed insights on views per post performance, content strategy patterns, and actionable recommendations based on your specific data.'
              : 'Click "Generate Deeper Analysis" to get detailed insights on article titles, subjects, publication dates, and content performance patterns.'}
          </p>
        )}
      </div>

      {/* Recommendations / Writer Feedback */}
      {isSingleWriterMode ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Writer Feedback
              </h2>
              {result.timePeriod && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  ({result.timePeriod})
                </span>
              )}
            </div>
            {!result.writerFeedback && onGenerateRecommendations && (
              <button
                onClick={onGenerateRecommendations}
                disabled={isLoadingRecommendations}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                {isLoadingRecommendations ? 'Generating...' : 'Generate Writer Feedback'}
              </button>
            )}
          </div>
          
          {isLoadingRecommendations ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
            </div>
          ) : result.writerFeedback ? (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="prose dark:prose-invert max-w-none">
                <div className="text-gray-800 dark:text-gray-200 whitespace-pre-line text-sm leading-relaxed">
                  {result.writerFeedback.split('\n').map((line: string, idx: number) => {
                    // Format as email-style
                    if (line.trim() === '') {
                      return <div key={idx} className="mb-3"></div>;
                    }
                    // Check if it's a heading (all caps or starts with ===)
                    if (line.trim().startsWith('===') || (line.trim().length > 0 && line.trim() === line.trim().toUpperCase() && line.trim().length < 50)) {
                      return (
                        <div key={idx} className="font-semibold text-gray-900 dark:text-gray-100 text-base mt-6 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                          {line.trim().replace(/===/g, '').trim()}
                        </div>
                      );
                    }
                    // Check if it's a bullet point
                    if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\d+\./)) {
                      return (
                        <div key={idx} className="flex items-start gap-3 mb-2">
                          <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                          <span className="flex-1">{line.trim().replace(/^[•\-\d+\.]\s*/, '')}</span>
                        </div>
                      );
                    }
                    // Regular paragraph - convert markdown bold to actual bold
                    const formatBold = (text: string) => {
                      const parts: (string | JSX.Element)[] = [];
                      const boldRegex = /\*\*(.+?)\*\*/g;
                      let lastIndex = 0;
                      let match;
                      let key = 0;
                      
                      while ((match = boldRegex.exec(text)) !== null) {
                        // Add text before the match
                        if (match.index > lastIndex) {
                          parts.push(text.substring(lastIndex, match.index));
                        }
                        // Add bold text
                        parts.push(<strong key={key++} className="font-semibold text-gray-900 dark:text-gray-100">{match[1]}</strong>);
                        lastIndex = match.index + match[0].length;
                      }
                      // Add remaining text
                      if (lastIndex < text.length) {
                        parts.push(text.substring(lastIndex));
                      }
                      
                      return parts.length > 0 ? parts : [text];
                    };
                    
                    return (
                      <div key={idx} className="mb-3">
                        {formatBold(line)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Click "Generate Writer Feedback" to receive an email-style performance review highlighting your successes, underperforming content, and focus areas for the upcoming period.
            </p>
          )}
        </div>
      ) : (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Recommendations
            </h2>
          </div>
          {!result.recommendations && onGenerateRecommendations && (
            <button
              onClick={onGenerateRecommendations}
              disabled={isLoadingRecommendations}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              {isLoadingRecommendations ? 'Generating...' : 'Generate Recommendations'}
            </button>
          )}
        </div>
        
        {isLoadingRecommendations ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
        ) : result.recommendations && result.recommendations.length > 0 ? (
          <ul className="space-y-2">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-green-500 mt-1">→</span>
                <span className="text-gray-700 dark:text-gray-300">{rec}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Click "Generate Recommendations" to get data-driven recommendations based on successful vs unsuccessful content analysis.
          </p>
        )}
      </div>
      )}

      {/* Meeting Summary Section */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Presentation className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Meeting Summary
            </h2>
            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">
              10 Key Points
            </span>
          </div>
          {onGenerateMeetingSummary && (
            <button
              onClick={onGenerateMeetingSummary}
              disabled={isLoadingMeetingSummary}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm shadow-sm"
            >
              {isLoadingMeetingSummary ? 'Regenerating...' : result.meetingSummary ? 'Regenerate Summary' : 'Generate Summary'}
            </button>
          )}
        </div>
        
        {isLoadingMeetingSummary ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
        ) : result.meetingSummary && result.meetingSummary.length > 0 ? (
          <ol className="space-y-3">
            {result.meetingSummary.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                  {index + 1}
                </span>
                <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{point}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Click "Generate Summary" to create a concise 10-bullet-point executive summary synthesizing all analysis data, perfect for meeting presentations.
          </p>
        )}
      </div>
    </div>
  );
}

