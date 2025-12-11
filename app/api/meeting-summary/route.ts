import { NextRequest, NextResponse } from 'next/server';
import { aiProvider, AIProvider } from '@/lib/aiProvider';
import { repairTruncatedJSON } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysis, provider } = body;

    // Set provider if specified
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      try {
        aiProvider.setProvider(provider as AIProvider);
      } catch (error: any) {
        console.warn(`Provider ${provider} not available, using default:`, error.message);
      }
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Please provide analysis data' },
        { status: 400 }
      );
    }

    // Build a comprehensive summary of all analysis data
    // Include all available data so the summary can be regenerated with more context
    const hasDeeperAnalysis = analysis.deeperAnalysis && Object.keys(analysis.deeperAnalysis).length > 0;
    const hasRecommendations = analysis.recommendations && analysis.recommendations.length > 0;
    const hasWriterFeedback = analysis.writerFeedback && analysis.writerFeedback.trim().length > 0;
    const hasPeriodComparison = analysis.periodComparison && Object.keys(analysis.periodComparison).length > 0;
    const hasComparison = analysis.comparison && Object.keys(analysis.comparison).length > 0;
    const hasMetricsComparison = analysis.metricsComparison && Object.keys(analysis.metricsComparison).length > 0;

    // Extract diverse metrics from statsByAuthor if available
    let topArticlesContext = '';
    let referrerContext = '';
    let sectionContext = '';
    let overallMetricsContext = '';
    
    if (analysis.statsByAuthor) {
      const statsText = analysis.statsByAuthor;
      
      // Extract top performing articles
      const bestArticleMatches = statsText.match(/best performing article[:\-]?\s*([^\n]+?)\s*[-–]\s*(\d+[\d,]*)\s*views/gi);
      if (bestArticleMatches && bestArticleMatches.length > 0) {
        topArticlesContext = `\nTop Performing Articles:\n${bestArticleMatches.slice(0, 10).map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}\n`;
      }
      
      // Extract referrer information
      const referrerSection = statsText.match(/=== TOP REFERRERS ===\s*([\s\S]*?)(?=\n===|\n\n|$)/i);
      if (referrerSection && referrerSection[1]) {
        referrerContext = `\nTop Referrers:\n${referrerSection[1].trim()}\n`;
      }
      
      // Extract section information
      const sectionSection = statsText.match(/=== SECTION PERFORMANCE ===\s*([\s\S]*?)(?=\n===|\n\n|$)/i);
      if (sectionSection && sectionSection[1]) {
        sectionContext = `\nSection Performance:\n${sectionSection[1].trim()}\n`;
      }
      
      // Extract overall metrics (total views, articles, etc.)
      const totalViewsMatch = statsText.match(/total.*views?[:\-]?\s*(\d+[\d,]*)/gi);
      const totalArticlesMatch = statsText.match(/total.*articles?[:\-]?\s*(\d+[\d,]*)/gi);
      if (totalViewsMatch || totalArticlesMatch) {
        overallMetricsContext = `\nOverall Metrics:\n${totalViewsMatch ? totalViewsMatch.slice(0, 3).join('\n') : ''}\n${totalArticlesMatch ? totalArticlesMatch.slice(0, 3).join('\n') : ''}\n`;
      }
    }

    // Build context string for the prompt
    let contextString = `You are creating a strategic executive summary for an editorial meeting. Your goal is to synthesize ALL available analysis into exactly 10 high-level strategic insights that can be easily shared and discussed in a meeting.

CRITICAL REQUIREMENTS FOR MEETING-READY OUTPUT:
- Create EXACTLY 10 bullet points (no more, no less)
- Each point MUST be strategic AND backed by specific numbers, percentages, or concrete examples
- REQUIRED: Every strategic insight MUST include supporting data (e.g., "Tech stock articles generate 3x higher engagement (avg 1,200 views vs 400 views for general news)")
- REQUIRED: Reference specific articles, writers, or metrics when making strategic points (e.g., "Erica Kollmann's Nvidia article generated 3,281 views, demonstrating...")
- Focus on "what this means" and "what we should do" rather than "what happened", BUT always support with numbers
- Prioritize insights that drive decision-making and strategy
- Use clear, executive-level language suitable for presenting to leadership
- Include specific numbers, percentages, article titles, writer names, and view counts to back up every strategic point
- Avoid generic statements - every point should have concrete evidence
- Make each point discussion-worthy, actionable, AND data-backed

AVAILABLE ANALYSIS DATA:

Key Takeaways:
${(analysis.keyTakeaways || []).map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}

${hasDeeperAnalysis ? `\nDEEPER ANALYSIS (Strategic Insights Available):
${analysis.deeperAnalysis.titleAnalysis ? `Title Analysis: ${analysis.deeperAnalysis.titleAnalysis.substring(0, 1000)}\n` : ''}
${analysis.deeperAnalysis.subjectAnalysis ? `Subject Analysis: ${analysis.deeperAnalysis.subjectAnalysis.substring(0, 1000)}\n` : ''}
${analysis.deeperAnalysis.temporalAnalysis ? `Temporal Patterns: ${analysis.deeperAnalysis.temporalAnalysis.substring(0, 1000)}\n` : ''}
${analysis.deeperAnalysis.strategicInsights ? `Strategic Insights: ${analysis.deeperAnalysis.strategicInsights.substring(0, 1000)}\n` : ''}
${analysis.deeperAnalysis.viewsPerPostAnalysis ? `Views Per Post Analysis: ${analysis.deeperAnalysis.viewsPerPostAnalysis.substring(0, 1000)}\n` : ''}
${analysis.deeperAnalysis.contentStrategyInsights ? `Content Strategy: ${analysis.deeperAnalysis.contentStrategyInsights.substring(0, 1000)}\n` : ''}
${analysis.deeperAnalysis.performanceTrends ? `Performance Trends: ${analysis.deeperAnalysis.performanceTrends.substring(0, 1000)}\n` : ''}
${analysis.deeperAnalysis.actionableRecommendations ? `Actionable Recommendations: ${analysis.deeperAnalysis.actionableRecommendations.substring(0, 1000)}\n` : ''}
` : ''}

${hasRecommendations ? `\nRECOMMENDATIONS (Action Items Available):
${(analysis.recommendations || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}\n` : ''}

${hasWriterFeedback ? `\nWRITER FEEDBACK (Performance Review Available):
${analysis.writerFeedback.substring(0, 1000)}...\n` : ''}

${hasPeriodComparison ? `\nPERIOD COMPARISON (Trend Analysis Available):
${analysis.periodComparison.performanceTrends ? `Performance Trends: ${analysis.periodComparison.performanceTrends.substring(0, 1000)}\n` : ''}
${analysis.periodComparison.keyInsights ? `Key Insights: ${analysis.periodComparison.keyInsights.substring(0, 1000)}\n` : ''}
${analysis.periodComparison.recommendations ? `Recommendations: ${analysis.periodComparison.recommendations.substring(0, 1000)}\n` : ''}
` : ''}

${hasComparison ? `\nCOMPARISON ANALYSIS (Cross-Period Insights Available):
${analysis.comparison.overallSummary ? `Overall Summary: ${Array.isArray(analysis.comparison.overallSummary) ? analysis.comparison.overallSummary.join('\n') : analysis.comparison.overallSummary.substring(0, 1000)}\n` : ''}
${analysis.comparison.keyDifferences ? `Key Differences: ${Array.isArray(analysis.comparison.keyDifferences) ? analysis.comparison.keyDifferences.join('\n') : analysis.comparison.keyDifferences.substring(0, 1000)}\n` : ''}
` : ''}

${hasMetricsComparison ? `\nMETRICS COMPARISON (Non-Author Metrics Available):
${analysis.metricsComparison.overallMetrics && analysis.metricsComparison.overallMetrics.length > 0 ? `Overall Metrics: ${analysis.metricsComparison.overallMetrics.join('\n')}\n` : ''}
${analysis.metricsComparison.sectionComparison && analysis.metricsComparison.sectionComparison.length > 0 ? `Section Comparison: ${analysis.metricsComparison.sectionComparison.join('\n')}\n` : ''}
${analysis.metricsComparison.referrerComparison && analysis.metricsComparison.referrerComparison.length > 0 ? `Referrer Comparison: ${analysis.metricsComparison.referrerComparison.join('\n')}\n` : ''}
${analysis.metricsComparison.topArticlesComparison && analysis.metricsComparison.topArticlesComparison.length > 0 ? `Top Articles Comparison: ${analysis.metricsComparison.topArticlesComparison.join('\n')}\n` : ''}
${analysis.metricsComparison.keyInsights && analysis.metricsComparison.keyInsights.length > 0 ? `Key Insights: ${analysis.metricsComparison.keyInsights.join('\n')}\n` : ''}
` : ''}

${analysis.writerRankings && analysis.writerRankings.length > 0 ? `\nWRITER RANKINGS (Use for specific references):
${analysis.writerRankings.slice(0, 10).map((r: any, i: number) => 
  `${i + 1}. ${r.name}: ${r.totalViews.toLocaleString()} total views from ${r.articleCount} articles (avg ${r.avgViewsPerArticle.toFixed(0)} views/article, ${r.percentOfTotal.toFixed(1)}% of total traffic). Best article: "${r.bestArticleTitle}" with ${r.bestArticleViews.toLocaleString()} views`
).join('\n')}\n` : ''}

${topArticlesContext}
${referrerContext}
${sectionContext}
${overallMetricsContext}

${analysis.timePeriod ? `Time Period: ${analysis.timePeriod}\n` : ''}
${analysis.writerName ? `Focus Writer: ${analysis.writerName}\n` : ''}

YOUR TASK:
Synthesize ALL of the above information into exactly 10 strategic bullet points that:
1. COVER DIVERSE METRICS - Do NOT focus only on authors. Ensure variety across:
   - Author performance (max 2-3 points)
   - Referrer performance and traffic sources
   - Section performance and content categories
   - Overall pageview trends and patterns
   - Top article insights
   - Comparison insights (if available)
   - Cross-metric patterns (e.g., "Section X articles get 2x more traffic from Referrer Y")
2. Identify key strategic opportunities and risks - WITH SPECIFIC NUMBERS
3. Highlight what's working and what needs attention - WITH CONCRETE EXAMPLES
4. Provide actionable insights for content strategy - BACKED BY DATA
5. Surface patterns that inform editorial decisions - WITH METRICS
6. Focus on "so what" and "what next" rather than just "what happened" - BUT INCLUDE THE DATA
7. Are discussion-worthy and decision-driving - WITH EVIDENCE
8. Can be easily shared in a meeting presentation - WITH NUMBERS TO SUPPORT

CRITICAL DIVERSITY REQUIREMENT:
- Maximum 2-3 bullet points about individual authors
- At least 1-2 bullet points about referrers/traffic sources
- At least 1-2 bullet points about sections/content categories
- At least 1-2 bullet points about overall pageview trends
- At least 1 bullet point about top articles (if available)
- At least 1 bullet point about comparison insights (if available)
- Mix different metric types - don't repeat the same type of insight multiple times

CRITICAL FORMATTING REQUIREMENTS:
- Every bullet point MUST include specific numbers, percentages, or concrete examples
- Reference specific articles by title when making points (e.g., "Erica Kollmann's 'Nvidia Sell Signal' article generated 3,281 views...")
- Include writer names with their metrics when relevant (e.g., "Henry Khederian's 61 articles generated 26,450 views (23.3% of total)...")
- Use percentages and comparisons (e.g., "3x higher", "42% increase", "15.2% of total traffic")
- Include view counts, article counts, and averages to support strategic points

GOOD EXAMPLES (diverse metrics with numbers):
- AUTHOR: "Tech stock analysis drives 3x higher engagement (avg 1,200 views vs 400 views for general news), with Erica Kollmann's Nvidia article generating 3,281 views - suggesting we should prioritize breaking tech earnings coverage"
- REFERRER: "Smartnews.com drives 45% of total traffic (1.2M views from 350 articles), compared to 12% from direct traffic, indicating we should optimize content for third-party aggregators"
- SECTION: "Finance section generates 2.5x more views per article (avg 850 views) than Technology section (avg 340 views), suggesting we should expand financial analysis coverage"
- OVERALL: "Total pageviews increased 34% from Dataset 1 to Dataset 2 (2.1M to 2.8M), driven primarily by 28% increase in article volume, indicating successful content scaling"
- COMPARISON: "Section performance shifted significantly: Finance increased from 18% to 32% of total views, while Technology decreased from 25% to 15%, suggesting reader interest migration"
- TOP ARTICLES: "Top 10 articles account for 18% of total traffic (504K views), with average of 50K views each, demonstrating the impact of viral content on overall performance"

BAD EXAMPLES (too generic, no numbers):
- "Tech articles perform well" (NO - needs numbers)
- "We should focus on quality over quantity" (NO - needs specific examples)
- "Timing matters for publication" (NO - needs metrics)

Format your response as JSON with this structure:
{
  "summary": [
    "Strategic insight 1 with specific numbers, percentages, and article/writer references",
    "Strategic insight 2 with concrete data backing the recommendation",
    "... continue for exactly 10 strategic bullet points, each with supporting data"
  ]
}`;

    const prompt = contextString;

    try {
      const currentProvider = aiProvider.getCurrentProvider();
      const response = await aiProvider.generateCompletion(
        [
          {
            role: 'system',
            content: 'You are a senior editorial strategist creating executive meeting summaries. Your summaries must be strategic, actionable, and decision-driving - NOT just lists of facts. However, EVERY strategic point MUST be backed by specific numbers, percentages, article titles, writer names, and concrete metrics. CRITICAL: Ensure DIVERSITY across metric types - do NOT focus only on authors. Include insights about referrers, sections, overall pageviews, top articles, and comparisons. Maximum 2-3 points about individual authors. Focus on "what this means" and "what we should do" rather than "what happened", but always include the supporting data. Always respond with valid JSON. Create exactly 10 bullet points that synthesize complex analysis into high-level strategic insights suitable for leadership discussions, with each point including specific numbers and references, and covering diverse metric types.',
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

      // Clean and repair the response
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

      const result = JSON.parse(cleanContent);

      // Ensure we have exactly 10 bullet points
      const summary = Array.isArray(result.summary) ? result.summary : [result.summary || 'No summary available'];
      const trimmedSummary = summary.slice(0, 10); // Take first 10 if more
      
      // If less than 10, pad with generic message (shouldn't happen with good AI)
      while (trimmedSummary.length < 10) {
        trimmedSummary.push('Additional analysis available in detailed reports');
      }

      return NextResponse.json({
        success: true,
        meetingSummary: trimmedSummary,
      });
    } catch (error: any) {
      console.error('AI API error:', error);
      return NextResponse.json(
        { error: `Failed to generate meeting summary: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Meeting summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate meeting summary' },
      { status: 500 }
    );
  }
}

