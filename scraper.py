import requests
from bs4 import BeautifulSoup
import time
import logging
import re
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse
from app import app, db
from models import Match, Team, Tournament, Player, ScrapingLog

class VLRScraper:
    def __init__(self):
        self.base_url = "https://www.vlr.gg"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.rate_limit = 1  # seconds between requests
        
    def rate_limited_request(self, url):
        """Make a rate-limited request to avoid overwhelming the server"""
        try:
            time.sleep(self.rate_limit)
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            logging.error(f"Request failed for {url}: {str(e)}")
            return None
    
    def parse_time_string(self, time_str):
        """Parse various time formats from VLR.gg"""
        if not time_str:
            return None
            
        time_str = time_str.strip().lower()
        
        # Handle "live" status
        if 'live' in time_str:
            return datetime.utcnow()
        
        # Handle relative time formats (e.g., "2h 30m", "48m")
        if 'm' in time_str:
            try:
                # Extract hours and minutes
                hours = 0
                minutes = 0
                
                if 'h' in time_str:
                    parts = time_str.split('h')
                    hours = int(parts[0].strip())
                    if len(parts) > 1 and 'm' in parts[1]:
                        minutes = int(parts[1].replace('m', '').strip())
                else:
                    minutes = int(time_str.replace('m', '').strip())
                
                # Calculate future time
                total_minutes = hours * 60 + minutes
                return datetime.utcnow() + timedelta(minutes=total_minutes)
            except:
                pass
        
        # Handle "1d 2h" format
        if 'd' in time_str:
            try:
                days = 0
                hours = 0
                
                if 'd' in time_str:
                    parts = time_str.split('d')
                    days = int(parts[0].strip())
                    if len(parts) > 1 and 'h' in parts[1]:
                        hours = int(parts[1].replace('h', '').strip())
                
                total_hours = days * 24 + hours
                return datetime.utcnow() + timedelta(hours=total_hours)
            except:
                pass
        
        return None
    
    def get_or_create_team(self, team_name, flag_url=None):
        """Get existing team or create new one"""
        if not team_name or team_name.lower() in ['tbd', '–', '-']:
            return None
            
        team = Team.query.filter_by(name=team_name).first()
        if not team:
            team = Team(name=team_name, flag_url=flag_url)
            db.session.add(team)
            db.session.commit()
        return team
    
    def get_or_create_tournament(self, tournament_name, logo_url=None):
        """Get existing tournament or create new one"""
        if not tournament_name:
            return None
            
        tournament = Tournament.query.filter_by(name=tournament_name).first()
        if not tournament:
            tournament = Tournament(name=tournament_name, logo_url=logo_url)
            db.session.add(tournament)
            db.session.commit()
        return tournament
    
    def scrape_matches_list(self, matches_type=""):
        """Scrape matches from the main matches page"""
        url = f"{self.base_url}/matches/{matches_type}"
        logging.info(f"Scraping matches from: {url}")
        
        response = self.rate_limited_request(url)
        if not response:
            self.log_scraping_result(url, "error", "Failed to fetch page", 0)
            return []
        
        soup = BeautifulSoup(response.content, 'html.parser')
        matches_found = 0
        
        try:
            # Find all match containers
            match_containers = soup.find_all('a', class_='match-item')
            
            for container in match_containers:
                try:
                    match_data = self.parse_match_container(container)
                    if match_data:
                        self.save_match_data(match_data)
                        matches_found += 1
                except Exception as e:
                    logging.error(f"Error parsing match container: {str(e)}")
                    continue
            
            self.log_scraping_result(url, "success", None, matches_found)
            logging.info(f"Successfully scraped {matches_found} matches from {url}")
            
        except Exception as e:
            error_msg = f"Error parsing matches page: {str(e)}"
            logging.error(error_msg)
            self.log_scraping_result(url, "error", error_msg, 0)
        
        return matches_found
    
    def parse_match_container(self, container):
        """Parse individual match container from the matches list"""
        try:
            # Extract match URL and ID
            match_url = container.get('href')
            if not match_url:
                return None
                
            match_url = urljoin(self.base_url, match_url)
            
            # Extract match ID from URL
            match_id_match = re.search(r'/(\d+)/', match_url)
            vlr_match_id = match_id_match.group(1) if match_id_match else None
            
            if not vlr_match_id:
                return None
            
            # Parse teams
            team_elements = container.find_all('div', class_='match-item-vs-team-name')
            team1_name = team_elements[0].get_text(strip=True) if len(team_elements) > 0 else None
            team2_name = team_elements[1].get_text(strip=True) if len(team_elements) > 1 else None
            
            # Parse scores
            score_elements = container.find_all('div', class_='match-item-vs-team-score')
            team1_score = 0
            team2_score = 0
            
            if score_elements:
                try:
                    score_text1 = score_elements[0].get_text(strip=True)
                    score_text2 = score_elements[1].get_text(strip=True) if len(score_elements) > 1 else "0"
                    
                    team1_score = int(score_text1) if score_text1.isdigit() else 0
                    team2_score = int(score_text2) if score_text2.isdigit() else 0
                except:
                    pass
            
            # Parse status and time
            status = "upcoming"
            match_time = None
            
            time_element = container.find('div', class_='match-item-time')
            if time_element:
                time_text = time_element.get_text(strip=True)
                if 'live' in time_text.lower():
                    status = "live"
                    match_time = datetime.utcnow()
                elif any(score > 0 for score in [team1_score, team2_score]):
                    status = "completed"
                else:
                    match_time = self.parse_time_string(time_text)
            
            # Parse tournament info
            tournament_element = container.find('div', class_='match-item-event')
            tournament_name = tournament_element.get_text(strip=True) if tournament_element else "Unknown Tournament"
            
            # Parse stage info
            stage_element = container.find('div', class_='match-item-event-series')
            stage = stage_element.get_text(strip=True) if stage_element else ""
            
            # Parse match format
            format_element = container.find('div', class_='match-item-time')
            match_format = "Bo3"  # Default
            if format_element:
                format_text = format_element.get_text(strip=True)
                if 'bo1' in format_text.lower():
                    match_format = "Bo1"
                elif 'bo5' in format_text.lower():
                    match_format = "Bo5"
            
            return {
                'vlr_match_id': vlr_match_id,
                'team1_name': team1_name,
                'team2_name': team2_name,
                'team1_score': team1_score,
                'team2_score': team2_score,
                'tournament_name': tournament_name,
                'status': status,
                'match_time': match_time,
                'match_format': match_format,
                'stage': stage,
                'match_url': match_url
            }
            
        except Exception as e:
            logging.error(f"Error parsing match container: {str(e)}")
            return None
    
    def save_match_data(self, match_data):
        """Save match data to database"""
        try:
            # Check if match already exists
            existing_match = Match.query.filter_by(vlr_match_id=match_data['vlr_match_id']).first()
            
            # Create or get teams
            team1 = self.get_or_create_team(match_data['team1_name'])
            team2 = self.get_or_create_team(match_data['team2_name'])
            
            # Create or get tournament
            tournament = self.get_or_create_tournament(match_data['tournament_name'])
            
            if existing_match:
                # Update existing match
                existing_match.team1_score = match_data['team1_score']
                existing_match.team2_score = match_data['team2_score']
                existing_match.status = match_data['status']
                existing_match.match_time = match_data['match_time']
                existing_match.updated_at = datetime.utcnow()
            else:
                # Create new match
                new_match = Match(
                    vlr_match_id=match_data['vlr_match_id'],
                    team1_id=team1.id if team1 else None,
                    team2_id=team2.id if team2 else None,
                    tournament_id=tournament.id if tournament else None,
                    status=match_data['status'],
                    match_time=match_data['match_time'],
                    match_format=match_data['match_format'],
                    stage=match_data['stage'],
                    team1_score=match_data['team1_score'],
                    team2_score=match_data['team2_score'],
                    match_url=match_data['match_url']
                )
                db.session.add(new_match)
            
            db.session.commit()
            
        except Exception as e:
            logging.error(f"Error saving match data: {str(e)}")
            db.session.rollback()
    
    def scrape_match_details(self, match_id):
        """Scrape detailed information from a specific match page"""
        match = Match.query.filter_by(vlr_match_id=str(match_id)).first()
        if not match or not match.match_url:
            return None
        
        response = self.rate_limited_request(match.match_url)
        if not response:
            return None
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        try:
            # Extract detailed match information
            maps_data = []
            player_stats = {}
            
            # Find map results
            map_elements = soup.find_all('div', class_='vm-stats-game')
            for map_elem in map_elements:
                map_info = self.parse_map_data(map_elem)
                if map_info:
                    maps_data.append(map_info)
            
            # Update match with detailed data
            match.maps_data = maps_data
            match.player_stats = player_stats
            match.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            return {
                'maps_data': maps_data,
                'player_stats': player_stats
            }
            
        except Exception as e:
            logging.error(f"Error scraping match details for {match_id}: {str(e)}")
            return None
    
    def parse_map_data(self, map_element):
        """Parse map-specific data including agents and scores"""
        try:
            map_data = {
                'map_name': '',
                'team1_score': 0,
                'team2_score': 0,
                'agents': []
            }
            
            # Extract map name
            map_name_elem = map_element.find('div', class_='map')
            if map_name_elem:
                map_data['map_name'] = map_name_elem.get_text(strip=True)
            
            # Extract scores
            score_elems = map_element.find_all('div', class_='score')
            if len(score_elems) >= 2:
                try:
                    map_data['team1_score'] = int(score_elems[0].get_text(strip=True))
                    map_data['team2_score'] = int(score_elems[1].get_text(strip=True))
                except:
                    pass
            
            # Extract agent picks
            agent_elements = map_element.find_all('img', class_='agent')
            for agent_elem in agent_elements:
                agent_src = agent_elem.get('src', '')
                if agent_src:
                    # Extract agent name from image path
                    agent_name = agent_src.split('/')[-1].split('.')[0] if '/' in agent_src else ''
                    if agent_name:
                        map_data['agents'].append(agent_name)
            
            return map_data
            
        except Exception as e:
            logging.error(f"Error parsing map data: {str(e)}")
            return None
    
    def log_scraping_result(self, url, status, error_message, matches_found):
        """Log scraping results"""
        log_entry = ScrapingLog(
            scrape_type="matches_list",
            url=url,
            status=status,
            error_message=error_message,
            matches_found=matches_found
        )
        db.session.add(log_entry)
        db.session.commit()
    
    def scrape_all_matches(self):
        """Scrape all types of matches (upcoming, live, results)"""
        with app.app_context():
            total_matches = 0
            
            # Scrape upcoming matches
            total_matches += self.scrape_matches_list("")
            
            # Scrape results
            total_matches += self.scrape_matches_list("results")
            
            logging.info(f"Total matches scraped: {total_matches}")
            return total_matches
