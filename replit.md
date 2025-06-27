# VLR.gg Match Scraper

## Overview

A Flask-based web application that scrapes match data from VLR.gg (Valorant's premier esports website) and provides a clean dashboard interface for viewing Valorant tournament matches, teams, and statistics. The application features automated background scraping, real-time match tracking, and a responsive web interface.

## System Architecture

### Backend Architecture
- **Framework**: Flask (Python web framework)
- **Database**: SQLAlchemy ORM with SQLite (default) or PostgreSQL support
- **Background Processing**: APScheduler for automated scraping tasks
- **Web Scraping**: BeautifulSoup4 with requests for HTML parsing
- **WSGI Server**: Gunicorn for production deployment

### Frontend Architecture
- **Templates**: Jinja2 templating engine
- **Styling**: Bootstrap 5 with dark theme
- **JavaScript**: Vanilla JS for dynamic interactions
- **Icons**: Font Awesome for UI elements

### Data Storage Solutions
- **Primary Database**: SQLAlchemy with support for SQLite (development) and PostgreSQL (production)
- **Models**: Tournament, Team, Match, Player, and ScrapingLog entities
- **JSON Storage**: Complex match data (maps, player stats) stored as JSON in database columns

## Key Components

### Core Models
1. **Tournament**: Tournament information with logo and metadata
2. **Team**: Team details including name, flag, and logo URLs
3. **Match**: Central entity storing match details, scores, status, and relationships
4. **Player**: Player information and statistics (referenced in scraper)
5. **ScrapingLog**: Tracking scraping operations and their status

### Scraping Engine
- **VLRScraper Class**: Main scraping logic with rate limiting
- **Rate Limiting**: 1-second delays between requests to respect server resources
- **Time Parsing**: Handles various time formats from VLR.gg
- **Error Handling**: Robust error handling with logging

### Scheduling System
- **Background Scheduler**: APScheduler running scraping jobs every 15 minutes
- **Initial Scrape**: Automatic initial scraping on application startup
- **Manual Triggers**: API endpoints for on-demand scraping

### Web Interface
- **Dashboard**: Overview with statistics and recent matches
- **Match Listing**: Filtered views of all matches with pagination
- **Match Details**: Detailed view of individual matches
- **Real-time Updates**: Auto-refresh for live match data

## Data Flow

1. **Scraping Pipeline**:
   - Scheduler triggers VLRScraper every 15 minutes
   - Scraper fetches match data from VLR.gg
   - Data is parsed and normalized
   - Database entities are created/updated
   - Results logged for monitoring

2. **Web Interface Flow**:
   - User requests pages through Flask routes
   - Database queries retrieve relevant data
   - Templates render data with Bootstrap styling
   - JavaScript handles dynamic updates and interactions

3. **API Endpoints**:
   - RESTful endpoints for match data
   - Manual scraping triggers
   - Status and statistics endpoints

## External Dependencies

### Web Scraping
- **Target Site**: VLR.gg (https://www.vlr.gg)
- **User Agent**: Standard browser user agent to avoid blocking
- **Respectful Scraping**: Rate limiting and error handling

### Third-party Services
- **Bootstrap CDN**: For UI styling and components
- **Font Awesome CDN**: For icons and visual elements

### Python Dependencies
- **Flask Ecosystem**: Flask, Flask-SQLAlchemy, Werkzeug
- **Scraping Stack**: requests, BeautifulSoup4, trafilatura
- **Scheduling**: APScheduler with timezone support
- **Database**: SQLAlchemy, psycopg2-binary for PostgreSQL
- **Production**: Gunicorn for WSGI serving

## Deployment Strategy

### Development
- SQLite database for local development
- Flask development server with debug mode
- Hot reloading for code changes

### Production (Replit)
- **WSGI Server**: Gunicorn with auto-scaling deployment
- **Database**: PostgreSQL (when DATABASE_URL is provided)
- **Environment**: Nix-based environment with Python 3.11
- **Proxy Handling**: ProxyFix middleware for proper headers
- **Session Security**: Environment-based secret key management

### Configuration
- Environment-based configuration for database URLs
- Session secrets from environment variables
- Database connection pooling with health checks
- Logging configuration for monitoring

## Changelog

- June 27, 2025. Initial setup
- June 27, 2025. Fixed map name parsing - Cleaned excessive whitespace, tabs, and VLR.gg artifacts from map names
- June 27, 2025. Fixed tournament and stage name formatting - Applied text cleaning to tournament names and stage information

## User Preferences

Preferred communication style: Simple, everyday language.