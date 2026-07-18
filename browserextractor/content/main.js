// Main Orchestration for Google Maps Extraction

let isExtracting = false;
let processedUrls = new Set();
let maxLeads = 0;
let sessionLeads = [];
let consecutiveFailures = 0; // track for backoff
const MAX_CONSECUTIVE_FAILURES = 3;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_EXTRACTION") {
        console.log("Received START_EXTRACTION command.");
        if (!isExtracting) {
            isExtracting = true;
            let requestedLimit = request.limit || 100;
            maxLeads = Math.min(requestedLimit, 100);
            console.log(`Starting extraction with limit: ${maxLeads}`);
            sessionLeads = []; // Start fresh batch on new run/resume
            extractionLoop();
        } else {
            console.log("Already extracting, ignoring start command.");
        }
    } else if (request.action === "STOP_EXTRACTION") {
        console.log("Received STOP_EXTRACTION command.");
        isExtracting = false;
    }
});

async function incrementalScroll(feed) {
    // Scroll in smaller chunks to be less aggressive and allow loading
    const totalScroll = 700;
    const steps = 3;
    const stepSize = Math.floor(totalScroll / steps);

    for (let i = 0; i < steps; i++) {
        if (!isExtracting) break;
        feed.scrollBy({ top: stepSize, behavior: 'smooth' });
        // Random delay between 500ms and 1000ms
        const delay = 500 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
    }
    // Final wait for load
    await new Promise(r => setTimeout(r, 1500));
}

async function extractionLoop() {
    logVerbose("Starting extraction loop...");

    if (!isExtracting) return;

    const feedSelector = 'div[role="feed"]';
    let feed = document.querySelector(feedSelector);

    if (!feed) {
        const noResults = document.body.innerText.includes("No results found") ||
            document.body.innerText.includes("Make sure your search is spelled correctly");
        if (noResults) {
            logVerbose("No results found on page.");
            safelySendMessage({ type: "STATUS_UPDATE", status: "Finished: No results found." });
            isExtracting = false;
            return;
        }

        console.error("Results list (feed) not found.");
        safelySendMessage({ type: "ERROR", error: "Results list not found. Please do a search on Google Maps first so results are visible." });
        isExtracting = false;
        return;
    }

    let noProgressIterations = 0;
    const MAX_NO_PROGRESS = 5;

    try {
        while (isExtracting) {
            if (processedUrls.size >= maxLeads) {
                logVerbose(`Limit reached (${maxLeads}). Stopping.`);
                safelySendMessage({ type: "STATUS_UPDATE", status: "Limit reached.", count: processedUrls.size });
                isExtracting = false;
                break;
            }

            const items = Array.from(feed.querySelectorAll('div[role="article"]'));
            const unprocessedItems = items.filter(item => {
                const link = item.querySelector('a[href*="/maps/place/"]');
                if (!link || processedUrls.has(link.href)) return false;

                // Skip sponsored / badge items — Google Maps shows a
                // "Sponsorisé" or "Sponsored" label inside sponsored articles.
                // We detect it by looking for any element whose trimmed text
                // matches a known badge string (case-insensitive).
                const SPONSORED_RE = /^(sponsored|sponsorisée?s?|gesponsert|patrocinad[oa]|gesponsord|sponsrad|sponsoreret|sponsoroitu)$/i;
                const allText = Array.from(item.querySelectorAll('*'))
                    .some(el => {
                        const txt = (el.childNodes.length === 1 && el.firstChild.nodeType === 3)
                            ? el.firstChild.textContent.trim()
                            : '';
                        return SPONSORED_RE.test(txt);
                    });
                if (allText) {
                    logVerbose('Skipping sponsored item in feed.');
                    // Mark URL as processed so we don't revisit it
                    processedUrls.add(link.href);
                    return false;
                }

                return true;
            });

            logVerbose(`Found ${items.length} total items, ${unprocessedItems.length} unprocessed.`);

            if (unprocessedItems.length > 0) {
                noProgressIterations = 0;

                for (const item of unprocessedItems) {
                    if (!isExtracting) break;
                    if (processedUrls.size >= maxLeads) break;

                    const link = item.querySelector('a[href*="/maps/place/"]');
                    const url = link.href;

                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await humanDelay(300, 600);

                    if (!isExtracting) break;

                    logVerbose(`Processing URL: ${url}`);
                    safelySendMessage({ type: "STATUS_UPDATE", status: "Clicking item...", businessName: "Loading..." });

                    await humanDelay(500, 1000);

                    if (!isExtracting) break;

                    const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    link.dispatchEvent(clickEvent);

                    const loaded = await waitForDetailsLoad();
                    if (!isExtracting) break;

                    if (!loaded) {
                        consecutiveFailures++;
                        console.warn(`Details failed to load (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}). Applying backoff.`);
                        await exponentialBackoff(consecutiveFailures - 1);
                        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                            console.error("Too many consecutive failures, pausing.");
                            safelySendMessage({ type: "STATUS_UPDATE", status: "PAUSED: Too many load failures. Resume?", businessName: "Error" });
                            isExtracting = false;
                            break;
                        }
                        processedUrls.add(url); // skip this item
                        continue;
                    }
                    consecutiveFailures = 0; // reset on success

                    await humanDelay(800, 1500);
                    if (!isExtracting) break;

                    const lead = extractLeadDetails(url);

                    if (lead) {
                        safelySendMessage({
                            type: "STATUS_UPDATE",
                            status: "Extracting reviews...",
                            businessName: lead.business_name
                        });
                        
                        // From reviews.js
                        lead.reviews = await extractReviews();

                        const tabs = document.querySelectorAll('button[role="tab"]');
                        if (tabs.length > 0) {
                            tabs[0].click();
                            await humanDelay(500, 1000);
                        }
                    }

                    if (lead) {
                        logVerbose("Lead extracted successfully", lead.business_name);
                        safelySendMessage({
                            type: "STATUS_UPDATE",
                            status: "Extracting...",
                            businessName: lead.business_name
                        });

                        const saved = await saveLeadLocally(lead);
                        if (saved) {
                            sessionLeads.push(lead);
                        }
                    } else {
                        logVerbose("Failed to extract details from page.");
                    }

                    processedUrls.add(url);
                    await humanDelay(500, 1000);
                    if (!isExtracting) break;

                    feed = document.querySelector(feedSelector);
                    if (!feed) {
                        console.warn("Lost feed reference, trying to find it...");
                        const backBtn = document.querySelector('button[aria-label="Back"]');
                        if (backBtn) {
                            backBtn.click();
                            await new Promise(r => setTimeout(r, 1000));
                        }
                        feed = document.querySelector(feedSelector);
                    }
                }
            } else {
                noProgressIterations++;
                logVerbose(`No new items. Attempt ${noProgressIterations}/${MAX_NO_PROGRESS} to scroll.`);

                if (noProgressIterations >= MAX_NO_PROGRESS) {
                    console.warn("Stuck detection triggered: No new items found after multiple scrolls.");
                    safelySendMessage({ type: "STATUS_UPDATE", status: "PAUSED: No new items found (End of list?). Resume?", businessName: "Stuck" });
                    isExtracting = false;
                    break;
                }

                if (feed) {
                    console.log("Scrolling...");
                    safelySendMessage({ type: "STATUS_UPDATE", status: "Scrolling for more results...", businessName: "-" });

                    await incrementalScroll(feed);
                    if (!isExtracting) break;

                    if (document.body.innerText.includes("You've reached the end of the list")) {
                        logVerbose("End of list detected textually.");
                        safelySendMessage({ type: "STATUS_UPDATE", status: "Finished: All results extracted." });
                        isExtracting = false;
                        break;
                    }
                } else {
                    console.error("Feed lost during scroll.");
                    isExtracting = false;
                }
            }
        }
    } catch (e) {
        console.error("Critical Loop Error:", e);
        safelySendMessage({ type: "STATUS_UPDATE", status: "Critical Error: " + e.message });
        isExtracting = false;
    } finally {
        if (sessionLeads.length > 0) {
            console.log(`Loop finished. Submitting ${sessionLeads.length} leads.`);
            safelySendMessage({ type: "STATUS_UPDATE", status: `Uploading ${sessionLeads.length} leads...` });
            await submitBatch(sessionLeads);
            sessionLeads = [];
        } else {
            console.log("Loop finished. No leads to submit.");
        }
        
        // Show results page when finished
        safelySendMessage({ action: "SHOW_RESULTS" });
    }
}
