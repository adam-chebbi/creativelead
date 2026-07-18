// Background Script — Local Queue + Export
// Manages a search queue via chrome.alarms, keeps everything local.

const ALARM_NAME = 'creativelead-queue-tick';
const MIN_INTER_JOB_DELAY_MINUTES = 2; // min gap between queued searches

// ── Queue helpers ──────────────────────────────────────────────────
async function getQueue() {
    const { searchQueue } = await chrome.storage.local.get(['searchQueue']);
    return searchQueue || [];
}

async function setQueue(queue) {
    await chrome.storage.local.set({ searchQueue: queue });
}

/**
 * Add a search job to the queue.
 * @param {string} query - e.g. "Plumbers"
 * @param {string} location - e.g. "Austin, TX"
 * @param {number} limit - max leads to extract (1-100)
 */
async function enqueueSearch(query, location, limit = 50) {
    const queue = await getQueue();
    queue.push({ query, location, limit, status: 'pending', addedAt: Date.now() });
    await setQueue(queue);
    // Ensure alarm is running
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (!existing) {
        chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.1, periodInMinutes: MIN_INTER_JOB_DELAY_MINUTES });
    }
    return { success: true, queueLength: queue.length };
}

async function clearQueue() {
    await setQueue([]);
    await chrome.alarms.clear(ALARM_NAME);
    return { success: true };
}

// ── Alarm tick — process next pending job ──────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    const queue = await getQueue();
    const nextJob = queue.find(j => j.status === 'pending');

    if (!nextJob) {
        console.log('[Queue] No pending jobs. Clearing alarm.');
        await chrome.alarms.clear(ALARM_NAME);
        return;
    }

    console.log(`[Queue] Starting job: "${nextJob.query}" in "${nextJob.location}"`);
    nextJob.status = 'running';
    nextJob.startedAt = Date.now();
    await setQueue(queue);

    try {
        initiateSearch(nextJob.query, nextJob.location, nextJob.limit);
        // Mark done after a grace period — main.js will send a SHOW_RESULTS when done
        // We rely on SHOW_RESULTS message to mark the job complete
    } catch (e) {
        console.error('[Queue] Job failed:', e);
        nextJob.status = 'failed';
        nextJob.error = e.message;
        await setQueue(queue);
    }
});

// ── Message router ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SUBMIT_LEADS') {
        submitLeads(request.leads).then(sendResponse);
        return true;
    }
    if (request.action === 'EXPORT_LOCAL') {
        exportLocalLeads(request.format).then(sendResponse);
        return true;
    }
    if (request.action === 'INITIATE_SEARCH') {
        initiateSearch(request.query, request.location, request.limit);
        sendResponse({ success: true });
        return true;
    }
    if (request.action === 'ENQUEUE_SEARCH') {
        enqueueSearch(request.query, request.location, request.limit).then(sendResponse);
        return true;
    }
    if (request.action === 'GET_QUEUE') {
        getQueue().then(q => sendResponse({ queue: q }));
        return true;
    }
    if (request.action === 'CLEAR_QUEUE') {
        clearQueue().then(sendResponse);
        return true;
    }
    if (request.action === 'SHOW_RESULTS') {
        // Mark the running job as done
        getQueue().then(async (queue) => {
            const running = queue.find(j => j.status === 'running');
            if (running) {
                running.status = 'done';
                running.completedAt = Date.now();
                await setQueue(queue);
            }
            chrome.tabs.create({ url: chrome.runtime.getURL('results/results.html') });
        });
        sendResponse({ success: true });
        return true;
    }
});

// ── Core extraction trigger ────────────────────────────────────────
function initiateSearch(query, location, limit) {
    const searchUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(query + ' ' + location);

    chrome.tabs.create({ url: searchUrl }, (tab) => {
        const tabId = tab.id;

        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'START_EXTRACTION', limit: limit });
                }, 3000);
                chrome.tabs.onUpdated.removeListener(listener);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

// ── Local-only lead submission (no-op if no API token) ─────────────
async function submitLeads(leads) {
    try {
        const { authToken } = await chrome.storage.local.get(['authToken']);
        if (!authToken) {
            return { success: false, error: 'Local only — no API token configured.' };
        }
        return { success: true, data: { saved: leads.length } };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ── Local JSON export ────────────────────────────────────────
async function exportLocalLeads(format) {
    try {
        const { extractedLeads } = await chrome.storage.local.get(['extractedLeads']);
        if (!extractedLeads || extractedLeads.length === 0) {
            return { success: false, error: 'No leads found to export.' };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        const jsonStr = JSON.stringify(extractedLeads, null, 2);
        const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
        await chrome.downloads.download({
            url: dataUrl,
            filename: `creative_lead_export_${timestamp}.json`,
            saveAs: false
        });

        return { success: true };
    } catch (error) {
        console.error('Export error:', error);
        return { success: false, error: error.message };
    }
}
