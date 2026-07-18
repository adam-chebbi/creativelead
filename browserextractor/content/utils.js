// Shared utilities for LeadsCC Extension

function logVerbose(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
        console.log(`[LeadsCC ${timestamp}] ${message}`, data);
    } else {
        console.log(`[LeadsCC ${timestamp}] ${message}`);
    }
}

async function safelySendMessage(message) {
    try {
        if (!chrome.runtime?.id) return; // Extension context invalid
        await chrome.runtime.sendMessage(message);
    } catch (e) {
        if (e.message && e.message.includes("Receiving end does not exist")) {
            return;
        }
        console.warn("Message sending failed (likely harmless):", e);
    }
}

function humanDelay(min = 500, max = 1500) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Exponential backoff helper — doubles wait time on each attempt.
 * @param {number} attempt - zero-based attempt count
 * @param {number} base - base delay in ms (default 1500ms)
 * @param {number} cap - maximum delay in ms (default 30000ms / 30s)
 */
function exponentialBackoff(attempt, base = 1500, cap = 30000) {
    const delay = Math.min(base * Math.pow(2, attempt), cap);
    const jitter = Math.random() * 0.3 * delay; // add up to 30% jitter
    return new Promise(resolve => setTimeout(resolve, delay + jitter));
}

async function waitForDetailsLoad() {
    let attempts = 0;
    const MAX_ATTEMPTS = 25; // 25 * 200ms = 5000ms fast poll
    while (attempts < MAX_ATTEMPTS) {
        if (document.querySelector('button[data-item-id="address"]') ||
            document.querySelector('button[data-tooltip="Copy phone number"]') ||
            document.querySelector('.fontHeadlineLarge')) {
            return true;
        }
        await new Promise(r => setTimeout(r, 200));
        attempts++;
    }
    return false;
}

async function saveLeadLocally(lead) {
    try {
        const result = await chrome.storage.local.get(['extractedLeads']);
        let leads = result.extractedLeads || [];
        
        const url = lead.maps_url || lead.google_maps_url;
        if (url) {
            const isDuplicate = leads.some(l => (l.maps_url || l.google_maps_url) === url);
            if (isDuplicate) {
                logVerbose("Duplicate lead detected, skipping save.", lead.business_name);
                return false;
            }
        }
        
        leads.push(lead);
        await chrome.storage.local.set({ extractedLeads: leads });
        return true;
    } catch (e) {
        console.error("Failed to save lead locally:", e);
        return false;
    }
}

async function submitBatch(leads) {
    try {
        const response = await chrome.runtime.sendMessage({ action: "SUBMIT_LEADS", leads: leads });
        if (response && response.success) {
            safelySendMessage({ type: "STATUS_UPDATE", status: "Batch Upload Complete!" });
        } else {
            safelySendMessage({ type: "STATUS_UPDATE", status: "Upload Failed: " + (response ? response.error : 'Unknown') });
        }
    } catch (e) {
        console.error("Batch submission failed", e);
        safelySendMessage({ type: "STATUS_UPDATE", status: "Upload Error (Check Console)" });
    }
}

async function submitLead(lead) {
    await submitBatch([lead]);
}
