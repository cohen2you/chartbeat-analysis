'use client';

import { TrendingUp, BarChart3 } from 'lucide-react';
import TrafficAnalysisChart from './TrafficAnalysisChart';

interface SectionData {
  name: string;
  totalPageviews: number;
  postCount: number;
  ratio?: number;
}

interface TrafficAnalysisResultsProps {
  rankings: {
    top5AllByRatio: SectionData[];
    top5ExSmartNewsByRatio: SectionData[];
    top5AllByPageviews: SectionData[];
    top5ExSmartNewsByPageviews: SectionData[];
    popularSectionsAll?: SectionData[];
    popularSectionsExSmartNews?: SectionData[];
  };
  dailyStats: Array<{
    date: string;
    traffic: number;
    postCount: number;
    sp500?: number;
  }>;
  analysis: {
    traffic_pattern_analysis?: string | string[];
    content_breadth_analysis?: string | string[];
  };
  isLoading: boolean;
  onGenerate: () => void;
}

// Helper function to format bullet points
function formatBulletPoints(text: string | string[] | undefined | null) {
  if (!text) return null;
  
  // Handle array of strings (if AI returns array)
  let textStr: string;
  if (Array.isArray(text)) {
    textStr = text.join('\n');
  } else if (typeof text === 'string') {
    textStr = text;
  } else {
    textStr = String(text);
  }
  
  if (!textStr || !textStr.trim()) return null;
  
  // Split by common bullet point markers
  const lines = textStr.split(/\n/).filter(line => line.trim());
  
  // Check if already formatted as bullet points
  const hasBullets = lines.some(line => 
    /^[-•*]\s/.test(line.trim()) || 
    /^\d+[.)]\s/.test(line.trim())
  );
  
  if (hasBullets) {
    // Already has bullets, just format them
    return (
      <ul className="list-disc list-inside space-y-2">
        {lines.map((line, idx) => {
          // Remove existing bullet markers and clean up
          const cleaned = line.replace(/^[-•*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
          return cleaned ? (
            <li key={idx} className="text-gray-700 dark:text-gray-300">
              {cleaned}
            </li>
          ) : null;
        })}
      </ul>
    );
  }
  
  // If no bullets, treat each line as a bullet point
  return (
    <ul className="list-disc list-inside space-y-2">
      {lines.map((line, idx) => (
        <li key={idx} className="text-gray-700 dark:text-gray-300">
          {line.trim()}
        </li>
      ))}
    </ul>
  );
}

export default function TrafficAnalysisResults({
  rankings,
  dailyStats,
  analysis,
  isLoading,
  onGenerate,
}: TrafficAnalysisResultsProps) {
  // Debug logging
  if (dailyStats) {
    console.log('TrafficAnalysisResults - dailyStats:', dailyStats);
    console.log('TrafficAnalysisResults - dailyStats.length:', dailyStats.length);
  }

  return (
    <div className="space-y-6">
      {/* Chart Section */}
      {dailyStats && dailyStats.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
          <TrafficAnalysisChart data={dailyStats} />
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            No date data available for chart. Please ensure your CSV includes a publish_date or date column.
          </p>
        </div>
      )}

      {/* Section Rankings - By Ratio */}
      {rankings && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 All Sections By Ratio */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Top 5 Sections (All Traffic) By Ratio
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Section</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Views</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Posts</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.top5AllByRatio.map((section, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {section.name}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.totalPageviews.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.postCount}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {section.ratio?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 5 Excluding SmartNews By Ratio */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Top 5 Sections (Excluding SmartNews) By Ratio
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Section</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Views</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Posts</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.top5ExSmartNewsByRatio.map((section, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {section.name}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.totalPageviews.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.postCount}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {section.ratio?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section Rankings - By Pageviews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 All Sections By Pageviews */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Top 5 Sections (All Traffic) By Pageviews
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Section</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Views</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Posts</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.top5AllByPageviews.map((section, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {section.name}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.totalPageviews.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.postCount}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {section.ratio?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 5 Excluding SmartNews By Pageviews */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6 text-orange-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Top 5 Sections (Excluding SmartNews) By Pageviews
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Section</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Views</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Posts</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.top5ExSmartNewsByPageviews.map((section, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {section.name}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.totalPageviews.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {section.postCount}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {section.ratio?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Popular Sections (Excluded from Top 5 By Pageviews) */}
          {(rankings.popularSectionsAll && rankings.popularSectionsAll.length > 0) || 
           (rankings.popularSectionsExSmartNews && rankings.popularSectionsExSmartNews.length > 0) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Popular Sections All Traffic */}
              {rankings.popularSectionsAll && rankings.popularSectionsAll.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-6 h-6 text-gray-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Popular Sections (All Traffic)
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    These popular sections are excluded from the Top 5 By Pageviews rankings above.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Section</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Views</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Posts</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Ratio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.popularSectionsAll.map((section, idx) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                              {section.name}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                              {section.totalPageviews.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                              {section.postCount}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                              {section.ratio?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Popular Sections Excluding SmartNews */}
              {rankings.popularSectionsExSmartNews && rankings.popularSectionsExSmartNews.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-6 h-6 text-gray-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Popular Sections (Excluding SmartNews)
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    These popular sections are excluded from the Top 5 By Pageviews rankings above.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Section</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Views</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Posts</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Ratio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.popularSectionsExSmartNews.map((section, idx) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                              {section.name}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                              {section.totalPageviews.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                              {section.postCount}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                              {section.ratio?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* AI Analysis Section */}
      {analysis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Traffic Pattern Analysis
            </h3>
          </div>
          <div className="space-y-6">
            {analysis.traffic_pattern_analysis && (
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Traffic Pattern
                </h4>
                <div className="text-gray-700 dark:text-gray-300 text-sm">
                  {formatBulletPoints(analysis.traffic_pattern_analysis)}
                </div>
              </div>
            )}
            {analysis.content_breadth_analysis && (
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Content Breadth & Section/Topic Analysis
                </h4>
                <div className="text-gray-700 dark:text-gray-300 text-sm">
                  {formatBulletPoints(analysis.content_breadth_analysis)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

