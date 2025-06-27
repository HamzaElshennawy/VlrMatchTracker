import { NextResponse } from 'next/server';
import { VLRScraper } from '@/lib/scraper';
import { DatabaseService } from '@/lib/database';
import { ApiResponse, ScrapeResponse } from '@/types';

export async function POST(request: Request) {
  try {
    console.log('Starting manual scraping process...');
    
    // Check if request includes cleaning option
    let cleanExisting = false;
    try {
      const body = await request.json();
      cleanExisting = body.cleanExisting === true;
    } catch {
      // Ignore JSON parsing errors, use defaults
    }
    
    // Clean existing data if requested
    let cleaningResults = null;
    if (cleanExisting) {
      console.log('Cleaning existing database records...');
      const db = new DatabaseService();
      cleaningResults = db.cleanExistingData();
    }
    
    const scraper = new VLRScraper();
    const result = await scraper.scrapeAllMatches();

    let message = result.success 
      ? `Successfully scraped ${result.matches_scraped} new matches and updated ${result.matches_updated} existing matches`
      : 'Scraping completed with errors';
    
    if (cleaningResults) {
      message += `. Cleaned ${cleaningResults.tournamentsUpdated} tournaments and ${cleaningResults.teamsUpdated} teams`;
    }

    return NextResponse.json({
      success: result.success,
      data: { ...result, cleaningResults },
      message
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