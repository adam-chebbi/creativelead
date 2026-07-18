// Extractor for Business Profile Data

// Known sponsored / badge strings to ignore (case-insensitive)
const SPONSORED_LABELS = [
    'sponsored', 'sponsorisé', 'sponsorisée', 'sponsorisés',
    'gesponsert', 'patrocinado', 'patrocinada', 'gesponsord',
    'sponsrad', 'sponsoreret', 'sponsoroitu'
];

function isSponsoredText(text) {
    return SPONSORED_LABELS.includes(text.toLowerCase().trim());
}

function extractLeadDetails(url) {
    try {
        const h1s = Array.from(document.querySelectorAll('h1'));
        // The actual business name is usually the last h1 rendered in the detail pane
        // Skip any h1 whose sole text content is a sponsored/badge label
        const h1 = h1s.reverse().find(el =>
            el.classList.contains('fontHeadlineLarge') && !isSponsoredText(el.innerText)
        ) || h1s.find(el => !isSponsoredText(el.innerText)) || h1s[0];

        // Strip sponsored badge text that may be prepended/appended inside the element
        let raw_name = h1 ? h1.innerText.trim() : "Unknown";
        // Remove lines that are only a sponsored badge (multiline innerText edge case)
        raw_name = raw_name
            .split('\n')
            .filter(line => !isSponsoredText(line))
            .join(' ')
            .trim();
        const business_name = raw_name || "Unknown";

        let rating = null;
        let reviews_count = null;
        const starSpan = document.querySelector('span[role="img"][aria-label*="stars"]') ||
            document.querySelector('span[aria-label*="stars"]');

        if (starSpan) {
            const label = starSpan.getAttribute('aria-label');
            const match = label.match(/([\d\.]+)\s+stars\s+([\d,]+)/);
            if (match) {
                rating = parseFloat(match[1]);
                reviews_count = parseInt(match[2].replace(/,/g, ''));
            }
        }

        const categoryBtn = document.querySelector('button[jsaction="pane.rating.category"]') ||
            document.querySelector('button[jsaction*="category"]');
        const category = categoryBtn ? categoryBtn.innerText.trim() : "";

        const addressBtn = document.querySelector('button[data-item-id="address"]');
        let location = "";
        if (addressBtn) {
            const label = addressBtn.getAttribute('aria-label') || "";
            // Strip any prefix before colon (e.g. "Address: ", "Adresse: ")
            location = label.replace(/^[^:]+:\s*/, '').trim();
            if (!location) {
                const textDiv = addressBtn.querySelector('.fontBodyMedium');
                if (textDiv) location = textDiv.innerText.trim();
            }
        }

        const phoneBtn = document.querySelector('button[data-tooltip="Copy phone number"]') ||
            document.querySelector('button[data-item-id*="phone"]');
        let phone = "";
        if (phoneBtn) {
            const label = phoneBtn.getAttribute('aria-label') || "";
            // Strip any prefix before colon (e.g. "Phone: ", "Numéro de téléphone: ")
            phone = label.replace(/^[^:]+:\s*/, '').trim();
            if (!phone) {
                const textDiv = phoneBtn.querySelector('.fontBodyMedium');
                if (textDiv) phone = textDiv.innerText.trim();
            }
        }

        const websiteBtn = document.querySelector('a[data-item-id="authority"]');
        let website = "";
        if (websiteBtn) {
            website = websiteBtn.href;
        }

        return {
            business_name,
            location,
            phone,
            website,
            maps_url: url,
            rating,
            reviews_count,
            category,
            source: "extension_maps"
        };
    } catch (e) {
        console.error("Extraction error", e);
        return null;
    }
}
