'use client';

import { useState } from 'react';
import { X, Copy, Check, XCircle, Trophy } from 'lucide-react';

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

interface AnalysisResult {
  keyTakeaways: string[];
  recommendations?: string[];
  writerFeedback?: string;
  timePeriod?: string;
  statsByAuthor?: string;
  writerRankings?: WriterRanking[];
  individualStats?: string[];
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
  };
  meetingSummary?: string[];
}

interface FullAnalysisModalProps {
  result: AnalysisResult;
  isOpen: boolean;
  onClose: () => void;
  fileNames?: string[];
}

type RecommendationStatus = 'pending' | 'accepted' | 'rejected';

export default function FullAnalysisModal({
  result,
  isOpen,
  onClose,
  fileNames = []
}: FullAnalysisModalProps) {
  const [recommendationStatuses, setRecommendationStatuses] = useState<Record<number, RecommendationStatus>>({});
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const fullText = formatFullAnalysis(result);
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatFullAnalysis = (data: AnalysisResult): string => {
    let text = '=== CHARTBEAT ANALYSIS REPORT ===\n\n';
    
    if (fileNames.length > 0) {
      text += `Files Analyzed: ${fileNames.join(', ')}\n\n`;
    }

    text += '=== KEY TAKEAWAYS ===\n';
    data.keyTakeaways.forEach((takeaway, idx) => {
      text += `${idx + 1}. ${takeaway}\n`;
    });
    text += '\n';

    if (data.writerRankings && data.writerRankings.length > 0) {
      text += '=== WRITER RANKINGS BY TOTAL PAGEVIEWS ===\n';
      text += `${'Rank'.padEnd(6)}${'Writer'.padEnd(25)}${'Total Views'.padStart(15)}${'% of Total'.padStart(12)}${'Articles'.padStart(10)}${'Avg Views'.padStart(12)}\n`;
      text += '-'.repeat(80) + '\n';
      data.writerRankings.forEach((writer) => {
        const rankStr = writer.rank.toString().padEnd(6);
        const nameStr = (writer.name.length > 24 ? writer.name.substring(0, 21) + '...' : writer.name).padEnd(25);
        const viewsStr = writer.totalViews.toLocaleString().padStart(15);
        const pctStr = `${writer.percentOfTotal.toFixed(2)}%`.padStart(12);
        const articlesStr = writer.articleCount.toString().padStart(10);
        const avgStr = writer.avgViewsPerArticle.toLocaleString().padStart(12);
        text += `${rankStr}${nameStr}${viewsStr}${pctStr}${articlesStr}${avgStr}\n`;
      });
      text += '\n';
      
      // Add efficiency ranking
      text += '=== WRITER RANKINGS BY AVG VIEWS PER POST (EFFICIENCY) ===\n';
      text += `${'Rank'.padEnd(6)}${'Writer'.padEnd(25)}${'Avg Views/Post'.padStart(17)}${'Total Views'.padStart(15)}${'Articles'.padStart(10)}${'% of Total'.padStart(12)}\n`;
      text += '-'.repeat(85) + '\n';
      const sortedByEfficiency = [...data.writerRankings].sort((a, b) => b.avgViewsPerArticle - a.avgViewsPerArticle);
      sortedByEfficiency.forEach((writer, idx) => {
        const rankStr = (idx + 1).toString().padEnd(6);
        const nameStr = (writer.name.length > 24 ? writer.name.substring(0, 21) + '...' : writer.name).padEnd(25);
        const avgStr = writer.avgViewsPerArticle.toLocaleString().padStart(17);
        const viewsStr = writer.totalViews.toLocaleString().padStart(15);
        const articlesStr = writer.articleCount.toString().padStart(10);
        const pctStr = `${writer.percentOfTotal.toFixed(2)}%`.padStart(12);
        text += `${rankStr}${nameStr}${avgStr}${viewsStr}${articlesStr}${pctStr}\n`;
      });
      text += '\n';
    }

    if (data.statsByAuthor) {
      text += '=== STATS BY AUTHOR ===\n';
      text += data.statsByAuthor + '\n\n';
    }

    if (data.comparison) {
      text += '=== COMPARISON ANALYSIS ===\n\n';
      
      if (data.comparison.authorComparisons) {
        text += '--- Author-by-Author Comparison ---\n';
        if (Array.isArray(data.comparison.authorComparisons)) {
          data.comparison.authorComparisons.forEach((authorComp: any) => {
            text += `\n${authorComp.author || 'Unknown Author'}:\n`;
            if (Array.isArray(authorComp.bullets)) {
              authorComp.bullets.forEach((bullet: string) => {
                text += `  ${bullet.startsWith('•') ? bullet : `• ${bullet}`}\n`;
              });
            } else {
              text += `  ${authorComp.bullets || JSON.stringify(authorComp)}\n`;
            }
          });
        } else {
          text += data.comparison.authorComparisons + '\n';
        }
        text += '\n';
      }
      
      if (data.comparison.overallSummary) {
        text += '--- Overall Summary ---\n';
        if (Array.isArray(data.comparison.overallSummary)) {
          data.comparison.overallSummary.forEach((item: string) => {
            text += `  ${item.startsWith('•') ? item : `• ${item}`}\n`;
          });
        } else {
          text += data.comparison.overallSummary + '\n';
        }
        text += '\n';
      }
      
      if (data.comparison.keyDifferences) {
        text += '--- Key Differences ---\n';
        if (Array.isArray(data.comparison.keyDifferences)) {
          data.comparison.keyDifferences.forEach((item: string) => {
            text += `  ${item.startsWith('•') ? item : `• ${item}`}\n`;
          });
        } else {
          text += data.comparison.keyDifferences + '\n';
        }
        text += '\n';
      }
    }

    if (data.metricsComparison) {
      text += '=== METRICS COMPARISON (NON-AUTHOR) ===\n\n';
      
      if (data.metricsComparison.overallMetrics && data.metricsComparison.overallMetrics.length > 0) {
        text += '--- Overall Metrics ---\n';
        data.metricsComparison.overallMetrics.forEach((item: string) => {
          text += `  ${item.startsWith('•') ? item : `• ${item}`}\n`;
        });
        text += '\n';
      }
      
      if (data.metricsComparison.sectionComparison && data.metricsComparison.sectionComparison.length > 0) {
        text += '--- Section Performance Comparison ---\n';
        data.metricsComparison.sectionComparison.forEach((item: string) => {
          text += `  ${item.startsWith('•') ? item : `• ${item}`}\n`;
        });
        text += '\n';
      }
      
      if (data.metricsComparison.referrerComparison && data.metricsComparison.referrerComparison.length > 0) {
        text += '--- Referrer Performance Comparison ---\n';
        data.metricsComparison.referrerComparison.forEach((item: string) => {
          text += `  ${item.startsWith('•') ? item : `• ${item}`}\n`;
        });
        text += '\n';
      }
      
      if (data.metricsComparison.topArticlesComparison && data.metricsComparison.topArticlesComparison.length > 0) {
        text += '--- Top Articles Comparison ---\n';
        data.metricsComparison.topArticlesComparison.forEach((item: string) => {
          text += `  ${item.startsWith('•') ? item : `• ${item}`}\n`;
        });
        text += '\n';
      }
      
      if (data.metricsComparison.keyInsights && data.metricsComparison.keyInsights.length > 0) {
        text += '--- Key Insights ---\n';
        data.metricsComparison.keyInsights.forEach((item: string) => {
          text += `  ${item.startsWith('•') ? item : `• ${item}`}\n`;
        });
        text += '\n';
      }
    }

    if (data.deeperAnalysis) {
      text += '=== DEEPER ANALYSIS ===\n';
      if (data.deeperAnalysis.titleAnalysis) {
        text += 'Title Analysis:\n' + data.deeperAnalysis.titleAnalysis + '\n\n';
      }
      if (data.deeperAnalysis.subjectAnalysis) {
        text += 'Subject Analysis:\n' + data.deeperAnalysis.subjectAnalysis + '\n\n';
      }
      if (data.deeperAnalysis.temporalAnalysis) {
        text += 'Temporal Analysis:\n' + data.deeperAnalysis.temporalAnalysis + '\n\n';
      }
      if (data.deeperAnalysis.strategicInsights) {
        text += 'Strategic Insights:\n' + data.deeperAnalysis.strategicInsights + '\n\n';
      }
    }

    if (data.recommendations && data.recommendations.length > 0) {
      text += '=== RECOMMENDATIONS ===\n';
      data.recommendations.forEach((rec, idx) => {
        const status = recommendationStatuses[idx] || 'pending';
        const statusIcon = status === 'accepted' ? '✓' : status === 'rejected' ? '✗' : '○';
        text += `${statusIcon} ${idx + 1}. ${rec}\n`;
      });
      text += '\n';
    }

    if (data.meetingSummary && data.meetingSummary.length > 0) {
      text += '=== MEETING SUMMARY (10 KEY POINTS) ===\n';
      data.meetingSummary.forEach((point, idx) => {
        text += `${idx + 1}. ${point}\n`;
      });
      text += '\n';
    }

    return text;
  };

  const handleAccept = (index: number) => {
    setRecommendationStatuses(prev => ({
      ...prev,
      [index]: 'accepted'
    }));
  };

  const handleReject = (index: number) => {
    setRecommendationStatuses(prev => ({
      ...prev,
      [index]: 'rejected'
    }));
  };

  const handleReset = (index: number) => {
    setRecommendationStatuses(prev => {
      const newStatuses = { ...prev };
      delete newStatuses[index];
      return newStatuses;
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Full Analysis Report
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Key Takeaways */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Key Takeaways
                </h3>
                <ul className="space-y-2">
                  {result.keyTakeaways.map((takeaway, idx) => (
                    <li key={idx} className="text-gray-700 dark:text-gray-300">
                      {idx + 1}. {takeaway}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Writer Rankings by Total Views */}
              {result.writerRankings && result.writerRankings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Writer Rankings by Total Pageviews
                    </h3>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300 dark:border-gray-600">
                          <th className="text-left py-2 px-2 font-semibold">Rank</th>
                          <th className="text-left py-2 px-2 font-semibold">Writer</th>
                          <th className="text-right py-2 px-2 font-semibold">Total Views</th>
                          <th className="text-right py-2 px-2 font-semibold">% of Total</th>
                          <th className="text-right py-2 px-2 font-semibold">Articles</th>
                          <th className="text-right py-2 px-2 font-semibold">Avg Views</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {result.writerRankings.map((writer, idx) => (
                          <tr 
                            key={idx} 
                            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{writer.rank}</td>
                            <td className="py-2 px-2 text-gray-900 dark:text-gray-100 font-semibold">{writer.name}</td>
                            <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{writer.totalViews.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{writer.percentOfTotal.toFixed(2)}%</td>
                            <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{writer.articleCount}</td>
                            <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{writer.avgViewsPerArticle.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Writer Rankings by Avg Views per Post */}
              {result.writerRankings && result.writerRankings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Writer Rankings by Avg Views per Post <span className="text-sm text-gray-600 dark:text-gray-400">(Efficiency)</span>
                    </h3>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300 dark:border-gray-600">
                          <th className="text-left py-2 px-2 font-semibold">Rank</th>
                          <th className="text-left py-2 px-2 font-semibold">Writer</th>
                          <th className="text-right py-2 px-2 font-semibold">Avg Views/Post</th>
                          <th className="text-right py-2 px-2 font-semibold">Total Views</th>
                          <th className="text-right py-2 px-2 font-semibold">Articles</th>
                          <th className="text-right py-2 px-2 font-semibold">% of Total</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {[...result.writerRankings]
                          .sort((a, b) => b.avgViewsPerArticle - a.avgViewsPerArticle)
                          .map((writer, idx) => (
                            <tr 
                              key={idx} 
                              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{idx + 1}</td>
                              <td className="py-2 px-2 text-gray-900 dark:text-gray-100 font-semibold">{writer.name}</td>
                              <td className="py-2 px-2 text-right text-emerald-700 dark:text-emerald-400 font-bold">{writer.avgViewsPerArticle.toLocaleString()}</td>
                              <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{writer.totalViews.toLocaleString()}</td>
                              <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{writer.articleCount}</td>
                              <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{writer.percentOfTotal.toFixed(2)}%</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Stats By Author */}
              {result.statsByAuthor && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Stats By Author
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono max-h-96 overflow-y-auto pr-2">
                      {result.statsByAuthor}
                    </pre>
                  </div>
                </div>
              )}

              {/* Comparison Analysis */}
              {result.comparison && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Comparison Analysis
                  </h3>
                  {result.comparison.authorComparisons && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Author Comparisons</h4>
                      <div className="space-y-3">
                        {Array.isArray(result.comparison.authorComparisons) ? (
                          result.comparison.authorComparisons.map((authorComp: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                              <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {authorComp.author || `Author ${idx + 1}`}
                              </h5>
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
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {result.comparison.authorComparisons}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <pre className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                              {JSON.stringify(result.comparison.authorComparisons, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {result.comparison.overallSummary && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Overall Summary</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
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
                    </div>
                  )}
                  {result.comparison.keyDifferences && (
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Key Differences</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
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
                    </div>
                  )}
                </div>
              )}

              {/* Metrics Comparison */}
              {result.metricsComparison && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Metrics Comparison (Non-Author)
                  </h3>
                  {result.metricsComparison.overallMetrics && result.metricsComparison.overallMetrics.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Overall Metrics</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <ul className="space-y-2 ml-4">
                          {result.metricsComparison.overallMetrics.map((item: string, idx: number) => (
                            <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                              {item.startsWith('•') ? item : `• ${item}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {result.metricsComparison.sectionComparison && result.metricsComparison.sectionComparison.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Section Performance Comparison</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <ul className="space-y-2 ml-4">
                          {result.metricsComparison.sectionComparison.map((item: string, idx: number) => (
                            <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                              {item.startsWith('•') ? item : `• ${item}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {result.metricsComparison.referrerComparison && result.metricsComparison.referrerComparison.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Referrer Performance Comparison</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <ul className="space-y-2 ml-4">
                          {result.metricsComparison.referrerComparison.map((item: string, idx: number) => (
                            <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                              {item.startsWith('•') ? item : `• ${item}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {result.metricsComparison.topArticlesComparison && result.metricsComparison.topArticlesComparison.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Top Articles Comparison</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <ul className="space-y-2 ml-4">
                          {result.metricsComparison.topArticlesComparison.map((item: string, idx: number) => (
                            <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                              {item.startsWith('•') ? item : `• ${item}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {result.metricsComparison.keyInsights && result.metricsComparison.keyInsights.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Key Insights</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <ul className="space-y-2 ml-4">
                          {result.metricsComparison.keyInsights.map((item: string, idx: number) => (
                            <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">
                              {item.startsWith('•') ? item : `• ${item}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Deeper Analysis */}
              {result.deeperAnalysis && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Deeper Analysis
                  </h3>
                  {result.deeperAnalysis.titleAnalysis && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Title Analysis</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {result.deeperAnalysis.titleAnalysis.split(/•/).filter(line => line.trim()).map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {result.deeperAnalysis.subjectAnalysis && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Subject Analysis</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {result.deeperAnalysis.subjectAnalysis.split(/•/).filter(line => line.trim()).map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {result.deeperAnalysis.temporalAnalysis && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Temporal Analysis</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {result.deeperAnalysis.temporalAnalysis.split(/•/).filter(line => line.trim()).map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {result.deeperAnalysis.strategicInsights && (
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Strategic Insights</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {result.deeperAnalysis.strategicInsights.split(/•/).filter(line => line.trim()).map((line: string, idx: number) => (
                            <div key={idx} className="mb-2 flex items-start gap-2">
                              <span className="text-indigo-500 mt-1 flex-shrink-0">•</span>
                              <span className="flex-1">{line.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Meeting Summary */}
              {result.meetingSummary && result.meetingSummary.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="text-purple-600 dark:text-purple-400">📊</span>
                    Meeting Summary
                    <span className="text-sm font-normal text-gray-600 dark:text-gray-400">(10 Key Points)</span>
                  </h3>
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
                </div>
              )}
            </div>
          </div>

          {/* Writer Feedback / Recommendations Section */}
          {result.writerFeedback ? (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Writer Feedback
                </h3>
                {result.timePeriod && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {result.timePeriod}
                  </span>
                )}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="prose dark:prose-invert max-w-none">
                  <div className="text-gray-800 dark:text-gray-200 whitespace-pre-line text-sm leading-relaxed">
                    {result.writerFeedback.split('\n').map((line: string, idx: number) => {
                      if (line.trim() === '') {
                        return <div key={idx} className="mb-3"></div>;
                      }
                      if (line.trim().startsWith('===') || (line.trim().length > 0 && line.trim() === line.trim().toUpperCase() && line.trim().length < 50)) {
                        return (
                          <div key={idx} className="font-semibold text-gray-900 dark:text-gray-100 text-base mt-6 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                            {line.trim().replace(/===/g, '').trim()}
                          </div>
                        );
                      }
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
            </div>
          ) : result.recommendations && result.recommendations.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Changes & Recommendations
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {result.recommendations.map((recommendation, index) => {
                  const status = recommendationStatuses[index] || 'pending';
                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        status === 'accepted'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                          : status === 'rejected'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="flex-1 text-gray-700 dark:text-gray-300">
                          {recommendation}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleAccept(index)}
                                className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                title="Accept"
                              >
                                <Check className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleReject(index)}
                                className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          {(status === 'accepted' || status === 'rejected') && (
                            <button
                              onClick={() => handleReset(index)}
                              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      {status !== 'pending' && (
                        <div className={`mt-2 text-sm font-medium ${
                          status === 'accepted' 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {status === 'accepted' ? '✓ Accepted' : '✗ Rejected'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



