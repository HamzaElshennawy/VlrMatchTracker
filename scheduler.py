import atexit
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from scraper import VLRScraper
from app import app

def scrape_matches_job():
    """Background job to scrape matches"""
    with app.app_context():
        try:
            logging.info("Starting scheduled match scraping...")
            scraper = VLRScraper()
            matches_count = scraper.scrape_all_matches()
            logging.info(f"Scheduled scraping completed. Found {matches_count} matches.")
        except Exception as e:
            logging.error(f"Scheduled scraping failed: {str(e)}")

def start_scheduler():
    """Start the background scheduler"""
    scheduler = BackgroundScheduler()
    
    # Schedule scraping every 15 minutes
    scheduler.add_job(
        func=scrape_matches_job,
        trigger="interval",
        minutes=15,
        id='scrape_matches'
    )
    
    # Run initial scraping after 30 seconds
    scheduler.add_job(
        func=scrape_matches_job,
        trigger="date",
        run_date='2025-06-27 06:30:00',
        id='initial_scrape'
    )
    
    scheduler.start()
    logging.info("Background scheduler started")
    
    # Shut down the scheduler when exiting the app
    atexit.register(lambda: scheduler.shutdown())
