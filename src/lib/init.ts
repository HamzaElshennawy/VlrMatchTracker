// Initialize the VLR.gg scraper scheduler when the app starts
import SchedulerService from './scheduler';

let isInitialized = false;

export function initializeApp() {
  if (isInitialized) {
    return;
  }

  console.log('Initializing VLR.gg Scraper API...');
  
  // Start the background scheduler
  const scheduler = SchedulerService.getInstance();
  scheduler.start();
  
  isInitialized = true;
  console.log('VLR.gg Scraper API initialized successfully');
}

export function getSchedulerStatus() {
  const scheduler = SchedulerService.getInstance();
  return scheduler.getStatus();
}