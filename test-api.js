const { VLRScraper } = require('./dist/lib/scraper.js');

async function testScraper() {
  console.log('🚀 Testing VLR.gg Real-time Scraper...\n');
  
  const scraper = new VLRScraper();
  
  try {
    // Test upcoming matches
    console.log('📅 Testing upcoming matches...');
    const upcomingMatches = await scraper.scrapeMatchesList('upcoming');
    console.log(`✅ Found ${upcomingMatches.length} upcoming matches`);
    if (upcomingMatches.length > 0) {
      console.log(`📝 Sample match: ${upcomingMatches[0].team1_name} vs ${upcomingMatches[0].team2_name}`);
    }
    console.log('');

    // Test live matches
    console.log('🔴 Testing live matches...');
    const liveMatches = await scraper.scrapeMatchesList('');
    const liveOnly = liveMatches.filter(m => m.status === 'live');
    console.log(`✅ Found ${liveOnly.length} live matches`);
    if (liveOnly.length > 0) {
      console.log(`📝 Sample live match: ${liveOnly[0].team1_name} vs ${liveOnly[0].team2_name}`);
    }
    console.log('');

    // Test completed matches
    console.log('✅ Testing completed matches...');
    const completedMatches = await scraper.scrapeMatchesList('results');
    const completedOnly = completedMatches.filter(m => m.status === 'completed');
    console.log(`✅ Found ${completedOnly.length} completed matches`);
    if (completedOnly.length > 0) {
      console.log(`📝 Sample completed match: ${completedOnly[0].team1_name} vs ${completedOnly[0].team2_name} (${completedOnly[0].team1_score}-${completedOnly[0].team2_score})`);
    }
    console.log('');

    console.log('🎉 Real-time scraping test completed successfully!');
    console.log(`📊 Total matches found: ${upcomingMatches.length + liveMatches.length + completedMatches.length}`);
    
    // Count unique teams and tournaments
    const allMatches = [...upcomingMatches, ...liveMatches, ...completedMatches];
    const uniqueTeams = new Set();
    const uniqueTournaments = new Set();
    
    allMatches.forEach(match => {
      if (match.team1_name) uniqueTeams.add(match.team1_name);
      if (match.team2_name) uniqueTeams.add(match.team2_name);
      if (match.tournament_name) uniqueTournaments.add(match.tournament_name);
    });
    
    console.log(`👥 Unique teams found: ${uniqueTeams.size}`);
    console.log(`🏆 Unique tournaments found: ${uniqueTournaments.size}`);
    
  } catch (error) {
    console.error('❌ Error testing scraper:', error.message);
  }
}

// Run the test
testScraper();
