document.addEventListener('DOMContentLoaded', async () => {
    const authTokenInput = document.getElementById('authToken');
    const saveTokenBtn = document.getElementById('saveToken');
    const authStatus = document.getElementById('authStatus');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');
    const extractionStatus = document.getElementById('extractionStatus');
    const extractedCount = document.getElementById('extractedCount');
    const messageArea = document.getElementById('messageArea');

    const limitInput = document.getElementById('limitInput');
    const currentBusiness = document.getElementById('currentBusiness');
    const searchQueryInput = document.getElementById('searchQuery');
    const searchLocationInput = document.getElementById('searchLocation');

    // Load saved settings
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (authToken) {
        authTokenInput.value = authToken;
        authStatus.textContent = "Token saved";
        authStatus.style.color = "green";
    }

    // Save token
    saveTokenBtn.addEventListener('click', async () => {
        const token = authTokenInput.value.trim();
        if (token) {
            await chrome.storage.local.set({ authToken: token });
            authStatus.textContent = "Saved!";
            authStatus.style.color = "green";
            setTimeout(() => {
                authStatus.textContent = "Token saved";
            }, 2000);
        }
    });

    // Message Listener for status updates from background/content
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATUS_UPDATE') {
            extractionStatus.textContent = message.status;
            if (message.count !== undefined) {
                extractedCount.textContent = message.count;
            }
            if (message.businessName) {
                currentBusiness.textContent = message.businessName;
            }
        }
        if (message.type === 'ERROR') {
            messageArea.textContent = message.error;
            messageArea.style.color = "red";
        }
    });

    // Check current tab
    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Start Extraction
    startBtn.addEventListener('click', async () => {
        const query = searchQueryInput.value.trim();
        const location = searchLocationInput.value.trim();
        const limit = parseInt(limitInput.value, 10);
        
        if (isNaN(limit) || limit < 1 || limit > 100) {
            messageArea.textContent = "Please enter a limit between 1 and 100.";
            messageArea.style.color = "red";
            return;
        }

        if (query && location) {
            messageArea.textContent = "Initiating search...";
            messageArea.style.color = "#666";
            chrome.runtime.sendMessage({
                action: "INITIATE_SEARCH",
                query: query,
                location: location,
                limit: limit
            });
            extractionStatus.textContent = "Extracting...";
            extractionStatus.className = "value active";
            messageArea.textContent = "Search tab opened. Extraction will begin automatically.";
            messageArea.style.color = "green";
            return;
        }

        const tab = await getCurrentTab();

        if (!tab || !tab.url || !tab.url.includes("google.com/maps")) {
            messageArea.textContent = "Please enter a search query/location above, OR go to https://www.google.com/maps first.";
            messageArea.style.color = "red";
            return;
        }

        try {
            messageArea.textContent = "Sending start command...";
            messageArea.style.color = "#666";
            await chrome.tabs.sendMessage(tab.id, { action: "START_EXTRACTION", limit: limit });
            extractionStatus.textContent = "Extracting...";
            extractionStatus.className = "value active"; 
            messageArea.textContent = "Extraction started.";
            messageArea.style.color = "green";
            currentBusiness.textContent = "Searching..."; 
        } catch (e) {
            console.error(e);
            messageArea.textContent = "Could not start. Refresh the Google Maps page and try again.";
            messageArea.style.color = "red";
        }
    });

    // Stop Extraction
    stopBtn.addEventListener('click', async () => {
        const tab = await getCurrentTab();
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "STOP_EXTRACTION" });
            extractionStatus.textContent = "Stopping...";
        } catch (e) {
            console.error(e);
        }
    });

    // Export Local Leads
    exportBtn.addEventListener('click', async () => {
        const format = 'json';
        messageArea.textContent = "Exporting...";
        messageArea.style.color = "#666";
        try {
            chrome.runtime.sendMessage({ action: "EXPORT_LOCAL", format: format }, (response) => {
                if (response && response.success) {
                    messageArea.textContent = "Export successful!";
                    messageArea.style.color = "green";
                } else {
                    messageArea.textContent = "Export failed: " + (response ? response.error : 'Unknown error');
                    messageArea.style.color = "red";
                }
            });
        } catch (e) {
            console.error(e);
            messageArea.textContent = "Export error.";
            messageArea.style.color = "red";
        }
    });
});
