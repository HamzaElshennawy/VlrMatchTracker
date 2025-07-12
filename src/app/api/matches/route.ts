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
    
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let allMatches: MatchDetailScrapeData[] = [];

    if (status === 'all' || status === 'upcoming') {
      const upcomingMatches = await scraper.scrapeMatchesList('upcoming');
      allMatches.push(...upcomingMatches.filter(m => m.status === 'upcoming'));
    }

    if (status === 'all' || status === 'live') {
      const liveMatches = await scraper.scrapeMatchesList('');
      allMatches.push(...liveMatches.filter(m => m.status === 'live'));
    }

    if (status === 'all' || status === 'completed') {
      const completedMatches = await scraper.scrapeMatchesList('results');
      allMatches.push(...completedMatches.filter(m => m.status === 'completed'));
    }

    // Filter by status if specific status requested
    if (status !== 'all') {
      allMatches = allMatches.filter(match => match.status === status);
    }

    // Apply pagination
    const total = allMatches.length;
    const offset = (page - 1) * limit;
    const paginatedMatches = allMatches.slice(offset, offset + limit);
    
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
    console.error('Error scraping matches:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to scrape matches from VLR.gg'
    } as ApiResponse<null>, { status: 500 });
  }
}
