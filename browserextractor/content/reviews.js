// Extractor for Business Reviews

async function extractReviews() {
    const MAX_REVIEWS = 20;
    let reviews = [];

    try {
        // 1. Click reviews tab
        const reviewsClicked = await (async () => {
            const buttons = document.querySelectorAll('button[role="tab"]');
            for (const btn of buttons) {
                const text = btn.innerText.trim().toLowerCase();
                if (text.includes("reviews") || text.includes("avis")) {
                    btn.click();
                    return true;
                }
            }
            const fallbackBtn = document.querySelector('button[jsaction*="review"], button[aria-label*="reviews"]');
            if (fallbackBtn) {
                fallbackBtn.click();
                return true;
            }
            return false;
        })();

        if (!reviewsClicked) {
            console.warn("Reviews button not found");
        } else {
            await humanDelay(1500, 2500);

            // 2. Sort by Newest
            const sortClicked = await (async () => {
                const sortBtn = document.querySelector('button[aria-label*="Sort"], button[aria-label*="Trier"], button[jsaction*="pane.reviewChart.moreReviews"]');
                if (sortBtn) {
                    sortBtn.click();
                    return true;
                }
                const allBtns = document.querySelectorAll('button');
                for (const btn of allBtns) {
                    const text = btn.innerText.trim().toLowerCase();
                    if (text === "sort" || text === "trier") {
                        btn.click();
                        return true;
                    }
                }
                return false;
            })();

            if (sortClicked) {
                await humanDelay(1000, 1500);
                await (async () => {
                    const menuItems = document.querySelectorAll('div[role="menuitemradio"]');
                    if (menuItems.length > 1) {
                        menuItems[1].click(); // Second item is typically "Newest"
                        return true;
                    }
                    const divs = document.querySelectorAll('div[role="menuitemradio"], div.fxNQSd, div');
                    for (const div of divs) {
                        const text = div.innerText.trim().toLowerCase();
                        if (text.includes("newest") || text.includes("récent") || text.includes("recent")) {
                            div.click();
                            return true;
                        }
                    }
                    return false;
                })();
                await humanDelay(1500, 2500);
            }

            // 3. Scroll to load 20 reviews
            let previous_card_count = 0;
            let stuck_count = 0;
            for (let scroll_attempt = 0; scroll_attempt < 15; scroll_attempt++) {
                const cards = document.querySelectorAll('div[class*="jftiEf"], div[jscontroller*="review"]');
                const current_count = cards.length;
                if (current_count >= MAX_REVIEWS) break;

                if (current_count === previous_card_count) {
                    stuck_count++;
                    if (stuck_count >= 3) break;
                } else {
                    stuck_count = 0;
                }
                previous_card_count = current_count;

                const card = document.querySelector('div[class*="jftiEf"], div[jscontroller*="review"]');
                if (card) {
                    let parent = card.parentElement;
                    let scrolled = false;
                    while (parent) {
                        if (parent.scrollHeight > parent.clientHeight && window.getComputedStyle(parent).overflowY !== 'hidden') {
                            parent.scrollBy(0, 3000);
                            scrolled = true;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                    if (!scrolled) {
                        const panels = document.querySelectorAll('div[class*="m6QErb"], div[role*="dialog"]');
                        for (const p of panels) {
                            if (p.scrollHeight > p.clientHeight) {
                                p.scrollBy(0, 3000);
                                break;
                            }
                        }
                    }
                }
                await humanDelay(1500, 2500);
            }

            // 4. Expand "More" text
            const btns = document.querySelectorAll('button[aria-expanded="false"]');
            for (const btn of btns) {
                const text = btn.innerText.trim().toLowerCase();
                if (text === "plus" || text === "more" || text.includes("plus")) {
                    btn.click();
                }
            }
            const altBtns = document.querySelectorAll('button.w8nwRe');
            for (const btn of altBtns) {
                if (btn.getAttribute('aria-expanded') === 'false') {
                    btn.click();
                }
            }
            await humanDelay(1000, 1500);

            // 5. Extract cards
            const review_cards = Array.from(document.querySelectorAll('div[class*="jftiEf"], div[jscontroller*="review"]'));
            for (let i = 0; i < Math.min(review_cards.length, MAX_REVIEWS); i++) {
                const card = review_cards[i];
                try {
                    let name = null, rating = null, text = null, date = null, rel_time = null, review_url = null;
                    const name_el = card.querySelector('div[class*="d4r55"]');
                    if (name_el) name = name_el.innerText.trim();

                    const rating_el = card.querySelector('span[role="img"]');
                    if (rating_el) {
                        const aria = rating_el.getAttribute('aria-label');
                        if (aria) {
                            const match = aria.match(/(\d+(?:\.\d+)?)/);
                            if (match) rating = parseFloat(match[1]);
                        }
                    }

                    const text_el = card.querySelector('span[class*="wiI7pd"]');
                    if (text_el) text = text_el.innerText.trim();

                    const date_el = card.querySelector('span[class*="rsqaWe"]');
                    if (date_el) date = date_el.innerText.trim();

                    const rel_el = card.querySelector('span[class*="review-date"], span[class*="DZSgXb"]');
                    if (rel_el) rel_time = rel_el.innerText.trim();
                    if (!rel_time && date) rel_time = date;

                    const parent_link = card.querySelector('a');
                    if (parent_link) review_url = parent_link.href;

                    if (name || rating || text) {
                        reviews.push({
                            reviewer_name: name,
                            review_rating: rating,
                            review_text: text,
                            review_date: date,
                            review_relative_time: rel_time,
                            review_url: review_url
                        });
                    }
                } catch (e) {
                    console.debug("Failed to extract a review card:", e);
                }
            }
        }
    } catch (e) {
        console.warn("Error extracting reviews:", e);
    }



    return reviews;
}
