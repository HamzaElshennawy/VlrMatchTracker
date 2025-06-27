from app import db
from datetime import datetime
from sqlalchemy import Text, JSON

class Tournament(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    logo_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    matches = db.relationship('Match', backref='tournament', lazy=True)

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    flag_url = db.Column(db.String(500))
    logo_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    vlr_match_id = db.Column(db.String(50), unique=True, nullable=False)
    team1_id = db.Column(db.Integer, db.ForeignKey('team.id'))
    team2_id = db.Column(db.Integer, db.ForeignKey('team.id'))
    tournament_id = db.Column(db.Integer, db.ForeignKey('tournament.id'))
    
    # Match details
    status = db.Column(db.String(20))  # upcoming, live, completed
    match_time = db.Column(db.DateTime)
    match_format = db.Column(db.String(10))  # Bo1, Bo3, Bo5
    stage = db.Column(db.String(100))
    
    # Scores
    team1_score = db.Column(db.Integer, default=0)
    team2_score = db.Column(db.Integer, default=0)
    
    # URLs and metadata
    match_url = db.Column(db.String(500))
    vod_url = db.Column(db.String(500))
    stats_url = db.Column(db.String(500))
    
    # Detailed match data (JSON)
    maps_data = db.Column(JSON)  # Maps, agents, scores, etc.
    player_stats = db.Column(JSON)  # Player performance data
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    team1 = db.relationship('Team', foreign_keys=[team1_id], backref='matches_as_team1')
    team2 = db.relationship('Team', foreign_keys=[team2_id], backref='matches_as_team2')

class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'))
    flag_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    team = db.relationship('Team', backref='players')

class ScrapingLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    scrape_type = db.Column(db.String(50))  # matches_list, match_detail
    url = db.Column(db.String(500))
    status = db.Column(db.String(20))  # success, error
    error_message = db.Column(Text)
    matches_found = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
