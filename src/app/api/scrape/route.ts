import { NextRequest, NextResponse } from 'next/server';
import { VLRScraper } from '@/lib/scraper';
import { ApiResponse, ScrapeResponse, MatchDetailScrapeData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting real-time scraping process...');
    
    const scraper = new VLRScraper();
    const searchParams = request.nextUrl.searchParams;
    
    const scrapeType = searchParams.get('type') || 'all';
    let result: ScrapeResponse | { matches: MatchDetailScrapeData[], scraped_at: string };

    switch (scrapeType) {
      case 'all':
        result = await scraper.scrapeAllMatches();
        break;
      
      case 'upcoming':
        const upcomingMatches = await scraper.scrapeMatchesList('upcoming');
        result = {
          matches: upcomingMatches,
          scraped_at: new Date().toISOString()
        };
        break;
      
      case 'live':
        const liveMatches = await scraper.scrapeMatchesList('');
        const liveOnly = liveMatches.filter(match => match.status === 'live');
        result = {
          matches: liveOnly,
          scraped_at: new Date().toISOString()
        };
        break;
      
      case 'results':
        const completedMatches = await scraper.scrapeMatchesList('results');
        result = {
          matches: completedMatches,
          scraped_at: new Date().toISOString()
        };
        break;
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid scrape type. Use: all, upcoming, live, or results'
        } as ApiResponse<null>, { status: 400 });
    }

    const message = 'success' in result && result.success
      ? `Successfully scraped real-time data from VLR.gg`
      : 'Real-time scraping completed';

    return NextResponse.json({
      success: true,
      data: result,
      message
    } as ApiResponse<ScrapeResponse | { matches: MatchDetailScrapeData[], scraped_at: string }>);

  } catch (error) {
    console.error('Error during real-time scraping:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to complete real-time scraping from VLR.gg',
      message: String(error)
    } as ApiResponse<null>, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use POST to trigger scraping.'
  }, { status: 405 });
}