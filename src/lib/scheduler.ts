import * as cron from 'node-cron';
import { VLRScraper } from './scraper';

class SchedulerService {
  private static instance: SchedulerService;
  private scraper: VLRScraper;
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;

  private constructor() {
    this.scraper = new VLRScraper();
  }

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  public start(): void {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    // Schedule scraping every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      console.log('Starting scheduled VLR.gg scraping...');
      try {
        const result = await this.scraper.scrapeAllMatches();
        console.log(`Scheduled scraping completed: ${result.matches_scraped} new, ${result.matches_updated} updated`);
      } catch (error) {
        console.error('Scheduled scraping failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.isRunning = true;
    console.log('VLR.gg scraper scheduler started - running every 15 minutes');

    // Run initial scraping after 30 seconds
    setTimeout(async () => {
      console.log('Running initial VLR.gg scraping...');
      try {
        const result = await this.scraper.scrapeAllMatches();
        console.log(`Initial scraping completed: ${result.matches_scraped} new, ${result.matches_updated} updated`);
      } catch (error) {
        console.error('Initial scraping failed:', error);
      }
    }, 30000);
  }

  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('VLR.gg scraper scheduler stopped');
  }

  public getStatus(): { isRunning: boolean; nextRun?: string } {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? 'Every 15 minutes' : undefined
    };
  }
}

export default SchedulerService;