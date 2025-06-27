import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { VLRScraper } from '@/lib/scraper';
import { ApiResponse, Match } from '@/types';

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const db = new DatabaseService();
    const resolvedParams = await params;
    const matchId = parseInt(resolvedParams.id);

    if (isNaN(matchId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid match ID'
      } as ApiResponse<null>, { status: 400 });
    }

    let match = db.getMatch(matchId);

    if (!match) {
      return NextResponse.json({
        success: false,
        error: 'Match not found'
      } as ApiResponse<null>, { status: 404 });
    }

    // If detailed data is missing, try to scrape it
    if (!match.maps_data || !match.player_stats) {
      try {
        const scraper = new VLRScraper();
        const detailedData = await scraper.scrapeMatchDetails(match.vlr_match_id);
        
        if (detailedData) {
          db.saveMatch(detailedData);
          match = db.getMatch(matchId); // Refresh the match data
        }
      } catch (error) {
        console.error('Error scraping match details:', error);
        // Continue with existing data even if scraping fails
      }
    }

    return NextResponse.json({
      success: true,
      data: match
    } as ApiResponse<Match>);

  } catch (error) {
    console.error('Error fetching match details:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch match details'
    } as ApiResponse<null>, { status: 500 });
  }
}