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

    const upcomingMatches = await scraper.scrapeMatchesList('upcoming');
    const upcomingOnly = upcomingMatches.filter(match => match.status === 'upcoming');
    
    const total = upcomingOnly.length;
    const offset = (page - 1) * limit;
    const paginatedMatches = upcomingOnly.slice(offset, offset + limit);
    
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
    console.error('Error scraping upcoming matches:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to scrape upcoming matches from VLR.gg'
    } as ApiResponse<null>, { status: 500 });
  }
}
