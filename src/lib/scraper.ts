import axios from 'axios';
import * as cheerio from 'cheerio';
import { MatchDetailScrapeData, MapData, PlayerStats, ScrapeResponse } from '@/types';
import { DatabaseService } from './database';

export class VLRScraper {
  private baseUrl = 'https://www.vlr.gg';
  private rateLimitMs = 1000; // 1 second between requests
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest(url: string): Promise<cheerio.CheerioAPI | null> {
    try {
      await this.delay(this.rateLimitMs);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 10000,
      });

      return cheerio.load(response.data);
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  private cleanTextContent(text: string): string {
    if (!text) return text;
    
    // Remove all excessive whitespace, tabs, and newlines
    let cleaned = text.replace(/[\t\n\r\s]+/g, ' ').trim();
    
    // Remove common VLR.gg artifacts and formatting
    cleaned = cleaned.replace(/\b(PICK|BAN|DECIDER)\b/gi, '').trim();
    
    // Remove timestamps (patterns like "16:30", "47:21", etc.)
    cleaned = cleaned.replace(/\b\d{1,2}:\d{2}\b/g, '').trim();
    
    // Clean up any double spaces that might remain
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    
    return cleaned;
  }

  private parseTimeString(timeStr: string): string | undefined {
    if (!timeStr) return undefined;

    const cleanTime = timeStr.trim().toLowerCase();

    // Handle "live" status
    if (cleanTime.includes('live')) {
      return new Date().toISOString();
    }

    // Handle relative time formats (e.g., "2h 30m", "48m", "1d 2h")
    try {
      const now = new Date();
      let totalMinutes = 0;

      // Parse days
      const dayMatch = cleanTime.match(/(\d+)d/);
      if (dayMatch) {
        totalMinutes += parseInt(dayMatch[1]) * 24 * 60;
      }

      // Parse hours
      const hourMatch = cleanTime.match(/(\d+)h/);
      if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1]) * 60;
      }

      // Parse minutes
      const minuteMatch = cleanTime.match(/(\d+)m/);
      if (minuteMatch) {
        totalMinutes += parseInt(minuteMatch[1]);
      }

      if (totalMinutes > 0) {
        const futureTime = new Date(now.getTime() + totalMinutes * 60 * 1000);
        return futureTime.toISOString();
      }
    } catch (error) {
      console.error('Error parsing time string:', error);
    }

    return undefined;
  }

  private extractMatchIdFromUrl(url: string): string | null {
    const match = url.match(/\/(\d+)\//);
    return match ? match[1] : null;
  }

  public async scrapeMatchesList(matchesType: 'upcoming' | 'results' | '' = ''): Promise<MatchDetailScrapeData[]> {
    const url = `${this.baseUrl}/matches/${matchesType}`;
    console.log(`Scraping matches from: ${url}`);

    const $ = await this.makeRequest(url);
    if (!$) {
      throw new Error(`Failed to fetch matches page: ${url}`);
    }

    const matches: MatchDetailScrapeData[] = [];

    // Find match containers - VLR.gg uses different selectors
    const matchContainers = $('a.wf-module-item, a.match-item').toArray();

    for (const container of matchContainers) {
      try {
        const matchData = this.parseMatchContainer($, container);
        if (matchData) {
          matches.push(matchData);
        }
      } catch (error) {
        console.error('Error parsing match container:', error);
      }
    }

    console.log(`Found ${matches.length} matches from ${url}`);
    return matches;
  }

  private parseMatchContainer($: cheerio.CheerioAPI, container: cheerio.Element): MatchDetailScrapeData | null {
    try {
      const $container = $(container);
      
      // Extract match URL and ID
      const matchUrl = $container.attr('href');
      if (!matchUrl) return null;

      const fullMatchUrl = matchUrl.startsWith('http') ? matchUrl : `${this.baseUrl}${matchUrl}`;
      const vlrMatchId = this.extractMatchIdFromUrl(fullMatchUrl);
      if (!vlrMatchId) return null;

      // Extract team names and logos
      const teamElements = $container.find('.match-item-vs-team-name .text-of').toArray();
      
      let team1Name = '';
      let team2Name = '';
      let team1LogoUrl = '';
      let team2LogoUrl = '';

      if (teamElements.length >= 2) {
        team1Name = $(teamElements[0]).text().trim();
        team2Name = $(teamElements[1]).text().trim();
      } else {
        // Alternative selectors for team names
        const allTeamText = $container.find('.match-item-vs-team .text-of, [class*="team"]').map((i, el) => $(el).text().trim()).get();
        const validTeams = allTeamText.filter(text => text && text !== 'vs' && text !== '–' && text !== '-');
        if (validTeams.length >= 2) {
          team1Name = validTeams[0];
          team2Name = validTeams[1];
        }
      }

      // Note: Team logos are not available in match list view on VLR.gg
      // They only show country flags. Team logos would need to be scraped from team pages separately.

      // Extract scores
      const scoreElements = $container.find('.match-item-vs-team-score, .score, [class*="score"]').toArray();
      let team1Score = 0;
      let team2Score = 0;

      if (scoreElements.length >= 2) {
        const score1Text = $(scoreElements[0]).text().trim();
        const score2Text = $(scoreElements[1]).text().trim();
        
        team1Score = score1Text && !isNaN(parseInt(score1Text)) ? parseInt(score1Text) : 0;
        team2Score = score2Text && !isNaN(parseInt(score2Text)) ? parseInt(score2Text) : 0;
      }

      // Determine status
      let status: 'upcoming' | 'live' | 'completed' = 'upcoming';
      const statusText = $container.find('.match-item-time, .time, [class*="time"], [class*="live"]').text().toLowerCase();
      
      if (statusText.includes('live')) {
        status = 'live';
      } else if (team1Score > 0 || team2Score > 0) {
        status = 'completed';
      }

      // Extract tournament info and logo
      const tournamentElement = $container.find('.match-item-event, .event, [class*="event"], .tournament').first();
      const rawTournamentName = tournamentElement.text().trim() || 'Unknown Tournament';
      const tournamentName = this.cleanTextContent(rawTournamentName);
      
      // Extract tournament logo from match-item-icon
      const tournamentLogo = $container.find('.match-item-icon img').first();
      const tournamentLogoSrc = tournamentLogo.attr('src');
      let tournamentLogoUrl = '';
      
      if (tournamentLogoSrc) {
        // Handle different URL formats from VLR.gg
        if (tournamentLogoSrc.startsWith('//')) {
          tournamentLogoUrl = `https:${tournamentLogoSrc}`;
        } else if (tournamentLogoSrc.startsWith('http')) {
          tournamentLogoUrl = tournamentLogoSrc;
        } else if (tournamentLogoSrc.startsWith('/')) {
          tournamentLogoUrl = `${this.baseUrl}${tournamentLogoSrc}`;
        }
      }

      // Extract stage/series info
      const stageElement = $container.find('.match-item-event-series, .series, [class*="series"]').first();
      const rawStage = stageElement.text().trim();
      const stage = this.cleanTextContent(rawStage);

      // Extract time
      const timeElement = $container.find('.match-item-time, .time').first();
      const timeText = timeElement.text().trim();
      const matchTime = this.parseTimeString(timeText);

      // Determine match format (default to Bo3)
      let matchFormat = 'Bo3';
      const formatText = $container.text().toLowerCase();
      if (formatText.includes('bo1')) {
        matchFormat = 'Bo1';
      } else if (formatText.includes('bo5')) {
        matchFormat = 'Bo5';
      }

      return {
        vlr_match_id: vlrMatchId,
        team1_name: team1Name || undefined,
        team2_name: team2Name || undefined,
        team1_score: team1Score,
        team2_score: team2Score,
        tournament_name: tournamentName,
        status,
        match_time: matchTime,
        match_format: matchFormat,
        stage: stage || undefined,
        match_url: fullMatchUrl,
        team1_logo_url: team1LogoUrl || undefined,
        team2_logo_url: team2LogoUrl || undefined,
        tournament_logo_url: tournamentLogoUrl || undefined
      };

    } catch (error) {
      console.error('Error parsing match container:', error);
      return null;
    }
  }

  public async scrapeMatchDetails(vlrMatchId: string): Promise<MatchDetailScrapeData | null> {
    // First, get the match from database to get its URL
    const matches = this.db.getMatches('all', 1000, 0);
    const existingMatch = matches.matches.find(m => m.vlr_match_id === vlrMatchId);
    
    if (!existingMatch?.match_url) {
      console.error(`No match URL found for VLR match ID: ${vlrMatchId}`);
      return null;
    }

    console.log(`Scraping detailed match data from: ${existingMatch.match_url}`);

    const $ = await this.makeRequest(existingMatch.match_url);
    if (!$) {
      console.error(`Failed to fetch match details page: ${existingMatch.match_url}`);
      return null;
    }

    try {
      // Extract detailed match information
      const mapsData: MapData[] = [];
      const playerStats: PlayerStats[] = [];

      // Parse map results
      const mapContainers = $('.vm-stats-game, .map-result, [class*="map"]').toArray();
      
      for (const mapContainer of mapContainers) {
        const mapData = this.parseMapData($, mapContainer);
        if (mapData) {
          mapsData.push(mapData);
        }
      }

      // Parse player statistics
      const playerRows = $('.vm-stats-game-player, .player-stats-row, [class*="player"]').toArray();
      
      for (const playerRow of playerRows) {
        const playerData = this.parsePlayerStats($, playerRow);
        if (playerData) {
          playerStats.push(playerData);
        }
      }

      // Extract VOD and stats URLs
      const vodUrl = $('a[href*="youtube"], a[href*="twitch"], .vod-link').attr('href');
      const statsUrl = $('a[href*="stats"], .stats-link').attr('href');

      return {
        vlr_match_id: vlrMatchId,
        team1_name: existingMatch.team1?.name,
        team2_name: existingMatch.team2?.name,
        team1_score: existingMatch.team1_score,
        team2_score: existingMatch.team2_score,
        tournament_name: existingMatch.tournament?.name,
        status: existingMatch.status,
        match_time: existingMatch.match_time,
        match_format: existingMatch.match_format,
        stage: existingMatch.stage,
        match_url: existingMatch.match_url,
        maps_data: mapsData.length > 0 ? mapsData : undefined,
        player_stats: playerStats.length > 0 ? playerStats : undefined,
        vod_url: vodUrl ? (vodUrl.startsWith('http') ? vodUrl : `${this.baseUrl}${vodUrl}`) : undefined,
        stats_url: statsUrl ? (statsUrl.startsWith('http') ? statsUrl : `${this.baseUrl}${statsUrl}`) : undefined
      };

    } catch (error) {
      console.error(`Error scraping match details for ${vlrMatchId}:`, error);
      return null;
    }
  }

  private parseMapData($: cheerio.CheerioAPI, mapContainer: cheerio.Element): MapData | null {
    try {
      const $map = $(mapContainer);

      // Extract map name
      const mapNameElement = $map.find('.map-name, .vm-stats-game-header-map, [class*="map"]').first();
      let mapName = mapNameElement.text().trim();
      
      // Clean up map name - remove whitespace, tabs, newlines, and extra text
      if (mapName) {
        // Remove all whitespace, tabs, and newlines
        mapName = mapName.replace(/[\t\n\r\s]+/g, ' ').trim();
        
        // Remove common VLR.gg artifacts like "PICK", "BAN", timestamps, etc.
        mapName = mapName.replace(/\b(PICK|BAN|DECIDER)\b/gi, '').trim();
        
        // Remove timestamps (patterns like "16:30", "47:21", etc.)
        mapName = mapName.replace(/\b\d{1,2}:\d{2}\b/g, '').trim();
        
        // Extract just the map name (first word should be the actual map)
        const mapWords = mapName.split(/\s+/);
        const validMaps = ['Bind', 'Haven', 'Split', 'Ascent', 'Dust2', 'Inferno', 'Mirage', 'Cache', 'Overpass', 'Vertigo', 'Nuke', 'Train', 'Cobblestone', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss'];
        
        // Find the first valid map name in the text
        for (const word of mapWords) {
          const cleanWord = word.replace(/[^\w]/g, '');
          const foundMap = validMaps.find(map => map.toLowerCase() === cleanWord.toLowerCase());
          if (foundMap) {
            mapName = foundMap;
            break;
          }
        }
        
        // If no valid map found but we have text, take the first meaningful word
        if (!validMaps.some(map => map.toLowerCase() === mapName.toLowerCase()) && mapWords.length > 0) {
          mapName = mapWords[0].replace(/[^\w]/g, '');
        }
      }

      // Extract map scores
      const scoreElements = $map.find('.score, .vm-stats-game-header-score, [class*="score"]').toArray();
      let team1Score = 0;
      let team2Score = 0;

      if (scoreElements.length >= 2) {
        const score1 = $(scoreElements[0]).text().trim();
        const score2 = $(scoreElements[1]).text().trim();
        
        team1Score = !isNaN(parseInt(score1)) ? parseInt(score1) : 0;
        team2Score = !isNaN(parseInt(score2)) ? parseInt(score2) : 0;
      }

      // Extract agent picks
      const agents: string[] = [];
      const agentElements = $map.find('img[src*="agent"], .agent-icon, [class*="agent"]').toArray();
      
      for (const agentEl of agentElements) {
        const agentSrc = $(agentEl).attr('src') || '';
        if (agentSrc) {
          // Extract agent name from image path
          const agentName = agentSrc.split('/').pop()?.split('.')[0] || '';
          if (agentName) {
            agents.push(agentName);
          }
        }
      }

      if (!mapName && team1Score === 0 && team2Score === 0 && agents.length === 0) {
        return null;
      }

      return {
        map_name: mapName || 'Unknown Map',
        team1_score: team1Score,
        team2_score: team2Score,
        agents
      };

    } catch (error) {
      console.error('Error parsing map data:', error);
      return null;
    }
  }

  private parsePlayerStats($: cheerio.CheerioAPI, playerRow: cheerio.Element): PlayerStats | null {
    try {
      const $row = $(playerRow);

      // Extract player name
      const nameElement = $row.find('.player-name, .vm-stats-game-player-name, [class*="name"]').first();
      const playerName = nameElement.text().trim();

      if (!playerName) return null;

      // Extract agent
      const agentElement = $row.find('img[src*="agent"], .agent').first();
      const agentSrc = agentElement.attr('src') || '';
      const agent = agentSrc ? agentSrc.split('/').pop()?.split('.')[0] || '' : '';

      // Extract stats (kills, deaths, assists, etc.)
      const statElements = $row.find('.stat, .vm-stats-game-player-stat, [class*="stat"]').toArray();
      
      // Default stats
      let kills = 0;
      let deaths = 0;
      let assists = 0;
      let acs = 0;
      let kd = 0;
      let adr = 0;
      let hsPercent = 0;
      let fk = 0;
      let fd = 0;

      // Try to extract stats from various selectors
      const statsText = $row.text();
      const statNumbers = statsText.match(/\d+/g) || [];
      
      if (statNumbers.length >= 3) {
        kills = parseInt(statNumbers[0]) || 0;
        deaths = parseInt(statNumbers[1]) || 0;
        assists = parseInt(statNumbers[2]) || 0;
        
        if (statNumbers.length >= 4) acs = parseInt(statNumbers[3]) || 0;
        if (statNumbers.length >= 6) adr = parseInt(statNumbers[5]) || 0;
      }

      // Calculate K/D ratio
      kd = deaths > 0 ? kills / deaths : kills;

      return {
        player_name: playerName,
        team: 'team1', // This would need more context to determine correctly
        agent,
        kills,
        deaths,
        assists,
        acs,
        k_d_ratio: Math.round(kd * 100) / 100,
        adr,
        headshot_percentage: hsPercent,
        first_kills: fk,
        first_deaths: fd,
        maps_played: 1
      };

    } catch (error) {
      console.error('Error parsing player stats:', error);
      return null;
    }
  }

  public async scrapeAllMatches(): Promise<ScrapeResponse> {
    const startTime = Date.now();
    const errors: string[] = [];
    let matchesScraped = 0;
    let matchesUpdated = 0;
    let newTeams = 0;
    let newTournaments = 0;

    try {
      // Log start of scraping
      this.db.logScraping('full_scrape', `${this.baseUrl}/matches`, 'in_progress');

      // Scrape upcoming matches
      try {
        const upcomingMatches = await this.scrapeMatchesList('');
        for (const matchData of upcomingMatches) {
          try {
            const existingMatch = this.db.getMatches('all', 1000, 0).matches.find(m => m.vlr_match_id === matchData.vlr_match_id);
            
            this.db.saveMatch(matchData);
            
            if (existingMatch) {
              matchesUpdated++;
            } else {
              matchesScraped++;
            }
          } catch (error) {
            errors.push(`Error saving upcoming match ${matchData.vlr_match_id}: ${error}`);
          }
        }
      } catch (error) {
        errors.push(`Error scraping upcoming matches: ${error}`);
      }

      // Scrape completed matches
      try {
        const completedMatches = await this.scrapeMatchesList('results');
        for (const matchData of completedMatches) {
          try {
            const existingMatch = this.db.getMatches('all', 1000, 0).matches.find(m => m.vlr_match_id === matchData.vlr_match_id);
            
            this.db.saveMatch(matchData);
            
            if (existingMatch) {
              matchesUpdated++;
            } else {
              matchesScraped++;
            }
          } catch (error) {
            errors.push(`Error saving completed match ${matchData.vlr_match_id}: ${error}`);
          }
        }
      } catch (error) {
        errors.push(`Error scraping completed matches: ${error}`);
      }

      // Get updated stats
      const stats = this.db.getStats();
      newTeams = stats.total_teams;
      newTournaments = stats.total_tournaments;

      // Log successful completion
      this.db.logScraping('full_scrape', `${this.baseUrl}/matches`, 'success', undefined, matchesScraped + matchesUpdated);

      const duration = Date.now() - startTime;

      return {
        success: true,
        matches_scraped: matchesScraped,
        matches_updated: matchesUpdated,
        new_teams: newTeams,
        new_tournaments: newTournaments,
        errors,
        duration_ms: duration
      };

    } catch (error) {
      // Log error
      this.db.logScraping('full_scrape', `${this.baseUrl}/matches`, 'error', String(error));
      
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        matches_scraped: matchesScraped,
        matches_updated: matchesUpdated,
        new_teams: newTeams,
        new_tournaments: newTournaments,
        errors: [...errors, `Critical error: ${error}`],
        duration_ms: duration
      };
    }
  }
}