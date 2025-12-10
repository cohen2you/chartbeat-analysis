import { ParsedCSV, getDataSummary, generateStatsByAuthor, generateWriterRankings, WriterRanking, generateSingleWriterData } from './csvParser';
import { aiProvider, AIProvider } from './aiProvider';

/**
 * Attempts to repair truncated JSON by closing incomplete strings, arrays, and objects
 */
function repairTruncatedJSON(json: string): string {
  let repaired = json.trim();
  
  // Count unclosed brackets and braces
  let openBraces = (repaired.match(/\{/g) || []).length;
  let closeBraces = (repaired.match(/\}/g) || []).length;
  let openBrackets = (repaired.match(/\[/g) || []).length;
  let closeBrackets = (repaired.match(/\]/g) || []).length;
  
  // Check if we're in the middle of a string by counting unescaped quotes
  // We need to be careful about escaped quotes
  let quoteCount = 0;
  let inEscape = false;
  for (let i = 0; i < repaired.length; i++) {
    if (inEscape) {
      inEscape = false;
      continue;
    }
    if (repaired[i] === '\\') {
      inEscape = true;
      continue;
    }
    if (repaired[i] === '"') {
      quoteCount++;
    }
  }
  const isInString = quoteCount % 2 !== 0;
  
  // If we're in a string, close it
  if (isInString) {
    // Find the last unescaped quote
    let lastQuoteIndex = -1;
    inEscape = false;
    for (let i = repaired.length - 1; i >= 0; i--) {
      if (i < repaired.length - 1 && repaired[i + 1] === '\\') {
        // This quote might be escaped, but we're going backwards so check previous char
        if (i > 0 && repaired[i - 1] === '\\') {
          // Actually escaped, skip
          continue;
        }
      }
      if (repaired[i] === '"' && (i === 0 || repaired[i - 1] !== '\\' || (i > 1 && repaired[i - 2] === '\\'))) {
        // Found an unescaped quote (or quote with even number of backslashes before it)
        let backslashCount = 0;
        for (let j = i - 1; j >= 0 && repaired[j] === '\\'; j--) {
          backslashCount++;
        }
        if (backslashCount % 2 === 0) {
          lastQuoteIndex = i;
          break;
        }
      }
    }
    
    if (lastQuoteIndex !== -1) {
      const afterQuote = repaired.substring(lastQuoteIndex + 1).trim();
      // If there's content after the quote that's not a valid JSON separator, we're mid-string
      if (afterQuote.length > 0 && !afterQuote.match(/^[\s,}\]:]/)) {
        // We're in the middle of a string value, close it by adding a quote
        repaired = repaired.substring(0, lastQuoteIndex + 1) + '"';
      }
    } else {
      // No closing quote found at all, add one at the end
      repaired += '"';
    }
  }
  
  // Close incomplete arrays
  while (openBrackets > closeBrackets) {
    repaired += ']';
    closeBrackets++;
  }
  
  // Close incomplete objects - need to be careful about trailing commas
  const trimmed = repaired.trim();
  if (trimmed.endsWith(',')) {
    // Remove trailing comma before closing objects
    repaired = repaired.replace(/,\s*$/, '');
  }
  
  while (openBraces > closeBraces) {
    repaired += '}';
    closeBraces++;
  }
  
  return repaired;
}

export interface AnalysisResult {
  keyTakeaways: string[];
  recommendations?: string[];
  statsByAuthor?: string;
  writerRankings?: WriterRanking[];
}

export async function analyzeSingleCSV(parsedData: ParsedCSV, providerOverride?: AIProvider): Promise<AnalysisResult> {
  const summary = getDataSummary(parsedData);
  const statsByAuthor = generateStatsByAuthor(parsedData);
  const writerRankings = generateWriterRankings(parsedData);
  
  const prompt = `You are a data analyst helping an editor understand key takeaways from Chartbeat analytics data. 
Analyze the following detailed data and provide SPECIFIC, NUMERIC insights.

CRITICAL REQUIREMENTS:
- EVERY takeaway MUST include specific numbers, percentages, and names (article titles, author names)
- Use exact numbers from the data (e.g., "2,643 views", "15.2%", "Michael Burry article")
- Mention specific article titles and author names in your analysis
- Calculate and include percentages for all comparisons
- Provide detailed breakdowns with actual numbers
- ONLY reference fields/metrics that actually exist in the data
- Do NOT mention or analyze fields that are missing from the data (e.g., if "page_avg_time" shows as N/A or 0, don't mention average time; if "page_uniques" is missing, don't mention unique visitors; if "page_views_quality" is missing, don't mention quality views; if "section" or "referrer" columns don't exist, don't mention them)
- Check the "Columns:" line in the data summary to see which fields are available
- Focus ONLY on the metrics that are present in the CSV file

Analyze the following data and provide:

1. Key Takeaways (5-7 bullet points):
   - Each MUST include: specific numbers, percentages, article titles, and/or author names
   - Example format: "Article X by Author Y generated 2,643 views (15.2% of total traffic)"
   - Highlight top performers with exact numbers
   - Include percentage breakdowns
   - ONLY mention fields/metrics that exist in the data (check the "Columns:" line to see what's available)
   - Do NOT mention missing fields like average time, unique visitors, quality views, sections, or referrers if those columns don't exist

2. Stats By Author (REQUIRED - comprehensive statistics section):
   - CRITICAL: This MUST be a complete, detailed LIST of EVERY SINGLE author in the dataset
   - DO NOT summarize or provide examples - LIST EVERY AUTHOR with their complete statistics
   - Format as a structured list with each author as a separate section/header
   - For EACH and EVERY author in the dataset, you MUST provide ALL of the following:
     * Author name as a clear header (e.g., "=== AUTHOR NAME ===" or "AUTHOR: Name")
     * Total number of articles published (exact number)
     * Total page views (exact number and percentage of overall traffic)
     * Total unique visitors (exact number and percentage of overall)
     * Total quality views (exact number and percentage of overall)
     * Average views per article (calculated number)
     * Average uniques per article (calculated number)
     * Average quality view rate (percentage)
     * Average time on page (in seconds)
     * Best performing article: FULL title, exact views, exact uniques, exact quality views, quality rate percentage, avg time in seconds
     * Worst performing article: FULL title, exact views, exact uniques, exact quality views, quality rate percentage, avg time in seconds
     * Performance consistency: number of articles above average, number below average, percentages for each
     * Top 3-5 sections they write for (with exact view counts and percentages)
     * Top 3-5 referrers for their content (with exact view counts and percentages)
     * Date range: earliest publish date, latest publish date
     * Any notable trends or patterns specific to this author
   - Format as a comprehensive, detailed LIST (use as many tokens as needed, up to the limit)
   - Organize clearly by author with clear section headers/separators for each author
   - Include EVERY SINGLE author from the dataset - do not skip any authors
   - Do not provide summaries or examples - provide the actual complete list
   - Use specific numbers, percentages, and full article titles for EVERY author
   - Each author should have their own dedicated section with all their statistics

Data Analysis:
${summary}

Please format your response as JSON with this structure:
{
  "keyTakeaways": ["takeaway with specific numbers and names", "takeaway 2", ...],
  "statsByAuthor": "List ALL authors with: name, articles, views, uniques (if available), quality views (if available), avg views/article, best/worst articles (full titles, exact views), consistency metrics, top sections/referrers (if available), date range, trends. Format as plain text sections. Include EVERY author."
}`;

  try {
    const currentProvider = providerOverride || aiProvider.getCurrentProvider();
    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a helpful data analyst that provides clear, actionable insights from data. Always respond with valid JSON. Use as many tokens as needed to provide comprehensive, detailed analysis.',
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
        // Provider-specific limits: OpenAI max 4096, Gemini max 8192
        maxTokens: currentProvider === 'gemini' ? 8192 : 4096,
      },
      providerOverride
    );

    // Clean the response - remove markdown code blocks if present
    let cleanContent = response.content.trim();
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    
    // Try to find JSON object if wrapped in other text
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }
    
    // SAFETY TRUNCATION: Find the last closing bracket "}" and ignore everything after it
    // This prevents parsing errors when the model adds extra text after valid JSON
    const lastBracketIndex = cleanContent.lastIndexOf('}');
    if (lastBracketIndex !== -1) {
      cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
    }
    
    // Try to repair truncated JSON (common with Gemini when responses are cut off)
    cleanContent = repairTruncatedJSON(cleanContent);
    
    let result: AnalysisResult;
    try {
      result = JSON.parse(cleanContent) as AnalysisResult;
    } catch (parseError: any) {
      console.error('JSON Parse Error. Cleaned content length:', cleanContent.length);
      console.error('Parse error at position:', parseError.message);
      // Log first and last 500 chars for debugging
      console.error('First 500 chars:', cleanContent.substring(0, 500));
      console.error('Last 500 chars:', cleanContent.substring(Math.max(0, cleanContent.length - 500)));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    // Add the generated stats by author (generated from data, not AI)
    result.statsByAuthor = statsByAuthor;
    result.writerRankings = writerRankings;
    return result;
  } catch (error) {
    console.error('AI API error:', error);
    const provider = aiProvider.getCurrentProvider();
    throw new Error(`Failed to analyze data using ${provider}. Please check your API key and try again.`);
  }
}

export async function analyzeMultipleCSV(
  parsedDataArray: ParsedCSV[],
  providerOverride?: AIProvider
): Promise<AnalysisResult> {
  const summaries = parsedDataArray.map((data, idx) => {
    const summary = getDataSummary(data);
    return `Dataset ${idx + 1}${data.fileName ? ` (${data.fileName})` : ''}:\n${summary}`;
  }).join('\n\n---\n\n');
  
  // Combine all datasets for stats by author
  const combinedData: ParsedCSV = {
    data: parsedDataArray.flatMap(d => d.data),
    headers: parsedDataArray[0]?.headers || [],
    fileName: parsedDataArray.map(d => d.fileName).filter(Boolean).join(', ') || undefined,
  };
  const statsByAuthor = generateStatsByAuthor(combinedData);
  const writerRankings = generateWriterRankings(combinedData);
  
  // Generate individual stats for each dataset (for comparison view)
  const individualStats = parsedDataArray.map(data => generateStatsByAuthor(data));

  const prompt = `You are a data analyst helping an editor understand key takeaways from multiple Chartbeat analytics datasets. 
Analyze the following datasets and provide SPECIFIC, NUMERIC insights with comparisons.

CRITICAL REQUIREMENTS:
- EVERY takeaway MUST include specific numbers, percentages, and names (article titles, author names)
- Compare datasets with exact numbers and percentage changes
- Use exact numbers from the data (e.g., "2,643 views", "15.2% increase", "Michael Burry article")
- Mention specific article titles and author names in your analysis
- Calculate and include percentages for all comparisons between datasets
- ONLY reference fields/metrics that actually exist in the data
- Do NOT mention or analyze fields that are missing from the data (e.g., if "page_avg_time" shows as N/A or 0, don't mention average time; if "page_uniques" is missing, don't mention unique visitors; if "page_views_quality" is missing, don't mention quality views; if "section" or "referrer" columns don't exist, don't mention them)
- Check the "Columns:" line in each dataset summary to see which fields are available
- Focus ONLY on the metrics that are present in the CSV files

Analyze the following datasets and provide:

1. Key Takeaways (6-8 bullet points):
   - Each MUST include: specific numbers, percentages, article titles, and/or author names
   - Compare performance between datasets with exact numbers
   - Example format: "Dataset 1: Article X generated 2,643 views vs Dataset 2: 1,850 views (42.9% increase)"
   - Highlight top performers in each dataset with exact numbers
   - Include percentage breakdowns and changes
   - ONLY mention fields/metrics that exist in the data (check the "Columns:" line to see what's available)
   - Do NOT mention missing fields like average time, unique visitors, quality views, sections, or referrers if those columns don't exist

2. Stats By Author (REQUIRED - comprehensive statistics section):
   - CRITICAL: This MUST be a complete, detailed LIST of EVERY SINGLE author across ALL datasets
   - DO NOT summarize or provide examples - LIST EVERY AUTHOR with their complete statistics
   - Format as a structured list with each author as a separate section/header
   - For EACH and EVERY author across all datasets, you MUST provide ALL of the following:
     * Author name as a clear header (e.g., "=== AUTHOR NAME ===" or "AUTHOR: Name")
     * Total number of articles published across all datasets (exact number)
     * Total page views across all datasets (exact number and percentage of overall traffic)
     * Total unique visitors across all datasets (exact number and percentage of overall)
     * Total quality views across all datasets (exact number and percentage of overall)
     * Average views per article (calculated number)
     * Average uniques per article (calculated number)
     * Average quality view rate (percentage)
     * Average time on page (in seconds)
     * Best performing article across all datasets: FULL title, exact views, exact uniques, exact quality views, quality rate percentage, avg time in seconds, which dataset it came from
     * Worst performing article across all datasets: FULL title, exact views, exact uniques, exact quality views, quality rate percentage, avg time in seconds, which dataset it came from
     * Performance comparison between datasets (if author appears in multiple) - show numbers for each dataset
     * Performance consistency: number of articles above average, number below average, percentages for each
     * Top 3-5 sections they write for (with exact view counts and percentages)
     * Top 3-5 referrers for their content (with exact view counts and percentages)
     * Date range: earliest publish date across all datasets, latest publish date across all datasets
     * Any notable trends or patterns specific to this author across datasets
   - Format as a comprehensive, detailed LIST (use as many tokens as needed, up to the limit)
   - Organize clearly by author with clear section headers/separators for each author
   - Include EVERY SINGLE author from all datasets - do not skip any authors
   - Do not provide summaries or examples - provide the actual complete list
   - Use specific numbers, percentages, and full article titles for EVERY author
   - Each author should have their own dedicated section with all their statistics
   - Compare performance across datasets where applicable

Datasets:
${summaries}

Please format your response as JSON with this structure:
{
  "keyTakeaways": ["takeaway with specific numbers, names, and comparisons", "takeaway 2", ...],
  "statsByAuthor": "List ALL authors across datasets with: name, total articles/views across all datasets, uniques/quality views (if available), avg views/article, best/worst articles (full titles, exact views, dataset), dataset comparisons (if multiple), consistency metrics, top sections/referrers (if available), date ranges, trends. Format as plain text sections. Include EVERY author."
}`;

  try {
    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a helpful data analyst that provides clear, actionable insights from data. Always respond with valid JSON. Use as many tokens as needed to provide comprehensive, detailed analysis.',
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
        // Provider-specific limits: OpenAI max 4096, Gemini max 8192
        maxTokens: aiProvider.getCurrentProvider() === 'gemini' ? 8192 : 4096,
      }
    );

    // Clean the response - remove markdown code blocks if present
    let cleanContent = response.content.trim();
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    
    // Try to find JSON object if wrapped in other text
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }
    
    // SAFETY TRUNCATION: Find the last closing bracket "}" and ignore everything after it
    // This prevents parsing errors when the model adds extra text after valid JSON
    const lastBracketIndex = cleanContent.lastIndexOf('}');
    if (lastBracketIndex !== -1) {
      cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
    }
    
    // Try to repair truncated JSON (common with Gemini when responses are cut off)
    cleanContent = repairTruncatedJSON(cleanContent);
    
    let result: AnalysisResult;
    try {
      result = JSON.parse(cleanContent) as AnalysisResult;
    } catch (parseError: any) {
      console.error('JSON Parse Error. Cleaned content length:', cleanContent.length);
      console.error('Parse error at position:', parseError.message);
      // Log first and last 500 chars for debugging
      console.error('First 500 chars:', cleanContent.substring(0, 500));
      console.error('Last 500 chars:', cleanContent.substring(Math.max(0, cleanContent.length - 500)));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    // Add the generated stats by author (generated from data, not AI)
    result.statsByAuthor = statsByAuthor;
    result.writerRankings = writerRankings;
    // Add individual stats for comparison (if 2 files)
    if (parsedDataArray.length === 2 && individualStats) {
      (result as any).individualStats = individualStats;
    }
    return result;
  } catch (error) {
    console.error('AI API error:', error);
    const provider = aiProvider.getCurrentProvider();
    throw new Error(`Failed to analyze data using ${provider}. Please check your API key and try again.`);
  }
}

export async function analyzeSingleWriter(parsedData: ParsedCSV, providerOverride?: AIProvider): Promise<AnalysisResult> {
  // First, detect the author name from the data
  const { data } = parsedData;
  const authorMap = new Map<string, number>();
  
  data.forEach((row: any) => {
    const author = (row.author || row.Author || '').trim();
    if (author && author !== 'Unknown') {
      authorMap.set(author, (authorMap.get(author) || 0) + 1);
    }
  });
  
  // Get the most common author (should be the single writer)
  const authors = Array.from(authorMap.entries()).sort((a, b) => b[1] - a[1]);
  const writerName = authors.length > 0 ? authors[0][0] : 'Unknown';
  
  // Generate single writer focused data
  const writerData = generateSingleWriterData(parsedData, writerName);
  
  const prompt = `You are a data analyst providing a focused performance review for a single writer based on their Chartbeat analytics data.
Analyze the following detailed data and provide SPECIFIC, NUMERIC insights focused on this writer's individual performance.

CRITICAL REQUIREMENTS:
- EVERY takeaway MUST include specific numbers, percentages, and article titles
- Use exact numbers from the data (e.g., "2,643 views", "15.2%", "Article Title")
- Mention specific article titles in your analysis
- Calculate and include percentages for all comparisons
- Focus on the WRITER'S PERFORMANCE, not team comparisons
- ONLY reference fields/metrics that actually exist in the data
- Do NOT mention or analyze fields that are missing from the data
- Check the data summary to see which fields are available
- Focus ONLY on the metrics that are present in the CSV file

Analyze the following writer's data and provide:

1. Key Takeaways (6-8 bullet points focused on this writer's performance):
   - Each MUST include: specific numbers, percentages, and article titles
   - Example format: "Writer's article 'X' generated 2,643 views, representing 15.2% of their total traffic"
   - Highlight their best and worst performing articles with exact numbers
   - Include performance trends over time
   - Analyze consistency of performance
   - Compare their best vs worst articles
   - Include percentage breakdowns
   - ONLY mention fields/metrics that exist in the data
   - Do NOT mention missing fields like average time, unique visitors, quality views, sections, or referrers if those columns don't exist

2. Performance Insights (focused analysis):
   - Overall performance summary with exact numbers
   - Best performing articles with full titles and exact view counts
   - Worst performing articles with full titles and exact view counts
   - Performance consistency analysis (how many articles above/below average)
   - Trends over time (if date data is available)
   - Section performance breakdown (if section data is available)
   - Referrer analysis (if referrer data is available)
   - Quality metrics (if quality views data is available)
   - Engagement metrics (if average time data is available)

Writer Performance Data:
${writerData}

Please format your response as JSON with this structure:
{
  "keyTakeaways": ["takeaway with specific numbers and article titles", "takeaway 2", ...],
  "statsByAuthor": "A detailed performance analysis focused on this single writer. Include: overall statistics (total articles, total views, averages), best performing articles (full titles, exact views, dates), worst performing articles (full titles, exact views, dates), performance consistency metrics, trends over time, section breakdown (if available), referrer analysis (if available), and any notable patterns or insights. Format as plain text with clear sections. ONLY include fields that exist in the data."
}`;

  try {
    const currentProvider = providerOverride || aiProvider.getCurrentProvider();
    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a helpful data analyst that provides clear, actionable insights from data. Always respond with valid JSON. Focus on individual writer performance analysis.',
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
        // Provider-specific limits: OpenAI max 4096, Gemini max 8192
        maxTokens: currentProvider === 'gemini' ? 8192 : 4096,
      },
      providerOverride
    );

    // Clean the response - remove markdown code blocks if present
    let cleanContent = response.content.trim();
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    
    // Try to find JSON object if wrapped in other text
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }
    
    // SAFETY TRUNCATION: Find the last closing bracket "}" and ignore everything after it
    // This prevents parsing errors when the model adds extra text after valid JSON
    const lastBracketIndex = cleanContent.lastIndexOf('}');
    if (lastBracketIndex !== -1) {
      cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
    }
    
    // Try to repair truncated JSON (common with Gemini when responses are cut off)
    cleanContent = repairTruncatedJSON(cleanContent);
    
    let result: AnalysisResult;
    try {
      result = JSON.parse(cleanContent) as AnalysisResult;
    } catch (parseError: any) {
      console.error('JSON Parse Error. Cleaned content length:', cleanContent.length);
      console.error('Parse error at position:', parseError.message);
      // Log first and last 500 chars for debugging
      console.error('First 500 chars:', cleanContent.substring(0, 500));
      console.error('Last 500 chars:', cleanContent.substring(Math.max(0, cleanContent.length - 500)));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    // Add the generated writer data
    result.statsByAuthor = writerData + '\n\n' + (result.statsByAuthor || '');
    return result;
  } catch (error) {
    console.error('AI API error:', error);
    const provider = aiProvider.getCurrentProvider();
    throw new Error(`Failed to analyze writer data using ${provider}. Please check your API key and try again.`);
  }
}

