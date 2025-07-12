import { NextResponse } from 'next/server';
import { VLRScraper } from '@/lib/scraper';
import { ApiResponse } from '@/types';

interface RealtimeTournament {
  name: string;
  logo_url?: string;
  active_matches_count: number;
  scraped_at: string;
}

export async function GET() {
  try {
    const scraper = new VLRScraper();
    const uniqueTournaments = new Map<string, RealtimeTournament>();

    // Scrape all match types to get tournament information
    try {
      const upcomingMatches = await scraper.scrapeMatchesList('upcoming');
      for (const match of upcomingMatches) {
        if (match.tournament_name) {
          const existing = uniqueTournaments.get(match.tournament_name) || {
            name: match.tournament_name,
            logo_url: match.tournament_logo_url,
            active_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.active_matches_count++;
          uniqueTournaments.set(match.tournament_name, existing);
        }
      }
    } catch (error) {
      console.error('Error scraping upcoming matches for tournaments:', error);
    }

    try {
      const liveMatches = await scraper.scrapeMatchesList('');
      for (const match of liveMatches) {
        if (match.tournament_name) {
          const existing = uniqueTournaments.get(match.tournament_name) || {
            name: match.tournament_name,
            logo_url: match.tournament_logo_url,
            active_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.active_matches_count++;
          uniqueTournaments.set(match.tournament_name, existing);
        }
      }
    } catch (error) {
      console.error('Error scraping live matches for tournaments:', error);
    }

    try {
      const completedMatches = await scraper.scrapeMatchesList('results');
      for (const match of completedMatches) {
        if (match.tournament_name) {
          const existing = uniqueTournaments.get(match.tournament_name) || {
            name: match.tournament_name,
            logo_url: match.tournament_logo_url,
            active_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.active_matches_count++;
          uniqueTournaments.set(match.tournament_name, existing);
        }
      }
    } catch (error) {
      console.error('Error scraping completed matches for tournaments:', error);
    }

    const tournaments = Array.from(uniqueTournaments.values()).sort((a, b) => b.active_matches_count - a.active_matches_count);

    return NextResponse.json({
      success: true,
      data: {
        tournaments,
        total: tournaments.length,
        scraped_at: new Date().toISOString()
      }
    } as ApiResponse<{ tournaments: RealtimeTournament[], total: number, scraped_at: string }>);

  } catch (error) {
    console.error('Error scraping tournaments:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to scrape tournaments from VLR.gg'
    } as ApiResponse<null>, { status: 500 });
  }
}
