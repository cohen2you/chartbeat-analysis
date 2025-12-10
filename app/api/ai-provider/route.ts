import { NextRequest, NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';

export async function GET() {
  try {
    const provider = aiProvider.getCurrentProvider();
    return NextResponse.json({
      provider,
      available: {
        openai: !!process.env.OPENAI_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get AI provider info' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body;
    
    if (provider && (provider === 'openai' || provider === 'gemini')) {
      aiProvider.setProvider(provider);
      return NextResponse.json({
        success: true,
        provider: aiProvider.getCurrentProvider(),
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "openai" or "gemini"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to set AI provider' },
      { status: 500 }
    );
  }
}

