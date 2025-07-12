import { NextRequest, NextResponse } from 'next/server';
import { VLRScraper } from '@/lib/scraper';
import { ApiResponse, MatchDetailScrapeData } from '@/types';

interface RealtimeMatchListResponse {
  matches: MatchDetailScrapeData[];
  total: number;
  page: number;
  per_page: number;
  scraped_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const scraper = new VLRScraper();
    const searchParams = request.nextUrl.searchParams;
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const completedMatches = await scraper.scrapeMatchesList('results');
    const completedOnly = completedMatches.filter(match => match.status === 'completed');
    
    const total = completedOnly.length;
    const offset = (page - 1) * limit;
    const paginatedMatches = completedOnly.slice(offset, offset + limit);
    
    const response: RealtimeMatchListResponse = {
      matches: paginatedMatches,
      total,
      page,
      per_page: limit,
      scraped_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: response
    } as ApiResponse<RealtimeMatchListResponse>);

  } catch (error) {
    console.error('Error scraping completed matches:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to scrape completed matches from VLR.gg'
    } as ApiResponse<null>, { status: 500 });
  }
}
