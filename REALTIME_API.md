# VLR Match Tracker - Real-time API Documentation

This API has been updated to use **real-time data fetching** from VLR.gg instead of database storage. When you call any endpoint, it scrapes the latest data directly from VLR.gg and returns it as JSON.

## Available Endpoints

### 🎯 All Matches
- **GET** `/api/matches`
- **Query Parameters:**
  - `status` (optional): `all`, `upcoming`, `live`, `completed` (default: `all`)
  - `page` (optional): Page number (default: `1`)
  - `limit` (optional): Items per page (default: `50`)

**Example:**
```bash
curl "http://localhost:3000/api/matches?status=live&limit=10"
```

### 🔴 Live Matches
- **GET** `/api/matches/live`
- **Query Parameters:**
  - `page` (optional): Page number (default: `1`)
  - `limit` (optional): Items per page (default: `50`)

**Example:**
```bash
curl "http://localhost:3000/api/matches/live"
```

### ⏰ Upcoming Matches
- **GET** `/api/matches/upcoming`
- **Query Parameters:**
  - `page` (optional): Page number (default: `1`)
  - `limit` (optional): Items per page (default: `50`)

**Example:**
```bash
curl "http://localhost:3000/api/matches/upcoming"
```

### ✅ Completed Matches (Results)
- **GET** `/api/matches/results`
- **Query Parameters:**
  - `page` (optional): Page number (default: `1`)
  - `limit` (optional): Items per page (default: `50`)

**Example:**
```bash
curl "http://localhost:3000/api/matches/results"
```

### 🎯 Single Match Details
- **GET** `/api/match/[vlr_match_id]`
- **Parameters:**
  - `vlr_match_id`: The VLR.gg match ID (e.g., "123456")

**Example:**
```bash
curl "http://localhost:3000/api/match/123456"
```

### 👥 Teams
- **GET** `/api/teams`
- Returns all teams found in recent matches with their logo URLs and match counts

**Example:**
```bash
curl "http://localhost:3000/api/teams"
```

### 🏆 Tournaments
- **GET** `/api/tournaments`
- Returns all tournaments found in recent matches with their logo URLs and match counts

**Example:**
```bash
curl "http://localhost:3000/api/tournaments"
```

### 🕷️ Direct Scraping
- **POST** `/api/scrape`
- **Query Parameters:**
  - `type` (optional): `all`, `upcoming`, `live`, `results` (default: `all`)

**Example:**
```bash
curl -X POST "http://localhost:3000/api/scrape?type=live"
```

## Response Format

All endpoints return data in this format:

```json
{
  "success": true,
  "data": {
    "matches": [...],
    "total": 25,
    "page": 1,
    "per_page": 50,
    "scraped_at": "2025-06-28T18:04:12.000Z"
  }
}
```

## Match Data Structure

Each match object contains:

```json
{
  "vlr_match_id": "123456",
  "team1_name": "Team Liquid",
  "team2_name": "FNATIC",
  "team1_score": 2,
  "team2_score": 1,
  "tournament_name": "VCT Champions 2024",
  "status": "completed",
  "match_time": "2025-06-28T15:30:00.000Z",
  "match_format": "Bo3",
  "stage": "Grand Final",
  "match_url": "https://www.vlr.gg/123456/team-liquid-vs-fnatic-vct-champions-2024-grand-final",
  "team1_logo_url": "https://...",
  "team2_logo_url": "https://...",
  "tournament_logo_url": "https://...",
  "maps_data": [...],
  "player_stats": [...],
  "vod_url": "https://...",
  "stats_url": "https://...",
  "scraped_at": "2025-06-28T18:04:12.000Z"
}
```

## Features

✅ **Real-time data** - Always fresh from VLR.gg  
✅ **No database required** - Pure web scraping  
✅ **TypeScript support** - Fully typed responses  
✅ **Rate limiting** - Respectful scraping with delays  
✅ **Error handling** - Graceful failures  
✅ **Pagination** - Handle large result sets  
✅ **Filter by status** - Live, upcoming, completed  
✅ **Match details** - Maps, scores, player stats  
✅ **Team & tournament info** - Logos and names  

## Performance Notes

- **Response time**: 2-5 seconds per request (depends on VLR.gg)
- **Rate limiting**: 1 second delay between requests to VLR.gg
- **Caching**: No caching - always fresh data
- **Concurrency**: Sequential requests to avoid overloading VLR.gg

## Development

To start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api/`

## Error Handling

If VLR.gg is unavailable or scraping fails, you'll get:

```json
{
  "success": false,
  "error": "Failed to scrape matches from VLR.gg"
}
```
