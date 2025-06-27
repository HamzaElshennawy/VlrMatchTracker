import Database from 'better-sqlite3';
import path from 'path';
import { Team, Tournament, Match, ScrapingLog, MatchDetailScrapeData } from '@/types';

// Database instance
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'vlr_matches.db');
    db = new Database(dbPath);
    
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    
    // Initialize database schema
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const db = getDatabase();
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      flag_url TEXT,
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vlr_match_id TEXT NOT NULL UNIQUE,
      team1_id INTEGER,
      team2_id INTEGER,
      tournament_id INTEGER,
      status TEXT NOT NULL DEFAULT 'upcoming',
      match_time DATETIME,
      match_format TEXT DEFAULT 'Bo3',
      stage TEXT,
      team1_score INTEGER DEFAULT 0,
      team2_score INTEGER DEFAULT 0,
      match_url TEXT,
      vod_url TEXT,
      stats_url TEXT,
      maps_data TEXT, -- JSON string
      player_stats TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team1_id) REFERENCES teams (id),
      FOREIGN KEY (team2_id) REFERENCES teams (id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments (id)
    );

    CREATE TABLE IF NOT EXISTS scraping_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scrape_type TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      matches_found INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_matches_vlr_id ON matches(vlr_match_id);
    CREATE INDEX IF NOT EXISTS idx_matches_time ON matches(match_time);
    CREATE INDEX IF NOT EXISTS idx_scraping_logs_created ON scraping_logs(created_at);
  `);
}

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  // Team operations
  getOrCreateTeam(name: string, flagUrl?: string, logoUrl?: string): Team {
    if (!name || name.toLowerCase() === 'tbd' || name === '–' || name === '-') {
      throw new Error('Invalid team name');
    }

    // Try to find existing team
    const existing = this.db.prepare('SELECT * FROM teams WHERE name = ?').get(name) as Team | undefined;
    
    if (existing) {
      return existing;
    }

    // Create new team
    const result = this.db.prepare(`
      INSERT INTO teams (name, flag_url, logo_url)
      VALUES (?, ?, ?)
    `).run(name, flagUrl, logoUrl);

    return {
      id: result.lastInsertRowid as number,
      name,
      flag_url: flagUrl,
      logo_url: logoUrl,
      created_at: new Date().toISOString()
    };
  }

  // Tournament operations
  getOrCreateTournament(name: string, logoUrl?: string): Tournament {
    if (!name) {
      throw new Error('Invalid tournament name');
    }

    // Try to find existing tournament
    const existing = this.db.prepare('SELECT * FROM tournaments WHERE name = ?').get(name) as Tournament | undefined;
    
    if (existing) {
      return existing;
    }

    // Create new tournament
    const result = this.db.prepare(`
      INSERT INTO tournaments (name, logo_url)
      VALUES (?, ?)
    `).run(name, logoUrl);

    return {
      id: result.lastInsertRowid as number,
      name,
      logo_url: logoUrl,
      created_at: new Date().toISOString()
    };
  }

  // Match operations
  saveMatch(matchData: MatchDetailScrapeData): Match {
    const transaction = this.db.transaction(() => {
      // Get or create teams and tournament
      let team1: Team | undefined;
      let team2: Team | undefined;
      let tournament: Tournament | undefined;

      if (matchData.team1_name) {
        team1 = this.getOrCreateTeam(matchData.team1_name);
      }
      if (matchData.team2_name) {
        team2 = this.getOrCreateTeam(matchData.team2_name);
      }
      if (matchData.tournament_name) {
        tournament = this.getOrCreateTournament(matchData.tournament_name);
      }

      // Check if match exists
      const existing = this.db.prepare('SELECT * FROM matches WHERE vlr_match_id = ?').get(matchData.vlr_match_id) as Match | undefined;

      const now = new Date().toISOString();

      if (existing) {
        // Update existing match
        this.db.prepare(`
          UPDATE matches SET
            team1_id = ?,
            team2_id = ?,
            tournament_id = ?,
            status = ?,
            match_time = ?,
            match_format = ?,
            stage = ?,
            team1_score = ?,
            team2_score = ?,
            match_url = ?,
            vod_url = ?,
            stats_url = ?,
            maps_data = ?,
            player_stats = ?,
            updated_at = ?
          WHERE vlr_match_id = ?
        `).run(
          team1?.id,
          team2?.id,
          tournament?.id,
          matchData.status,
          matchData.match_time,
          matchData.match_format,
          matchData.stage,
          matchData.team1_score,
          matchData.team2_score,
          matchData.match_url,
          matchData.vod_url,
          matchData.stats_url,
          matchData.maps_data ? JSON.stringify(matchData.maps_data) : null,
          matchData.player_stats ? JSON.stringify(matchData.player_stats) : null,
          now,
          matchData.vlr_match_id
        );

        return { ...existing, updated_at: now };
      } else {
        // Create new match
        const result = this.db.prepare(`
          INSERT INTO matches (
            vlr_match_id, team1_id, team2_id, tournament_id, status,
            match_time, match_format, stage, team1_score, team2_score,
            match_url, vod_url, stats_url, maps_data, player_stats
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          matchData.vlr_match_id,
          team1?.id,
          team2?.id,
          tournament?.id,
          matchData.status,
          matchData.match_time,
          matchData.match_format,
          matchData.stage,
          matchData.team1_score,
          matchData.team2_score,
          matchData.match_url,
          matchData.vod_url,
          matchData.stats_url,
          matchData.maps_data ? JSON.stringify(matchData.maps_data) : null,
          matchData.player_stats ? JSON.stringify(matchData.player_stats) : null
        );

        return {
          id: result.lastInsertRowid as number,
          vlr_match_id: matchData.vlr_match_id,
          team1_id: team1?.id,
          team2_id: team2?.id,
          tournament_id: tournament?.id,
          status: matchData.status,
          match_time: matchData.match_time,
          match_format: matchData.match_format,
          stage: matchData.stage,
          team1_score: matchData.team1_score,
          team2_score: matchData.team2_score,
          match_url: matchData.match_url,
          vod_url: matchData.vod_url,
          stats_url: matchData.stats_url,
          maps_data: matchData.maps_data,
          player_stats: matchData.player_stats,
          created_at: now,
          updated_at: now
        };
      }
    });

    return transaction();
  }

  // Get matches with filtering
  getMatches(status?: string, limit = 50, offset = 0): { matches: Match[]; total: number } {
    let query = `
      SELECT 
        m.*,
        t1.name as team1_name, t1.flag_url as team1_flag,
        t2.name as team2_name, t2.flag_url as team2_flag,
        tour.name as tournament_name, tour.logo_url as tournament_logo
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN tournaments tour ON m.tournament_id = tour.id
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' WHERE m.status = ?';
      params.push(status);
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM matches m';
    if (status && status !== 'all') {
      countQuery += ' WHERE status = ?';
    }
    const totalResult = this.db.prepare(countQuery).get(status && status !== 'all' ? [status] : []) as { count: number };

    // Add ordering and pagination
    query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(params) as any[];

    const matches: Match[] = rows.map(row => ({
      id: row.id,
      vlr_match_id: row.vlr_match_id,
      team1_id: row.team1_id,
      team2_id: row.team2_id,
      tournament_id: row.tournament_id,
      status: row.status,
      match_time: row.match_time,
      match_format: row.match_format,
      stage: row.stage,
      team1_score: row.team1_score,
      team2_score: row.team2_score,
      match_url: row.match_url,
      vod_url: row.vod_url,
      stats_url: row.stats_url,
      maps_data: row.maps_data ? JSON.parse(row.maps_data) : undefined,
      player_stats: row.player_stats ? JSON.parse(row.player_stats) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      team1: row.team1_name ? { id: row.team1_id, name: row.team1_name, flag_url: row.team1_flag, created_at: '' } : undefined,
      team2: row.team2_name ? { id: row.team2_id, name: row.team2_name, flag_url: row.team2_flag, created_at: '' } : undefined,
      tournament: row.tournament_name ? { id: row.tournament_id, name: row.tournament_name, logo_url: row.tournament_logo, created_at: '' } : undefined
    }));

    return {
      matches,
      total: totalResult.count
    };
  }

  // Get single match by ID
  getMatch(id: number): Match | null {
    const row = this.db.prepare(`
      SELECT 
        m.*,
        t1.name as team1_name, t1.flag_url as team1_flag,
        t2.name as team2_name, t2.flag_url as team2_flag,
        tour.name as tournament_name, tour.logo_url as tournament_logo
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN tournaments tour ON m.tournament_id = tour.id
      WHERE m.id = ?
    `).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      vlr_match_id: row.vlr_match_id,
      team1_id: row.team1_id,
      team2_id: row.team2_id,
      tournament_id: row.tournament_id,
      status: row.status,
      match_time: row.match_time,
      match_format: row.match_format,
      stage: row.stage,
      team1_score: row.team1_score,
      team2_score: row.team2_score,
      match_url: row.match_url,
      vod_url: row.vod_url,
      stats_url: row.stats_url,
      maps_data: row.maps_data ? JSON.parse(row.maps_data) : undefined,
      player_stats: row.player_stats ? JSON.parse(row.player_stats) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      team1: row.team1_name ? { id: row.team1_id, name: row.team1_name, flag_url: row.team1_flag, created_at: '' } : undefined,
      team2: row.team2_name ? { id: row.team2_id, name: row.team2_name, flag_url: row.team2_flag, created_at: '' } : undefined,
      tournament: row.tournament_name ? { id: row.tournament_id, name: row.tournament_name, logo_url: row.tournament_logo, created_at: '' } : undefined
    };
  }

  // Get all teams
  getTeams(): Team[] {
    return this.db.prepare('SELECT * FROM teams ORDER BY name').all() as Team[];
  }

  // Get all tournaments
  getTournaments(): Tournament[] {
    return this.db.prepare('SELECT * FROM tournaments ORDER BY name').all() as Tournament[];
  }

  // Log scraping activity
  logScraping(type: string, url: string, status: string, errorMessage?: string, matchesFound = 0): void {
    this.db.prepare(`
      INSERT INTO scraping_logs (scrape_type, url, status, error_message, matches_found)
      VALUES (?, ?, ?, ?, ?)
    `).run(type, url, status, errorMessage, matchesFound);
  }

  // Get scraping logs
  getScrapingLogs(limit = 20): ScrapingLog[] {
    return this.db.prepare(`
      SELECT * FROM scraping_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit) as ScrapingLog[];
  }

  // Clean text content by removing excessive whitespace and VLR artifacts
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

  // Clean up existing database records with formatting issues
  cleanExistingData(): { tournamentsUpdated: number; teamsUpdated: number } {
    console.log('Cleaning existing database records...');
    
    // Clean tournament names - handle duplicates by merging them
    const tournaments = this.db.prepare('SELECT id, name FROM tournaments ORDER BY id').all() as { id: number; name: string }[];
    let tournamentsUpdated = 0;
    
    const updateTournament = this.db.prepare('UPDATE tournaments SET name = ? WHERE id = ?');
    const deleteTournament = this.db.prepare('DELETE FROM tournaments WHERE id = ?');
    const updateMatchesTournament = this.db.prepare('UPDATE matches SET tournament_id = ? WHERE tournament_id = ?');
    const getTournamentById = this.db.prepare('SELECT id, name FROM tournaments WHERE id = ?');
    
    // Group tournaments by their cleaned names
    const cleanedTournaments = new Map<string, { id: number; originalName: string; cleanedName: string }[]>();
    
    for (const tournament of tournaments) {
      const cleanedName = this.cleanTextContent(tournament.name);
      if (!cleanedTournaments.has(cleanedName)) {
        cleanedTournaments.set(cleanedName, []);
      }
      cleanedTournaments.get(cleanedName)!.push({
        id: tournament.id,
        originalName: tournament.name,
        cleanedName
      });
    }
    
    // Process each group of tournaments with the same cleaned name
    for (const [cleanedName, tournamentGroup] of cleanedTournaments) {
      if (tournamentGroup.length === 1) {
        // Single tournament - just update if name changed
        const tournament = tournamentGroup[0];
        if (tournament.cleanedName !== tournament.originalName) {
          try {
            updateTournament.run(cleanedName, tournament.id);
            tournamentsUpdated++;
            console.log(`Updated tournament ${tournament.id}: "${tournament.originalName}" -> "${cleanedName}"`);
          } catch (error) {
            console.log(`Error updating tournament ${tournament.id}: ${error}`);
          }
        }
      } else {
        // Multiple tournaments with same cleaned name - merge them
        const primaryTournament = tournamentGroup[0]; // Keep the first one
        const duplicates = tournamentGroup.slice(1);
        
        console.log(`Merging ${tournamentGroup.length} tournaments with name "${cleanedName}"`);
        
        // Update primary tournament name
        try {
          updateTournament.run(cleanedName, primaryTournament.id);
          tournamentsUpdated++;
        } catch (error) {
          console.log(`Error updating primary tournament ${primaryTournament.id}: ${error}`);
        }
        
        // Move matches from duplicate tournaments to primary
        for (const duplicate of duplicates) {
          try {
            updateMatchesTournament.run(primaryTournament.id, duplicate.id);
            deleteTournament.run(duplicate.id);
            console.log(`Merged tournament ${duplicate.id} into ${primaryTournament.id}`);
          } catch (error) {
            console.log(`Error merging tournament ${duplicate.id}: ${error}`);
          }
        }
      }
    }
    
    // Clean team names with similar approach
    const teams = this.db.prepare('SELECT id, name FROM teams ORDER BY id').all() as { id: number; name: string }[];
    let teamsUpdated = 0;
    
    const updateTeam = this.db.prepare('UPDATE teams SET name = ? WHERE id = ?');
    const deleteTeam = this.db.prepare('DELETE FROM teams WHERE id = ?');
    const updateMatchesTeam1 = this.db.prepare('UPDATE matches SET team1_id = ? WHERE team1_id = ?');
    const updateMatchesTeam2 = this.db.prepare('UPDATE matches SET team2_id = ? WHERE team2_id = ?');
    
    const cleanedTeams = new Map<string, { id: number; originalName: string; cleanedName: string }[]>();
    
    for (const team of teams) {
      const cleanedName = this.cleanTextContent(team.name);
      if (!cleanedTeams.has(cleanedName)) {
        cleanedTeams.set(cleanedName, []);
      }
      cleanedTeams.get(cleanedName)!.push({
        id: team.id,
        originalName: team.name,
        cleanedName
      });
    }
    
    // Process each group of teams with the same cleaned name
    for (const [cleanedName, teamGroup] of cleanedTeams) {
      if (teamGroup.length === 1) {
        // Single team - just update if name changed
        const team = teamGroup[0];
        if (team.cleanedName !== team.originalName) {
          try {
            updateTeam.run(cleanedName, team.id);
            teamsUpdated++;
            console.log(`Updated team ${team.id}: "${team.originalName}" -> "${cleanedName}"`);
          } catch (error) {
            console.log(`Error updating team ${team.id}: ${error}`);
          }
        }
      } else {
        // Multiple teams with same cleaned name - merge them
        const primaryTeam = teamGroup[0];
        const duplicates = teamGroup.slice(1);
        
        console.log(`Merging ${teamGroup.length} teams with name "${cleanedName}"`);
        
        // Update primary team name
        try {
          updateTeam.run(cleanedName, primaryTeam.id);
          teamsUpdated++;
        } catch (error) {
          console.log(`Error updating primary team ${primaryTeam.id}: ${error}`);
        }
        
        // Move matches from duplicate teams to primary
        for (const duplicate of duplicates) {
          try {
            updateMatchesTeam1.run(primaryTeam.id, duplicate.id);
            updateMatchesTeam2.run(primaryTeam.id, duplicate.id);
            deleteTeam.run(duplicate.id);
            console.log(`Merged team ${duplicate.id} into ${primaryTeam.id}`);
          } catch (error) {
            console.log(`Error merging team ${duplicate.id}: ${error}`);
          }
        }
      }
    }
    
    // Final cleanup: remove any remaining records with formatting issues
    const dirtyTournaments = this.db.prepare(`
      SELECT id, name FROM tournaments 
      WHERE name LIKE '%\t%' OR name LIKE '%\n%' OR name LIKE '%  %'
    `).all() as { id: number; name: string }[];
    
    if (dirtyTournaments.length > 0) {
      console.log(`Found ${dirtyTournaments.length} tournaments with remaining formatting issues - removing orphaned records`);
      const deleteDirtyTournament = this.db.prepare('DELETE FROM tournaments WHERE id = ?');
      
      for (const tournament of dirtyTournaments) {
        // Check if this tournament has any matches
        const matchCount = this.db.prepare('SELECT COUNT(*) as count FROM matches WHERE tournament_id = ?').get(tournament.id) as { count: number };
        
        if (matchCount.count === 0) {
          // Safe to delete - no matches reference this tournament
          deleteDirtyTournament.run(tournament.id);
          console.log(`Removed orphaned dirty tournament ${tournament.id}: "${tournament.name}"`);
        } else {
          console.log(`Keeping tournament ${tournament.id} with ${matchCount.count} matches: "${tournament.name}"`);
        }
      }
    }
    
    // Same for teams
    const dirtyTeams = this.db.prepare(`
      SELECT id, name FROM teams 
      WHERE name LIKE '%\t%' OR name LIKE '%\n%' OR name LIKE '%  %'
    `).all() as { id: number; name: string }[];
    
    if (dirtyTeams.length > 0) {
      console.log(`Found ${dirtyTeams.length} teams with remaining formatting issues - removing orphaned records`);
      const deleteDirtyTeam = this.db.prepare('DELETE FROM teams WHERE id = ?');
      
      for (const team of dirtyTeams) {
        // Check if this team has any matches
        const matchCount1 = this.db.prepare('SELECT COUNT(*) as count FROM matches WHERE team1_id = ?').get(team.id) as { count: number };
        const matchCount2 = this.db.prepare('SELECT COUNT(*) as count FROM matches WHERE team2_id = ?').get(team.id) as { count: number };
        
        if (matchCount1.count === 0 && matchCount2.count === 0) {
          // Safe to delete - no matches reference this team
          deleteDirtyTeam.run(team.id);
          console.log(`Removed orphaned dirty team ${team.id}: "${team.name}"`);
        } else {
          console.log(`Keeping team ${team.id} with ${matchCount1.count + matchCount2.count} matches: "${team.name}"`);
        }
      }
    }

    console.log(`Cleaned ${tournamentsUpdated} tournaments and ${teamsUpdated} teams`);
    return { tournamentsUpdated, teamsUpdated };
  }

  // Get database statistics
  getStats() {
    const matchCount = this.db.prepare('SELECT COUNT(*) as count FROM matches').get() as { count: number };
    const liveCount = this.db.prepare('SELECT COUNT(*) as count FROM matches WHERE status = "live"').get() as { count: number };
    const upcomingCount = this.db.prepare('SELECT COUNT(*) as count FROM matches WHERE status = "upcoming"').get() as { count: number };
    const completedCount = this.db.prepare('SELECT COUNT(*) as count FROM matches WHERE status = "completed"').get() as { count: number };
    const teamCount = this.db.prepare('SELECT COUNT(*) as count FROM teams').get() as { count: number };
    const tournamentCount = this.db.prepare('SELECT COUNT(*) as count FROM tournaments').get() as { count: number };

    return {
      total_matches: matchCount.count,
      live_matches: liveCount.count,
      upcoming_matches: upcomingCount.count,
      completed_matches: completedCount.count,
      total_teams: teamCount.count,
      total_tournaments: tournamentCount.count
    };
  }
}