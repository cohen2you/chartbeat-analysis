'use client';

import { useState, useCallback, useEffect } from 'react';
import CSVInput from '@/components/CSVInput';
import AnalysisResults from '@/components/AnalysisResults';
import FullAnalysisModal from '@/components/FullAnalysisModal';
import ArticlePerformanceAnalyzer from '@/components/ArticlePerformanceAnalyzer';
import { Sparkles } from 'lucide-react';

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
  periodComparison?: {
    performanceTrends?: string;
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

export default function Home() {
  const [csvData, setCsvData] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>('openai');
  const [isLoadingSingleWriter, setIsLoadingSingleWriter] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isLoadingDeeperAnalysis, setIsLoadingDeeperAnalysis] = useState(false);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [isLoadingPeriodComparison, setIsLoadingPeriodComparison] = useState(false);
  const [isLoadingMetricsComparison, setIsLoadingMetricsComparison] = useState(false);
  const [isLoadingMeetingSummary, setIsLoadingMeetingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'team' | 'single-writer' | null>(null);

  useEffect(() => {
    // Fetch current AI provider on mount
    fetch('/api/ai-provider')
      .then(res => res.json())
      .then(data => {
        if (data.provider) {
          setAiProvider(data.provider);
        }
      })
      .catch(err => console.error('Failed to fetch AI provider:', err));
  }, []);

  const handleDataChange = useCallback((data: string[], names: string[]) => {
    setCsvData(data);
    setFileNames(names);
    setAnalysis(null);
    setError(null);
  }, []);

  const handleAnalyzeTeam = async () => {
    if (csvData.length === 0 || csvData.every(d => d.trim() === '')) {
      setError('Please provide at least one CSV dataset to analyze.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setAnalysisMode('team');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          fileNames,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze data');
      }

      setAnalysis(result.analysis);
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeSingleWriter = async () => {
    if (csvData.length === 0 || csvData.every(d => d.trim() === '')) {
      setError('Please provide at least one CSV dataset to analyze.');
      return;
    }

    setIsLoadingSingleWriter(true);
    setError(null);
    setAnalysis(null);
    setAnalysisMode('single-writer');

    try {
      const response = await fetch('/api/analyze-writer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          fileNames,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze writer data');
      }

      // Merge analysis with periods and other metadata
      setAnalysis({
        ...result.analysis,
        periods: result.periods,
        writerName: result.writerName,
        timePeriod: result.timePeriod,
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the writer data.');
    } finally {
      setIsLoadingSingleWriter(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (csvData.length === 0 || csvData.every(d => d.trim() === '')) {
      setError('Please provide at least one CSV dataset to analyze.');
      return;
    }

    setIsLoadingRecommendations(true);
    setError(null);

    try {
      // Use different API endpoint for single writer mode
      const apiEndpoint = analysisMode === 'single-writer' 
        ? '/api/writer-feedback'
        : '/api/recommendations';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          fileNames,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate feedback');
      }

      // Update analysis with recommendations or writer feedback
      if (analysis) {
        if (analysisMode === 'single-writer') {
          setAnalysis({
            ...analysis,
            writerFeedback: result.writerFeedback || '',
            timePeriod: result.timePeriod || '',
          });
        } else {
          setAnalysis({
            ...analysis,
            recommendations: result.recommendations || [],
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating feedback.');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleGenerateDeeperAnalysis = async () => {
    if (csvData.length === 0 || csvData.every(d => d.trim() === '')) {
      setError('Please provide at least one CSV dataset to analyze.');
      return;
    }

    setIsLoadingDeeperAnalysis(true);
    setError(null);

    try {
      // Use different API endpoint for single writer mode
      const apiEndpoint = analysisMode === 'single-writer' 
        ? '/api/deeper-analysis-writer'
        : '/api/deeper-analysis';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          fileNames,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate deeper analysis');
      }

      // Update analysis with deeper analysis
      if (analysis) {
        setAnalysis({
          ...analysis,
          deeperAnalysis: result.deeperAnalysis || {},
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating deeper analysis.');
    } finally {
      setIsLoadingDeeperAnalysis(false);
    }
  };

  const handleGenerateComparison = async () => {
    if (csvData.length !== 2) {
      setError('Comparison analysis requires exactly 2 CSV files.');
      return;
    }

    setIsLoadingComparison(true);
    setError(null);

    try {
      const response = await fetch('/api/comparison', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          fileNames,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate comparison');
      }

      // Update analysis with comparison
      if (analysis) {
        setAnalysis({
          ...analysis,
          comparison: result.comparison || {},
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating comparison.');
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleComparePeriods = async () => {
    if (csvData.length < 2) {
      setError('Period comparison requires at least 2 CSV files.');
      return;
    }

    setIsLoadingPeriodComparison(true);
    setError(null);

    try {
      const response = await fetch('/api/compare-writer-periods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          fileNames,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to compare periods');
      }

      // Update analysis with period comparison
      if (analysis) {
        setAnalysis({
          ...analysis,
          periodComparison: result.comparison || {},
          periods: result.periods || analysis.periods,
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while comparing periods.');
    } finally {
      setIsLoadingPeriodComparison(false);
    }
  };

  const handleGenerateMetricsComparison = async () => {
    if (csvData.length !== 2) {
      setError('Metrics comparison requires exactly 2 CSV files.');
      return;
    }

    setIsLoadingMetricsComparison(true);
    setError(null);

    try {
      const response = await fetch('/api/metrics-comparison', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          fileNames,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate metrics comparison');
      }

      // Update analysis with metrics comparison
      if (analysis) {
        setAnalysis({
          ...analysis,
          metricsComparison: result.metricsComparison || {},
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating metrics comparison.');
    } finally {
      setIsLoadingMetricsComparison(false);
    }
  };

  const handleGenerateMeetingSummary = async () => {
    if (!analysis) {
      setError('Please run an analysis first.');
      return;
    }

    setIsLoadingMeetingSummary(true);
    setError(null);

    try {
      const response = await fetch('/api/meeting-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate meeting summary');
      }

      // Update analysis with meeting summary
      setAnalysis({
        ...analysis,
        meetingSummary: result.meetingSummary || [],
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating meeting summary.');
    } finally {
      setIsLoadingMeetingSummary(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Chartbeat Analysis
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Analyze CSV data and get AI-powered key takeaways for editorial insights
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            CSV Data: {csvData.length} dataset(s) loaded
          </p>
        </div>

        {/* CSV Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Input Data
            </h2>
            <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Provider:</label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  setAiProvider(newProvider);
                  // Update provider on server
                  fetch('/api/ai-provider', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: newProvider }),
                  }).catch(err => console.error('Failed to update provider:', err));
                }}
                className="text-sm font-semibold bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-3 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
          </div>
          <CSVInput onDataChange={handleDataChange} />
          
          <div className="mt-6 space-y-3">
            <button
              onClick={handleAnalyzeTeam}
              disabled={isLoading || isLoadingSingleWriter || csvData.length === 0}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-md"
            >
              {isLoading ? 'Analyzing...' : 'Analyze Team Data'}
            </button>
            
            <button
              onClick={handleAnalyzeSingleWriter}
              disabled={isLoading || isLoadingSingleWriter || csvData.length === 0}
              className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-md"
            >
              {isLoadingSingleWriter ? 'Analyzing...' : 'Analyze Single Writer'}
            </button>
          </div>
        </div>

        {/* Article Performance Analyzer */}
        <ArticlePerformanceAnalyzer
          csvData={csvData}
          fileNames={fileNames}
          aiProvider={aiProvider}
        />

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {analysis && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setShowFullAnalysis(true)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                View Full Analysis
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
                Analysis Results
              </h2>
              <AnalysisResults 
                result={analysis} 
                isLoading={isLoading || isLoadingSingleWriter}
                onGenerateRecommendations={handleGenerateRecommendations}
                isLoadingRecommendations={isLoadingRecommendations}
                onGenerateDeeperAnalysis={handleGenerateDeeperAnalysis}
                isLoadingDeeperAnalysis={isLoadingDeeperAnalysis}
                onGenerateComparison={handleGenerateComparison}
                isLoadingComparison={isLoadingComparison}
                onComparePeriods={handleComparePeriods}
                isLoadingPeriodComparison={isLoadingPeriodComparison}
                onGenerateMetricsComparison={handleGenerateMetricsComparison}
                isLoadingMetricsComparison={isLoadingMetricsComparison}
                onGenerateMeetingSummary={handleGenerateMeetingSummary}
                isLoadingMeetingSummary={isLoadingMeetingSummary}
                fileCount={csvData.length}
                fileNames={fileNames}
                analysisMode={analysisMode}
              />
            </div>
            <FullAnalysisModal
              result={analysis}
              isOpen={showFullAnalysis}
              onClose={() => setShowFullAnalysis(false)}
              fileNames={fileNames}
            />
          </>
        )}
      </div>
    </main>
  );
}

