import axios from "axios";
import * as cheerio from "cheerio";
import {
  MatchDetailScrapeData,
  MapData,
  PlayerStats,
  ScrapeResponse,
  RoundData,
} from "@/types";

export class VLRScraper {
  private baseUrl = "https://www.vlr.gg";
  private rateLimitMs = 1000; // 1 second between requests

  constructor() {
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async makeRequest(url: string): Promise<cheerio.CheerioAPI | null> {
    try {
      await this.delay(this.rateLimitMs);

      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
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
    let cleaned = text.replace(/[\t\n\r\s]+/g, " ").trim();

    // Remove common VLR.gg artifacts and formatting
    cleaned = cleaned.replace(/\b(PICK|BAN|DECIDER)\b/gi, "").trim();

    // Remove timestamps (patterns like "16:30", "47:21", etc.)
    cleaned = cleaned.replace(/\b\d{1,2}:\d{2}\b/g, "").trim();

    // Clean up any double spaces that might remain
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

    return cleaned;
  }

  private parseTimeString(timeStr: string): string | undefined {
    if (!timeStr) return undefined;

    const cleanTime = timeStr.trim().toLowerCase();

    // Handle "live" status
    if (cleanTime.includes("live")) {
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
      console.error("Error parsing time string:", error);
    }

    return undefined;
  }

  private extractMatchIdFromUrl(url: string): string | null {
    const match = url.match(/\/(\d+)\//);
    return match ? match[1] : null;
  }

  public async scrapeMatchesList(
    matchesType: "upcoming" | "results" | "" = ""
  ): Promise<MatchDetailScrapeData[]> {
    const url = `${this.baseUrl}/matches/${matchesType}`;
    console.log(`Scraping matches from: ${url}`);

    const $ = await this.makeRequest(url);
    if (!$) {
      throw new Error(`Failed to fetch matches page: ${url}`);
    }

    const matches: MatchDetailScrapeData[] = [];

    // Find match containers - VLR.gg uses different selectors
    const matchContainers = $("a.wf-module-item, a.match-item").toArray();

    for (const container of matchContainers) {
      try {
        const matchData = this.parseMatchContainer($, container);
        if (matchData) {
          matches.push(matchData);
        }
      } catch (error) {
        console.error("Error parsing match container:", error);
      }
    }

    console.log(`Found ${matches.length} matches from ${url}`);
    return matches;
  }

  private parseMatchContainer(
    $: cheerio.CheerioAPI,
    container: cheerio.Element
  ): MatchDetailScrapeData | null {
    try {
      const $container = $(container);

      // Extract match URL and ID
      const matchUrl = $container.attr("href");
      if (!matchUrl) return null;

      const fullMatchUrl = matchUrl.startsWith("http")
        ? matchUrl
        : `${this.baseUrl}${matchUrl}`;
      const vlrMatchId = this.extractMatchIdFromUrl(fullMatchUrl);
      if (!vlrMatchId) return null;

      // Extract team names and logos
      const teamElements = $container
        .find(".match-item-vs-team-name .text-of")
        .toArray();

      let team1Name = "";
      let team2Name = "";
      let team1LogoUrl = "";
      let team2LogoUrl = "";

      if (teamElements.length >= 2) {
        team1Name = $(teamElements[0]).text().trim();
        team2Name = $(teamElements[1]).text().trim();
      } else {
        // Alternative selectors for team names
        const allTeamText = $container
          .find('.match-item-vs-team .text-of, [class*="team"]')
          .map((i, el) => $(el).text().trim())
          .get();
        const validTeams = allTeamText.filter(
          (text) => text && text !== "vs" && text !== "–" && text !== "-"
        );
        if (validTeams.length >= 2) {
          team1Name = validTeams[0];
          team2Name = validTeams[1];
        }
      }

      // Note: Team logos are not available in match list view on VLR.gg
      // They only show country flags. Team logos would need to be scraped from team pages separately.

      // Extract scores
      const scoreElements = $container
        .find('.match-item-vs-team-score, .score, [class*="score"]')
        .toArray();
      let team1Score = 0;
      let team2Score = 0;

      if (scoreElements.length >= 2) {
        const score1Text = $(scoreElements[0]).text().trim();
        const score2Text = $(scoreElements[1]).text().trim();

        team1Score =
          score1Text && !isNaN(parseInt(score1Text)) ? parseInt(score1Text) : 0;
        team2Score =
          score2Text && !isNaN(parseInt(score2Text)) ? parseInt(score2Text) : 0;
      }

      // Determine status (restore previous logic for match list)
      let status: "upcoming" | "live" | "completed" = "upcoming";
      const statusText = $container
        .find('.match-item-time, .time, [class*="time"], [class*="live"]')
        .text()
        .toLowerCase();
      if (statusText.includes("live")) {
        status = "live";
      } else if (team1Score > 0 || team2Score > 0) {
        status = "completed";
      }

      // Extract tournament info and logo
      const tournamentElement = $container
        .find('.match-item-event, .event, [class*="event"], .tournament')
        .first();
      const rawTournamentName =
        tournamentElement.text().trim() || "Unknown Tournament";
      const tournamentName = this.cleanTextContent(rawTournamentName);

      // Extract tournament logo from match-item-icon
      const tournamentLogo = $container.find(".match-item-icon img").first();
      const tournamentLogoSrc = tournamentLogo.attr("src");
      let tournamentLogoUrl = "";

      if (tournamentLogoSrc) {
        // Handle different URL formats from VLR.gg
        if (tournamentLogoSrc.startsWith("//")) {
          tournamentLogoUrl = `https:${tournamentLogoSrc}`;
        } else if (tournamentLogoSrc.startsWith("http")) {
          tournamentLogoUrl = tournamentLogoSrc;
        } else if (tournamentLogoSrc.startsWith("/")) {
          tournamentLogoUrl = `${this.baseUrl}${tournamentLogoSrc}`;
        }
      }

      // Extract stage/series info
      const stageElement = $container
        .find('.match-item-event-series, .series, [class*="series"]')
        .first();
      const rawStage = stageElement.text().trim();
      const stage = this.cleanTextContent(rawStage);

      // Extract time
      const timeElement = $container.find(".match-item-time, .time").first();
      const timeText = timeElement.text().trim();
      const matchTime = this.parseTimeString(timeText);

      // Determine match format (default to Bo3)
      let matchFormat = "Bo3";
      const formatText = $container.text().toLowerCase();
      if (formatText.includes("bo1")) {
        matchFormat = "Bo1";
      } else if (formatText.includes("bo5")) {
        matchFormat = "Bo5";
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
        tournament_logo_url: tournamentLogoUrl || undefined,
      };
    } catch (error) {
      console.error("Error parsing match container:", error);
      return null;
    }
  }

  public async scrapeMatchDetails(
    vlrMatchId: string
  ): Promise<MatchDetailScrapeData | null> {
    try {
      const url = `${this.baseUrl}/match/${vlrMatchId}`;
      console.log(`Scraping match details from: ${url}`);
      const $ = await this.makeRequest(url);
      if (!$) return null;

      // Extract team information with multiple fallback selectors
      let team1Name = "";
      let team2Name = "";
      let team1LogoUrl = "";
      let team2LogoUrl = "";

      // Try multiple selectors for team names
      const teamElements = $(".match-header-vs-team").toArray();
      if (teamElements.length >= 2) {
        team1Name = $(teamElements[0]).find(".text-of, .team-name").text().trim();
        team2Name = $(teamElements[1]).find(".text-of, .team-name").text().trim();
        
        // Extract team logos
        team1LogoUrl = $(teamElements[0]).find("img").attr("src") || "";
        team2LogoUrl = $(teamElements[1]).find("img").attr("src") || "";
        
        // Fix relative URLs
        if (team1LogoUrl && !team1LogoUrl.startsWith("http")) {
          team1LogoUrl = team1LogoUrl.startsWith("//") ? `https:${team1LogoUrl}` : `${this.baseUrl}${team1LogoUrl}`;
        }
        if (team2LogoUrl && !team2LogoUrl.startsWith("http")) {
          team2LogoUrl = team2LogoUrl.startsWith("//") ? `https:${team2LogoUrl}` : `${this.baseUrl}${team2LogoUrl}`;
        }
      }
      
      // Fallback selectors if primary ones fail
      if (!team1Name || !team2Name) {
        const fallbackTeams = $(".team .team-name, .match-team .team-name").map((i, el) => $(el).text().trim()).get();
        if (fallbackTeams.length >= 2) {
          team1Name = team1Name || fallbackTeams[0];
          team2Name = team2Name || fallbackTeams[1];
        }
      }

      // Extract scores
      const scoreElements = $(".match-header-vs-score .js-spoiler, .match-header-vs-score .score, .team-score").toArray();
      let team1Score = 0;
      let team2Score = 0;

      if (scoreElements.length >= 2) {
        team1Score = parseInt($(scoreElements[0]).text().trim()) || 0;
        team2Score = parseInt($(scoreElements[1]).text().trim()) || 0;
      } else {
        // Alternative score extraction
        const allScores = $(".score, [class*='score']").map((i, el) => {
          const scoreText = $(el).text().trim();
          return !isNaN(parseInt(scoreText)) ? parseInt(scoreText) : null;
        }).get().filter(s => s !== null);
        
        if (allScores.length >= 2) {
          team1Score = allScores[0];
          team2Score = allScores[1];
        }
      }

      // Extract tournament info with multiple selectors
      let tournamentName = "";
      let tournamentLogoUrl = "";
      
      // Try multiple selectors for tournament
      const tournamentSelectors = [
        ".match-header-event .text-of",
        ".match-header-event",
        ".event-name",
        ".tournament-name",
        ".match-header .event"
      ];
      
      for (const selector of tournamentSelectors) {
        const element = $(selector).first();
        if (element.length && element.text().trim()) {
          tournamentName = this.cleanTextContent(element.text().trim());
          break;
        }
      }
      
      // Extract tournament logo
      const tournamentLogo = $(".match-header-event img, .event img, .tournament img").first();
      if (tournamentLogo.length) {
        tournamentLogoUrl = tournamentLogo.attr("src") || "";
        if (tournamentLogoUrl && !tournamentLogoUrl.startsWith("http")) {
          tournamentLogoUrl = tournamentLogoUrl.startsWith("//") ? `https:${tournamentLogoUrl}` : `${this.baseUrl}${tournamentLogoUrl}`;
        }
      }
      
      if (!tournamentName) {
        // Fallback: try to get from page title or other header
        const pageTitle = $("title").text();
        if (pageTitle) {
          tournamentName = this.cleanTextContent(pageTitle.split("-")[0].trim());
        }
      }

      // Extract match time from multiple possible locations
      let matchTime: string | undefined;
      const timeSelectors = [
        ".match-header-date",
        ".match-time",
        ".time",
        "[class*='time']"
      ];
      
      for (const selector of timeSelectors) {
        const timeElement = $(selector).first();
        if (timeElement.length) {
          const timeText = timeElement.text().trim();
          matchTime = this.parseTimeString(timeText);
          if (matchTime) break;
        }
      }

      // Extract status with improved detection
      let status: "upcoming" | "live" | "completed" = "completed";
      
      // Check multiple status indicators
      const statusSelectors = [
        ".match-header-status",
        ".match-status",
        ".status",
        "[class*='status']",
        "[class*='live']"
      ];
      
      let statusText = "";
      for (const selector of statusSelectors) {
        const element = $(selector).first();
        if (element.length) {
          statusText = element.text().toLowerCase();
          break;
        }
      }
      
      // Determine status based on various indicators
      if (statusText.includes("live") || $(".live, [class*='live']").length > 0) {
        status = "live";
      } else if (statusText.includes("final") || statusText.includes("completed") || (team1Score > 0 || team2Score > 0)) {
        status = "completed";
      } else if (team1Score === 0 && team2Score === 0) {
        status = "upcoming";
      }

      // Extract match format
      let matchFormat = "Bo3";
      const formatSelectors = [
        ".match-header-vs-note",
        ".match-format",
        ".format",
        ".series-type"
      ];
      
      let formatText = "";
      for (const selector of formatSelectors) {
        const element = $(selector).first();
        if (element.length) {
          formatText = element.text().toLowerCase();
          break;
        }
      }
      
      if (formatText.includes("bo1") || formatText.includes("best of 1")) {
        matchFormat = "Bo1";
      } else if (formatText.includes("bo5") || formatText.includes("best of 5")) {
        matchFormat = "Bo5";
      } else if (formatText.includes("bo3") || formatText.includes("best of 3")) {
        matchFormat = "Bo3";
      }

      // Extract stage
      let stage = "";
      const stageSelectors = [
        ".match-header-vs-note",
        ".match-stage",
        ".stage",
        ".series-info"
      ];
      
      for (const selector of stageSelectors) {
        const element = $(selector).first();
        if (element.length) {
          stage = this.cleanTextContent(element.text().trim());
          break;
        }
      }

      // Extract maps data with comprehensive selectors
      const maps: MapData[] = [];
      
      // Try multiple selectors for map containers
      const mapSelectors = [
        ".vm-stats-game",
        ".vm-stats-games-container > .vm-stats-game", 
        ".match-header-vs-map",
        ".map-item",
        ".game-item",
        "[class*='map-']"
      ];
      
      let mapElems: cheerio.Element[] = [];
      for (const selector of mapSelectors) {
        mapElems = $(selector).toArray();
        if (mapElems.length > 0) {
          console.log(`Found ${mapElems.length} maps using selector: ${selector}`);
          break;
        }
      }
      
      if (mapElems.length === 0) {
        console.warn(`No maps found for match ${vlrMatchId}`);
      }
      
      for (const mapElem of mapElems) {
        const $map = $(mapElem);
        
        // Extract map name with multiple fallbacks
        let mapName = "";
        const mapNameSelectors = [
          ".map > div > span",
          ".map-name",
          ".map",
          ".match-header-vs-map-name",
          "[class*='map'] span",
          "[class*='map'] div"
        ];
        
        for (const selector of mapNameSelectors) {
          const element = $map.find(selector).first();
          if (element.length) {
            mapName = element.clone().children().remove().end().text().trim();
            if (mapName && mapName !== "Unknown Map") break;
          }
        }
        
        if (!mapName) {
          mapName = "Unknown Map";
        }
        
        // Extract map scores
        let mapTeam1Score = 0;
        let mapTeam2Score = 0;
        
        const scoreElems = $map.find(".score, .team-score, [class*='score']").toArray();
        if (scoreElems.length >= 2) {
          mapTeam1Score = parseInt($(scoreElems[0]).text().trim()) || 0;
          mapTeam2Score = parseInt($(scoreElems[1]).text().trim()) || 0;
        } else {
          // Alternative score extraction
          const teamElems = $map.find(".team").toArray();
          if (teamElems.length >= 2) {
            mapTeam1Score = parseInt($(teamElems[0]).find(".score, [class*='score']").text().trim()) || 0;
            mapTeam2Score = parseInt($(teamElems[1]).find(".score, [class*='score']").text().trim()) || 0;
          }
        }
        
        // Extract agent picks
        const agents: string[] = [];
        $map.find('img[src*="agent"], .agent-icon, [class*="agent"] img').each((_, agentEl) => {
          const agentSrc = $(agentEl).attr("src") || "";
          if (agentSrc) {
            const agentName = agentSrc.split("/").pop()?.split(".")[0] || "";
            if (agentName && !agents.includes(agentName)) {
              agents.push(agentName);
            }
          }
        });
        
        // Extract rounds data
        const rounds_data: RoundData[] = [];
        $map.find(".vlr-rounds-row-col[title], .round, [class*='round']").each((roundIdx, roundEl) => {
          const $round = $(roundEl);
          const title = $round.attr("title") || "";
          
          // Parse round score from title
          const scoreMatch = title.match(/(\d+)[-:](\d+)/);
          let round_score_team1: number | undefined;
          let round_score_team2: number | undefined;
          if (scoreMatch) {
            round_score_team1 = parseInt(scoreMatch[1]);
            round_score_team2 = parseInt(scoreMatch[2]);
          }
          
          // Determine round winner
          let winner: "team1" | "team2" | undefined;
          if ($round.find(".rnd-sq.mod-win.mod-t, .round-win.team1").length) {
            winner = "team1";
          } else if ($round.find(".rnd-sq.mod-win.mod-ct, .round-win.team2").length) {
            winner = "team2";
          }
          
          // Determine win method
          let win_method: "elimination" | "bomb" | "time" | undefined;
          const imgSrc = $round.find(".rnd-sq.mod-win img").attr("src") || "";
          if (imgSrc.includes("elim") || imgSrc.includes("kill")) {
            win_method = "elimination";
          } else if (imgSrc.includes("defuse") || imgSrc.includes("boom") || imgSrc.includes("bomb")) {
            win_method = "bomb";
          } else if (imgSrc.includes("time")) {
            win_method = "time";
          }
          
          // Determine round type (basic heuristic)
          let round_type: "pistol" | "eco" | "force_buy" | "full_buy" = "full_buy";
          if (roundIdx === 0 || roundIdx === 12) {
            round_type = "pistol";
          }
          
          rounds_data.push({
            round_number: roundIdx + 1,
            winner,
            round_type,
            win_method,
          });
        });
        
        maps.push({
          map_name: mapName,
          team1_score: mapTeam1Score,
          team2_score: mapTeam2Score,
          agents,
          rounds_data,
        });
      }

      // Extract player statistics if available
      const player_stats: PlayerStats[] = [];
      $(".vm-stats-game-team, .player-stats-row, [class*='player']").each((_, playerEl) => {
        const $player = $(playerEl);
        const playerName = $player.find(".player-name, .text-of").text().trim();
        
        if (playerName) {
          // Extract basic stats (this would need to be expanded based on VLR's actual structure)
          const kills = parseInt($player.find(".stat-kills, [data-stat='kills']").text().trim()) || 0;
          const deaths = parseInt($player.find(".stat-deaths, [data-stat='deaths']").text().trim()) || 0;
          const assists = parseInt($player.find(".stat-assists, [data-stat='assists']").text().trim()) || 0;
          
          player_stats.push({
            player_name: playerName,
            team: "team1", // This would need better logic to determine team
            agent: "", // Would need to extract from agent icons
            kills,
            deaths,
            assists,
            acs: 0,
            k_d_ratio: deaths > 0 ? kills / deaths : kills,
            adr: 0,
            headshot_percentage: 0,
            first_kills: 0,
            first_deaths: 0,
            maps_played: 1
          });
        }
      });

      // Extract VOD and stats URLs
      let vod_url: string | undefined;
      let stats_url: string | undefined;
      
      $("a[href*='youtube'], a[href*='twitch'], a[href*='vod']").each((_, linkEl) => {
        const href = $(linkEl).attr("href");
        if (href && !vod_url) {
          vod_url = href.startsWith("http") ? href : `${this.baseUrl}${href}`;
        }
      });
      
      $("a[href*='stats']").each((_, linkEl) => {
        const href = $(linkEl).attr("href");
        if (href && !stats_url) {
          stats_url = href.startsWith("http") ? href : `${this.baseUrl}${href}`;
        }
      });

      console.log(`Successfully scraped match ${vlrMatchId}: ${team1Name} vs ${team2Name} (${team1Score}-${team2Score})`);
      console.log(`Found ${maps.length} maps, ${player_stats.length} player stats`);

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
        match_url: url,
        team1_logo_url: team1LogoUrl || undefined,
        team2_logo_url: team2LogoUrl || undefined,
        tournament_logo_url: tournamentLogoUrl || undefined,
        maps_data: maps,
        player_stats: player_stats.length > 0 ? player_stats : undefined,
        vod_url,
        stats_url
      };
    } catch (error) {
      console.error(`Error parsing match details for ${vlrMatchId}:`, error);
      return null;
    }
  }

  public async scrapeAllMatches(): Promise<ScrapeResponse> {
    const response: ScrapeResponse = {
      success: true,
      matches_scraped: 0,
      matches_updated: 0,
      new_teams: 0,
      new_tournaments: 0,
      errors: [],
      duration_ms: 0
      duration_ms: 0
    };

    const startTime = Date.now();

    const startTime = Date.now();

    try {
      console.log('Starting comprehensive match scraping...');
      
      // Scrape matches from all categories
      const upcomingMatches = await this.scrapeMatchesList('upcoming');
      const liveMatches = await this.scrapeMatchesList('');
      const resultMatches = await this.scrapeMatchesList('results');
      
      // Combine all matches and get unique match IDs
      const allMatches = [...upcomingMatches, ...liveMatches, ...resultMatches];
      const uniqueMatchIds = new Set<string>();
      for (const match of allMatches) {
        if (match.vlr_match_id && !uniqueMatchIds.has(match.vlr_match_id)) {
          uniqueMatchIds.add(match.vlr_match_id);
        }
      
            response.matches_scraped++;
            console.log(`Successfully processed match ${matchId}`);
          } else {
            const error = `Failed to scrape detailed data for match ${matchId}`;
            console.warn(error);
            response.errors.push(error);
      console.log(`Scraping completed: ${response.matches_scraped} matches processed`);
      
      if (response.errors.length > 0) {
        console.warn(`Encountered ${response.errors.length} errors during scraping`);
        response.success = false;
      }
      
    } catch (error) {
      const errorMsg = `Critical error during scraping: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      response.success = false;
      response.errors.push(errorMsg);
    }
    
    response.duration_ms = Date.now() - startTime;
    return response;
  }
}
