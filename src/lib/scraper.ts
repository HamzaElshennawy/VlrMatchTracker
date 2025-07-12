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
    // No database dependency for real-time scraping
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
      const $ = await this.makeRequest(url);
      if (!$) return null;

      // Extract match details (teams, score, etc.)
      const team1Element = $(".match-header-vs-team").first();
      const team2Element = $(".match-header-vs-team").last();

      const team1Name = team1Element.find(".text-of").text().trim();
      const team2Name = team2Element.find(".text-of").text().trim();

      // Extract scores
      const scoreElements = $(".match-header-vs-score .js-spoiler").toArray();
      let team1Score = 0;
      let team2Score = 0;

      if (scoreElements.length >= 2) {
        team1Score = parseInt($(scoreElements[0]).text().trim()) || 0;
        team2Score = parseInt($(scoreElements[1]).text().trim()) || 0;
      }

      // Extract tournament info (improved for robustness)
      let tournamentName = "";
      const tournamentElement = $(
        ".match-header-event .text-of, .match-header-event"
      ).first();
      if (tournamentElement.length) {
        tournamentName = tournamentElement.text().trim();
      }
      if (!tournamentName) {
        // Fallback: try to get from page title or other header
        tournamentName = $("title").text().split("-")[0].trim();
      }

      // Extract status (improved for live detection)
      let status: "upcoming" | "live" | "completed" = "completed";
      // Only use .match-header-status for match status
      const headerStatus = $(".match-header-status").first();
      const headerStatusText = headerStatus.text().toLowerCase();
      if (headerStatusText.includes("live")) {
        status = "live";
      } else if (
        headerStatusText.includes("final") ||
        headerStatusText.includes("completed")
      ) {
        status = "completed";
      } else if (!headerStatusText && team1Score === 0 && team2Score === 0) {
        status = "upcoming";
      }

      // Extract match format
      let matchFormat = "Bo3";
      const formatText = $(".match-header-vs-note").text().toLowerCase();
      if (formatText.includes("bo1")) {
        matchFormat = "Bo1";
      } else if (formatText.includes("bo5")) {
        matchFormat = "Bo5";
      }

      // Extract stage
      const stageElement = $(".match-header-vs-note");
      const stage = stageElement.text().trim();

      // Extract maps and rounds (include all maps, even if display:none)
      const maps: any[] = [];
      // Use .vm-stats-game for completed, .vm-stats-games-container > .vm-stats-game for live, and fallback to .match-header-vs-map for upcoming
      let mapElems = $(
        ".vm-stats-game, .vm-stats-games-container > .vm-stats-game, .match-header-vs-map"
      ).toArray();
      if (mapElems.length === 0) {
        // Fallback: try to find any map containers
        mapElems = $("[class*='map']").toArray();
      }
      if (mapElems.length === 0) {
        console.warn("No maps found for match", vlrMatchId);
      }
      for (const mapElem of mapElems) {
        const $map = $(mapElem);
        // Get map name robustly
        let mapName = $map
          .find(".map > div > span")
          .first()
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .trim();
        if (!mapName) {
          mapName =
            $map.find(".map").text().trim() ||
            $map.find(".match-header-vs-map-name").text().trim() ||
            $map.find("[class*='map']").text().trim() ||
            "Unknown Map";
        }
        // Get team names from .team-name or fallback to match header
        let teamNames = $map
          .find(".team-name")
          .map((_, el) => $(el).text().trim())
          .get();
        if (teamNames.length < 2) {
          teamNames = [team1Name, team2Name];
        }
        // Get scores from .score (left and right) or fallback to 0
        let team1Score =
          parseInt($map.find(".team").first().find(".score").text().trim()) ||
          0;
        let team2Score =
          parseInt($map.find(".team").last().find(".score").text().trim()) || 0;
        // For upcoming matches, scores may not exist
        if (isNaN(team1Score)) team1Score = 0;
        if (isNaN(team2Score)) team2Score = 0;
        // Extract agent picks (if available)
        const agents: string[] = [];
        $map
          .find('img[src*="agent"], .agent-icon, [class*="agent"]')
          .each((_, agentEl) => {
            const agentSrc = $(agentEl).attr("src") || "";
            if (agentSrc) {
              const agentName = agentSrc.split("/").pop()?.split(".")[0] || "";
              if (agentName) agents.push(agentName);
            }
          });
        // Extract rounds data from .vlr-rounds-row-col (live and completed)
        const rounds_data: any[] = [];
        $map.find(".vlr-rounds-row-col[title]").each((roundIdx, roundEl) => {
          const $round = $(roundEl);
          const title = $round.attr("title") || "";
          // Parse score from title, e.g. "3-2"
          const scoreMatch = title.match(/(\d+)[-:](\d+)/);
          let round_score_team1 = undefined;
          let round_score_team2 = undefined;
          if (scoreMatch) {
            round_score_team1 = parseInt(scoreMatch[1]);
            round_score_team2 = parseInt(scoreMatch[2]);
          }
          // Determine winner from .rnd-sq.mod-win.mod-t or .mod-ct
          let winner = undefined;
          if ($round.find(".rnd-sq.mod-win.mod-t").length) winner = "team1";
          else if ($round.find(".rnd-sq.mod-win.mod-ct").length)
            winner = "team2";
          // Win method from image src
          let win_method = undefined;
          const imgSrc = $round.find(".rnd-sq.mod-win img").attr("src") || "";
          if (imgSrc.includes("elim")) win_method = "elimination";
          else if (imgSrc.includes("defuse")) win_method = "bomb";
          else if (imgSrc.includes("boom")) win_method = "bomb";
          rounds_data.push({
            round_number: roundIdx + 1,
            winner,
            win_method,
            round_score_team1,
            round_score_team2,
          });
        });
        maps.push({
          map_name: mapName,
          team1_score: team1Score,
          team2_score: team2Score,
          agents,
          rounds_data,
        });
      }

      return {
        vlr_match_id: vlrMatchId,
        team1_name: team1Name || undefined,
        team2_name: team2Name || undefined,
        team1_score: team1Score,
        team2_score: team2Score,
        tournament_name: tournamentName,
        status,
        match_time: undefined, // Match time is not available on details page
        match_format: matchFormat,
        stage: stage || undefined,
        match_url: url,
        team1_logo_url: undefined, // Team logos are not available on details page
        team2_logo_url: undefined, // Team logos are not available on details page
        tournament_logo_url: undefined, // Tournament logo is not available on details page
        maps_data: maps,
      };
    } catch (error) {
      console.error("Error parsing match details:", error);
      return null;
    }
  }
}
