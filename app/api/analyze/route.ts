import { NextRequest, NextResponse } from 'next/server';
import { parseCSV } from '@/lib/csvParser';
import { analyzeSingleCSV, analyzeMultipleCSV } from '@/lib/openai';
import { aiProvider, AIProvider } from '@/lib/aiProvider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, fileNames, provider } = body;
    
    // Set provider if specified (with error handling)
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      try {
        aiProvider.setProvider(provider as AIProvider);
      } catch (error: any) {
        console.warn(`Provider ${provider} not available, using default:`, error.message);
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

    // Analyze single or multiple CSVs
    const providerOverride = provider && (provider === 'openai' || provider === 'gemini') ? provider as AIProvider : undefined;
    const analysis = parsedDataArray.length === 1
      ? await analyzeSingleCSV(parsedDataArray[0], providerOverride)
      : await analyzeMultipleCSV(parsedDataArray, providerOverride);

    return NextResponse.json({
      success: true,
      analysis,
      dataCount: parsedDataArray.length,
      fileNames: parsedDataArray.map(d => d.fileName).filter(Boolean),
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze data' },
      { status: 500 }
    );
  }
}

