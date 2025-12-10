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
    authorComparisons?: string;
    overallSummary?: string;
    keyDifferences?: string;
    dataset1Stats?: string;
    dataset2Stats?: string;
  };
  deeperAnalysis?: {
    titleAnalysis?: string;
    subjectAnalysis?: string;
    temporalAnalysis?: string;
    strategicInsights?: string;
  };
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
      text += '=== COMPARISON ANALYSIS ===\n';
      if (data.comparison.overallSummary) {
        text += data.comparison.overallSummary + '\n\n';
      }
      if (data.comparison.authorComparisons) {
        text += data.comparison.authorComparisons + '\n\n';
      }
      if (data.comparison.keyDifferences) {
        text += data.comparison.keyDifferences + '\n\n';
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
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono">
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
                  {result.comparison.overallSummary && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Overall Summary</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                          {result.comparison.overallSummary}
                        </pre>
                      </div>
                    </div>
                  )}
                  {result.comparison.authorComparisons && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Author Comparisons</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                          {result.comparison.authorComparisons}
                        </pre>
                      </div>
                    </div>
                  )}
                  {result.comparison.keyDifferences && (
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Key Differences</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                          {result.comparison.keyDifferences}
                        </pre>
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



