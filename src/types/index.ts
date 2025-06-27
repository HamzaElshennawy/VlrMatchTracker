// Types for VLR.gg Scraper API

export interface Team {
  id: number;
  name: string;
  flag_url?: string;
  logo_url?: string;
  created_at: string;
}

export interface Tournament {
  id: number;
  name: string;
  logo_url?: string;
  created_at: string;
}

export interface MapData {
  map_name: string;
  team1_score: number;
  team2_score: number;
  agents: string[];
  rounds_data?: RoundData[];
}

export interface RoundData {
  round_number: number;
  winner: 'team1' | 'team2';
  round_type: 'pistol' | 'eco' | 'force_buy' | 'full_buy';
  elimination_order?: PlayerElimination[];
}

export interface PlayerElimination {
  player_name: string;
  team: 'team1' | 'team2';
  eliminated_by: string;
  weapon: string;
  headshot: boolean;
}

export interface PlayerStats {
  player_name: string;
  team: 'team1' | 'team2';
  agent: string;
  kills: number;
  deaths: number;
  assists: number;
  acs: number; // Average Combat Score
  k_d_ratio: number;
  adr: number; // Average Damage per Round
  headshot_percentage: number;
  first_kills: number;
  first_deaths: number;
  maps_played: number;
}

export interface Match {
  id: number;
  vlr_match_id: string;
  team1_id?: number;
  team2_id?: number;
  tournament_id?: number;
  status: 'upcoming' | 'live' | 'completed';
  match_time?: string;
  match_format: 'Bo1' | 'Bo3' | 'Bo5';
  stage?: string;
  team1_score: number;
  team2_score: number;
  match_url?: string;
  vod_url?: string;
  stats_url?: string;
  maps_data?: MapData[];
  player_stats?: PlayerStats[];
  created_at: string;
  updated_at: string;
  // Populated relations
  team1?: Team;
  team2?: Team;
  tournament?: Tournament;
}

export interface ScrapingLog {
  id: number;
  scrape_type: 'matches_list' | 'match_detail' | 'full_scrape';
  url: string;
  status: 'success' | 'error' | 'in_progress';
  error_message?: string;
  matches_found: number;
  created_at: string;
}

export interface MatchListResponse {
  matches: Match[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ScrapeResponse {
  success: boolean;
  matches_scraped: number;
  matches_updated: number;
  new_teams: number;
  new_tournaments: number;
  errors: string[];
  duration_ms: number;
}

export interface MatchDetailScrapeData {
  vlr_match_id: string;
  team1_name?: string;
  team2_name?: string;
  team1_score: number;
  team2_score: number;
  tournament_name?: string;
  status: 'upcoming' | 'live' | 'completed';
  match_time?: string;
  match_format: string;
  stage?: string;
  match_url: string;
  maps_data?: MapData[];
  player_stats?: PlayerStats[];
  vod_url?: string;
  stats_url?: string;
}