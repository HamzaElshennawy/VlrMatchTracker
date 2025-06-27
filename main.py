import os
import subprocess
import threading
import time
import requests
from flask import Flask, request, Response

app = Flask(__name__)
NEXTJS_PORT = 3000
NEXTJS_URL = f"http://localhost:{NEXTJS_PORT}"

@app.route('/')
def home():
    return """
    <h1>VLR.gg Scraper API</h1>
    <p>This is a Next.js API server for scraping Valorant esports data from VLR.gg</p>
    <p>The Next.js server is running on port 3000. API requests are being proxied.</p>
    <h2>Available Endpoints:</h2>
    <ul>
        <li><a href="/api/matches">/api/matches</a> - All matches</li>
        <li><a href="/api/matches/upcoming">/api/matches/upcoming</a> - Upcoming matches</li>
        <li><a href="/api/matches/live">/api/matches/live</a> - Live matches</li>
        <li><a href="/api/matches/results">/api/matches/results</a> - Match results</li>
        <li><a href="/api/teams">/api/teams</a> - Teams data</li>
        <li><a href="/api/tournaments">/api/tournaments</a> - Tournaments data</li>
        <li><a href="/api/scrape">POST /api/scrape</a> - Trigger scraping</li>
    </ul>
    """

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_api(path):
    """Proxy API requests to Next.js server"""
    try:
        url = f"{NEXTJS_URL}/api/{path}"
        
        # Forward the request to Next.js
        if request.method == 'GET':
            resp = requests.get(url, params=request.args, timeout=30)
        elif request.method == 'POST':
            resp = requests.post(url, json=request.get_json(), params=request.args, timeout=30)
        elif request.method == 'PUT':
            resp = requests.put(url, json=request.get_json(), params=request.args, timeout=30)
        elif request.method == 'DELETE':
            resp = requests.delete(url, params=request.args, timeout=30)
        
        return Response(
            resp.content,
            status=resp.status_code,
            headers=dict(resp.headers)
        )
    except requests.exceptions.ConnectionError:
        return {"error": "Next.js server not available", "status": "starting"}, 503
    except Exception as e:
        return {"error": str(e)}, 500

def start_nextjs():
    """Start the Next.js server in a separate thread"""
    print("Starting Next.js server on port 3000...")
    try:
        env = os.environ.copy()
        env['NEXT_PORT'] = str(NEXTJS_PORT)
        subprocess.run(['node', 'main.js'], env=env, check=True)
    except Exception as e:
        print(f"Error starting Next.js: {e}")

# Start Next.js server in background
threading.Thread(target=start_nextjs, daemon=True).start()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)