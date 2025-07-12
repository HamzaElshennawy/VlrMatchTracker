import { NextResponse } from 'next/server';
import { VLRScraper } from '@/lib/scraper';
import { ApiResponse } from '@/types';

interface RealtimeTeam {
  name: string;
  logo_url?: string;
  recent_matches_count: number;
  scraped_at: string;
}

export async function GET() {
  try {
    const scraper = new VLRScraper();
    const uniqueTeams = new Map<string, RealtimeTeam>();

    // Scrape all match types to get team information
    try {
      const upcomingMatches = await scraper.scrapeMatchesList('upcoming');
      for (const match of upcomingMatches) {
        if (match.team1_name) {
          const existing = uniqueTeams.get(match.team1_name) || {
            name: match.team1_name,
            logo_url: match.team1_logo_url,
            recent_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.recent_matches_count++;
          uniqueTeams.set(match.team1_name, existing);
        }
        if (match.team2_name) {
          const existing = uniqueTeams.get(match.team2_name) || {
            name: match.team2_name,
            logo_url: match.team2_logo_url,
            recent_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.recent_matches_count++;
          uniqueTeams.set(match.team2_name, existing);
        }
      }
    } catch (error) {
      console.error('Error scraping upcoming matches for teams:', error);
    }

    try {
      const liveMatches = await scraper.scrapeMatchesList('');
      for (const match of liveMatches) {
        if (match.team1_name) {
          const existing = uniqueTeams.get(match.team1_name) || {
            name: match.team1_name,
            logo_url: match.team1_logo_url,
            recent_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.recent_matches_count++;
          uniqueTeams.set(match.team1_name, existing);
        }
        if (match.team2_name) {
          const existing = uniqueTeams.get(match.team2_name) || {
            name: match.team2_name,
            logo_url: match.team2_logo_url,
            recent_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.recent_matches_count++;
          uniqueTeams.set(match.team2_name, existing);
        }
      }
    } catch (error) {
      console.error('Error scraping live matches for teams:', error);
    }

    try {
      const completedMatches = await scraper.scrapeMatchesList('results');
      for (const match of completedMatches) {
        if (match.team1_name) {
          const existing = uniqueTeams.get(match.team1_name) || {
            name: match.team1_name,
            logo_url: match.team1_logo_url,
            recent_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.recent_matches_count++;
          uniqueTeams.set(match.team1_name, existing);
        }
        if (match.team2_name) {
          const existing = uniqueTeams.get(match.team2_name) || {
            name: match.team2_name,
            logo_url: match.team2_logo_url,
            recent_matches_count: 0,
            scraped_at: new Date().toISOString()
          };
          existing.recent_matches_count++;
          uniqueTeams.set(match.team2_name, existing);
        }
      }
    } catch (error) {
      console.error('Error scraping completed matches for teams:', error);
    }

    const teams = Array.from(uniqueTeams.values()).sort((a, b) => b.recent_matches_count - a.recent_matches_count);

    return NextResponse.json({
      success: true,
      data: {
        teams,
        total: teams.length,
        scraped_at: new Date().toISOString()
      }
    } as ApiResponse<{ teams: RealtimeTeam[], total: number, scraped_at: string }>);

  } catch (error) {
    console.error('Error scraping teams:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to scrape teams from VLR.gg'
    } as ApiResponse<null>, { status: 500 });
  }
}
