// VLR.gg Scraper Frontend JavaScript

// Global variables
let isLoading = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('VLR.gg Scraper initialized');
    
    // Auto-refresh live matches every 30 seconds
    setInterval(checkLiveMatches, 30000);
    
    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined') {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
});

// Trigger manual scraping
async function triggerScrape() {
    if (isLoading) {
        console.log('Scraping already in progress');
        return;
    }
    
    isLoading = true;
    
    // Show loading modal
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    loadingModal.show();
    
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        // Hide loading modal
        loadingModal.hide();
        
        if (result.success) {
            showNotification('success', `Successfully scraped ${result.matches_count} matches!`);
            
            // Refresh page after 2 seconds
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            showNotification('error', `Scraping failed: ${result.message}`);
        }
        
    } catch (error) {
        console.error('Scraping error:', error);
        loadingModal.hide();
        showNotification('error', 'Network error occurred while scraping');
    } finally {
        isLoading = false;
    }
}

// Check for live matches and update UI
async function checkLiveMatches() {
    try {
        const response = await fetch('/api/matches?status=live&limit=5');
        const data = await response.json();
        
        const liveCount = data.matches.length;
        updateLiveMatchCounter(liveCount);
        
    } catch (error) {
        console.error('Error checking live matches:', error);
    }
}

// Update live match counter in UI
function updateLiveMatchCounter(count) {
    const liveCounters = document.querySelectorAll('.live-match-count');
    liveCounters.forEach(counter => {
        counter.textContent = count;
        
        // Add pulsing animation if there are live matches
        if (count > 0) {
            counter.classList.add('pulse');
        } else {
            counter.classList.remove('pulse');
        }
    });
}

// Show notification to user
function showNotification(type, message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '400px';
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Copy text to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('success', 'Copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

// Fallback for older browsers
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('success', 'Copied to clipboard!');
        } else {
            showNotification('error', 'Failed to copy');
        }
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
        showNotification('error', 'Failed to copy');
    }
    
    document.body.removeChild(textArea);
}

// Copy API URL to clipboard
function copyApiUrl() {
    const apiUrlInput = document.getElementById('apiUrl');
    if (apiUrlInput) {
        copyToClipboard(apiUrlInput.value);
    }
}

// Format relative time
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// Load more matches (for infinite scroll)
let currentPage = 1;
let isLoadingMore = false;

function loadMoreMatches() {
    if (isLoadingMore) return;
    
    isLoadingMore = true;
    currentPage++;
    
    const statusFilter = new URLSearchParams(window.location.search).get('status') || 'all';
    
    fetch(`/api/matches?status=${statusFilter}&page=${currentPage}`)
        .then(response => response.json())
        .then(data => {
            if (data.matches && data.matches.length > 0) {
                appendMatchesToTable(data.matches);
            }
        })
        .catch(error => {
            console.error('Error loading more matches:', error);
        })
        .finally(() => {
            isLoadingMore = false;
        });
}

// Append matches to existing table
function appendMatchesToTable(matches) {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;
    
    matches.forEach(match => {
        const row = createMatchRow(match);
        tbody.appendChild(row);
    });
}

// Create match table row
function createMatchRow(match) {
    const row = document.createElement('tr');
    
    const statusBadge = getStatusBadge(match.status);
    const timeDisplay = match.match_time ? 
        new Date(match.match_time).toLocaleDateString() : 'TBD';
    
    row.innerHTML = `
        <td>
            <div class="match-teams">
                <div class="team">
                    <span class="fw-bold">${match.team1 || 'TBD'}</span>
                </div>
                <div class="vs-divider text-muted">vs</div>
                <div class="team">
                    <span class="fw-bold">${match.team2 || 'TBD'}</span>
                </div>
            </div>
        </td>
        <td>
            <span class="badge bg-primary fs-6">
                ${match.team1_score} - ${match.team2_score}
            </span>
        </td>
        <td>
            <div class="tournament-info">
                <div class="fw-bold">${match.tournament || 'Unknown Tournament'}</div>
            </div>
        </td>
        <td>
            <small class="text-muted">${match.stage || '–'}</small>
        </td>
        <td>
            <span class="badge bg-secondary">${match.match_format || 'Bo3'}</span>
        </td>
        <td>${statusBadge}</td>
        <td>
            <div class="match-time">
                <div>${timeDisplay}</div>
            </div>
        </td>
        <td>
            <div class="btn-group btn-group-sm">
                <a href="/match/${match.id}" class="btn btn-outline-primary">
                    <i class="fas fa-eye"></i>
                </a>
                ${match.match_url ? `
                    <a href="${match.match_url}" target="_blank" class="btn btn-outline-secondary">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                ` : ''}
            </div>
        </td>
    `;
    
    return row;
}

// Get status badge HTML
function getStatusBadge(status) {
    switch (status) {
        case 'live':
            return '<span class="badge bg-danger"><i class="fas fa-circle fa-xs me-1"></i>LIVE</span>';
        case 'upcoming':
            return '<span class="badge bg-warning"><i class="fas fa-clock fa-xs me-1"></i>Upcoming</span>';
        case 'completed':
            return '<span class="badge bg-success"><i class="fas fa-check-circle fa-xs me-1"></i>Completed</span>';
        default:
            return '<span class="badge bg-secondary">Unknown</span>';
    }
}

// Initialize infinite scroll if on matches page
if (window.location.pathname === '/matches') {
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
            loadMoreMatches();
        }
    });
}

// Real-time updates for live matches
function startLiveUpdates() {
    // Check if we're on a page that shows live matches
    const hasLiveMatches = document.querySelector('.badge.bg-danger');
    
    if (hasLiveMatches) {
        // Update every 30 seconds
        setInterval(async () => {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                // Update live match count
                updateLiveMatchCounter(stats.live_matches);
                
            } catch (error) {
                console.error('Error fetching live updates:', error);
            }
        }, 30000);
    }
}

// Start live updates
startLiveUpdates();

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + R to trigger scraping
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        triggerScrape();
    }
    
    // Escape to close modals
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        });
    }
});

// Export functions for global access
window.triggerScrape = triggerScrape;
window.copyApiUrl = copyApiUrl;
window.copyToClipboard = copyToClipboard;
