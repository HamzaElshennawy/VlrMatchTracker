import { NextResponse } from 'next/server';
import { VLRScraper } from '@/lib/scraper';
import { ApiResponse, ScrapeResponse } from '@/types';

export async function POST() {
  try {
    console.log('Starting manual scraping process...');
    
    const scraper = new VLRScraper();
    const result = await scraper.scrapeAllMatches();

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success 
        ? `Successfully scraped ${result.matches_scraped} new matches and updated ${result.matches_updated} existing matches`
        : 'Scraping completed with errors'
    } as ApiResponse<ScrapeResponse>);

  } catch (error) {
    console.error('Error during manual scraping:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to complete scraping process',
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