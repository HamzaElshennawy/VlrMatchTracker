import React from 'react';

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>VLR.gg Scraper API</h1>
      <p>Next.js TypeScript API for scraping comprehensive Valorant esports data from VLR.gg</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Available API Endpoints:</h2>
        <ul>
          <li><strong>GET /api/matches</strong> - Get all matches (upcoming, live, results)</li>
          <li><strong>GET /api/matches/upcoming</strong> - Get upcoming matches</li>
          <li><strong>GET /api/matches/live</strong> - Get live matches</li>
          <li><strong>GET /api/matches/results</strong> - Get completed matches</li>
          <li><strong>GET /api/match/[id]</strong> - Get detailed match data with maps, agents, and player stats</li>
          <li><strong>POST /api/scrape</strong> - Trigger manual scraping</li>
          <li><strong>GET /api/teams</strong> - Get all teams</li>
          <li><strong>GET /api/tournaments</strong> - Get all tournaments</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Features:</h2>
        <ul>
          <li>Comprehensive match data from VLR.gg</li>
          <li>Player statistics and agent picks per map</li>
          <li>Round scores and detailed match information</li>
          <li>Real-time updates for live matches</li>
          <li>SQLite database storage</li>
          <li>Automatic scheduled scraping</li>
        </ul>
      </div>
    </div>
  )
}