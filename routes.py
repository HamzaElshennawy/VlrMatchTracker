from flask import render_template, jsonify, request
from app import app, db
from models import Match, Team, Tournament, ScrapingLog
from scraper import VLRScraper
from datetime import datetime, timedelta
import logging

@app.route('/')
def index():
    """Main dashboard page"""
    # Get recent matches
    recent_matches = Match.query.order_by(Match.created_at.desc()).limit(10).all()
    
    # Get statistics
    total_matches = Match.query.count()
    live_matches = Match.query.filter_by(status='live').count()
    upcoming_matches = Match.query.filter_by(status='upcoming').count()
    completed_matches = Match.query.filter_by(status='completed').count()
    
    # Get last scraping time
    last_scrape = ScrapingLog.query.filter_by(status='success').order_by(ScrapingLog.created_at.desc()).first()
    
    stats = {
        'total_matches': total_matches,
        'live_matches': live_matches,
        'upcoming_matches': upcoming_matches,
        'completed_matches': completed_matches,
        'last_scrape': last_scrape.created_at if last_scrape else None
    }
    
    return render_template('index.html', matches=recent_matches, stats=stats)

@app.route('/matches')
def matches():
    """Matches list page with filters"""
    status_filter = request.args.get('status', 'all')
    page = request.args.get('page', 1, type=int)
    per_page = 20
    
    # Build query
    query = Match.query
    
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    
    # Order by match time (upcoming first, then by recency)
    query = query.order_by(
        Match.match_time.asc() if status_filter == 'upcoming' 
        else Match.created_at.desc()
    )
    
    matches = query.paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return render_template('matches.html', matches=matches, status_filter=status_filter)

@app.route('/match/<int:match_id>')
def match_detail(match_id):
    """Individual match detail page"""
    match = Match.query.get_or_404(match_id)
    
    # If detailed data is missing, try to scrape it
    if not match.maps_data:
        scraper = VLRScraper()
        scraper.scrape_match_details(match.vlr_match_id)
        db.session.refresh(match)
    
    return render_template('match_detail.html', match=match)

# API Endpoints

@app.route('/api/matches')
def api_matches():
    """API endpoint for matches data"""
    status_filter = request.args.get('status', 'all')
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    # Build query
    query = Match.query
    
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    
    matches = query.order_by(Match.created_at.desc()).offset(offset).limit(limit).all()
    
    matches_data = []
    for match in matches:
        match_dict = {
            'id': match.id,
            'vlr_match_id': match.vlr_match_id,
            'team1': match.team1.name if match.team1 else None,
            'team2': match.team2.name if match.team2 else None,
            'team1_score': match.team1_score,
            'team2_score': match.team2_score,
            'tournament': match.tournament.name if match.tournament else None,
            'status': match.status,
            'match_time': match.match_time.isoformat() if match.match_time else None,
            'match_format': match.match_format,
            'stage': match.stage,
            'match_url': match.match_url,
            'maps_data': match.maps_data,
            'created_at': match.created_at.isoformat(),
            'updated_at': match.updated_at.isoformat()
        }
        matches_data.append(match_dict)
    
    return jsonify({
        'matches': matches_data,
        'total': Match.query.count(),
        'filtered_total': query.count()
    })

@app.route('/api/match/<int:match_id>')
def api_match_detail(match_id):
    """API endpoint for individual match details"""
    match = Match.query.get_or_404(match_id)
    
    match_data = {
        'id': match.id,
        'vlr_match_id': match.vlr_match_id,
        'team1': {
            'name': match.team1.name if match.team1 else None,
            'flag_url': match.team1.flag_url if match.team1 else None
        },
        'team2': {
            'name': match.team2.name if match.team2 else None,
            'flag_url': match.team2.flag_url if match.team2 else None
        },
        'scores': {
            'team1': match.team1_score,
            'team2': match.team2_score
        },
        'tournament': {
            'name': match.tournament.name if match.tournament else None,
            'logo_url': match.tournament.logo_url if match.tournament else None
        },
        'status': match.status,
        'match_time': match.match_time.isoformat() if match.match_time else None,
        'match_format': match.match_format,
        'stage': match.stage,
        'match_url': match.match_url,
        'vod_url': match.vod_url,
        'stats_url': match.stats_url,
        'maps_data': match.maps_data,
        'player_stats': match.player_stats,
        'created_at': match.created_at.isoformat(),
        'updated_at': match.updated_at.isoformat()
    }
    
    return jsonify(match_data)

@app.route('/api/teams')
def api_teams():
    """API endpoint for teams data"""
    teams = Team.query.all()
    
    teams_data = []
    for team in teams:
        team_dict = {
            'id': team.id,
            'name': team.name,
            'flag_url': team.flag_url,
            'logo_url': team.logo_url,
            'matches_count': len(team.matches_as_team1) + len(team.matches_as_team2),
            'created_at': team.created_at.isoformat()
        }
        teams_data.append(team_dict)
    
    return jsonify({'teams': teams_data})

@app.route('/api/tournaments')
def api_tournaments():
    """API endpoint for tournaments data"""
    tournaments = Tournament.query.all()
    
    tournaments_data = []
    for tournament in tournaments:
        tournament_dict = {
            'id': tournament.id,
            'name': tournament.name,
            'logo_url': tournament.logo_url,
            'matches_count': len(tournament.matches),
            'created_at': tournament.created_at.isoformat()
        }
        tournaments_data.append(tournament_dict)
    
    return jsonify({'tournaments': tournaments_data})

@app.route('/api/scrape', methods=['POST'])
def api_trigger_scrape():
    """API endpoint to trigger manual scraping"""
    try:
        scraper = VLRScraper()
        matches_count = scraper.scrape_all_matches()
        
        return jsonify({
            'success': True,
            'message': f'Successfully scraped {matches_count} matches',
            'matches_count': matches_count
        })
    
    except Exception as e:
        logging.error(f"Manual scraping failed: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Scraping failed: {str(e)}'
        }), 500

@app.route('/api/stats')
def api_stats():
    """API endpoint for general statistics"""
    stats = {
        'total_matches': Match.query.count(),
        'live_matches': Match.query.filter_by(status='live').count(),
        'upcoming_matches': Match.query.filter_by(status='upcoming').count(),
        'completed_matches': Match.query.filter_by(status='completed').count(),
        'total_teams': Team.query.count(),
        'total_tournaments': Tournament.query.count(),
        'last_update': datetime.utcnow().isoformat()
    }
    
    # Get recent scraping logs
    recent_logs = ScrapingLog.query.order_by(ScrapingLog.created_at.desc()).limit(5).all()
    stats['recent_scrapes'] = [
        {
            'timestamp': log.created_at.isoformat(),
            'status': log.status,
            'matches_found': log.matches_found,
            'url': log.url
        }
        for log in recent_logs
    ]
    
    return jsonify(stats)

@app.errorhandler(404)
def not_found_error(error):
    return render_template('index.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('index.html'), 500
