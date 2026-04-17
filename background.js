// background.js
async function getApiKey() {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    return result.geminiApiKey;
}
  
async function runComparison(tab, apiKey) {
    const sendUpdate = (htmlContent) => {
        chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_UI', html: htmlContent }, () => {
            if (chrome.runtime.lastError) { let ignore = chrome.runtime.lastError; }
        });
    };

    try {
        sendUpdate('<div class="loading">Locating your Amazon product tabs...</div>');

        // Find all Amazon tabs in the current window using explicit valid match patterns
        const tabs = await chrome.tabs.query({ 
            url: [
                "*://*.amazon.com/*", 
                "*://*.amazon.in/*", 
                "*://*.amazon.co.uk/*", 
                "*://*.amazon.ca/*",
                "*://*.amazon.com.au/*"
            ], 
            currentWindow: true 
        });
        
        const productTabs = tabs.filter(t => /\/dp\/|\/gp\/product\//i.test(t.url)).slice(0, 8);

        if (productTabs.length === 0) {
            sendUpdate('<div class="error">No specific Amazon products found in open tabs.<br/><br/>Please open some product pages first (e.g., pages with /dp/ in the URL).</div>');
            return;
        }

        sendUpdate('<div class="loading">Extracting data from ' + productTabs.length + ' products...</div>');

        const productDataList = [];
        for (const aTab of productTabs) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: aTab.id },
                    files: ['extractor.js']
                });
                if (results && results[0] && results[0].result) {
                    const data = results[0].result;
                    if (data.title && data.title.trim().length > 0) {
                        data.tabId = aTab.id;
                        productDataList.push(data);
                    }
                }
            } catch (err) {
                console.warn("Failed to extract data from tab", aTab.id, err);
            }
        }

        if (productDataList.length === 0) {
            sendUpdate('<div class="error">Failed to extract legible product data from the open tabs.<br/>Make sure your Amazon pages are fully loaded.</div>');
            return;
        }

        sendUpdate('<div class="loading">Reading actual customer reviews...<br/><br/>Comparing ' + productDataList.length + ' products...</div>');

        const prompt = `You are an expert AI Shopping Agent. I am providing you with details of several products currently open in a user's browser, including their review summaries. Evaluate each product specifically focusing on:\n1. 'Brand Recognition & Trust'\n2. 'Quality of materials / Longevity'\n3. 'Customer Sentiment Summary' (Synthesize the newly provided review data into a sharp, 1-2 sentence summary of what real users actually say).\n\nCrucially, based on an overall assessment of value, brand, quality, and giving appropriate weight to the customer reviews (High Confidence aggregates should be weighed heavily, Low Confidence raw reviews weighed lightly), you MUST select EXACTLY ONE product as the absolute top recommendation for the user.\n\nRespond ONLY with a valid JSON array matching this exact schema for each product (no markdown formatting, no comments):\n[\n  {\n    "tabId": <number>,\n    "brand_recognition_summary": "<short string>",\n    "quality_longevity_summary": "<short string>",\n    "customer_sentiment_summary": "<short string>",\n    "is_top_recommendation": <boolean>,\n    "recommendation_reason": "<If is_top_recommendation is true, formulate a subjective summary starting with 'Based on your preference for...' and give the recommendation reason. Otherwise leave empty.>"\n  }\n]\n\nProducts Data:\n` + JSON.stringify(productDataList.map(p => ({ tabId: p.tabId, title: p.title, description: p.description, price: p.price, rating: p.rating, reviewsCount: p.reviews, reviewsSourceLevel: p.reviewsSource, reviewsTextData: p.topReviews })));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const aiData = await response.json();
        let aiText = aiData.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedAiData = JSON.parse(aiText);

        // Figure out which is top, and sort so top is at index 0
        const topRecId = parsedAiData.find(x => x.is_top_recommendation)?.tabId;
        productDataList.sort((a, b) => {
            if (a.tabId === topRecId) return -1;
            if (b.tabId === topRecId) return 1;
            return 0;
        });

        let finalHtml = '<div class="product-cards">';
        productDataList.forEach(prod => {
            const aiInsight = parsedAiData.find(x => x.tabId === prod.tabId) || { brand_recognition_summary: "No insight available.", quality_longevity_summary: "No insight available.", customer_sentiment_summary: "No reviews to analyze." };
            const isTop = prod.tabId === topRecId;

            let cardClasses = 'product-card';
            let topBadgeHtml = '';

            if (isTop) {
                cardClasses += ' top-recommendation';
                topBadgeHtml = `
                    <div class="top-badge">⭐ Top Recommendation</div>
                    <div class="top-reason">${aiInsight.recommendation_reason || "Based on an overall assessment of value, customer reviews, and brand, this is our top recommendation."}</div>
                `;
            }

            const reviewsStr = prod.reviews ? ` (${prod.reviews} reviews)` : '';
            const ratingStr = prod.rating ? `⭐ ${prod.rating}${reviewsStr}` : 'No Rating';

            finalHtml += `
            <div class="${cardClasses}">
                ${topBadgeHtml}
                <div class="card-body">
                    <div class="prod-img">
                        <img src="${prod.image || 'https://via.placeholder.com/120?text=No+Image'}" alt="Product Image" />
                    </div>
                    <div class="prod-info">
                        <div class="prod-title" title="${prod.title.replace(/"/g, '&quot;')}">${prod.title}</div>
                        <div class="prod-metrics">
                            <span class="price">${prod.price || 'Price Unavailable'}</span>
                            <span class="rating">${ratingStr}</span>
                        </div>
                        <div class="ai-insight">
                            <strong>Brand:</strong> ${aiInsight.brand_recognition_summary}
                        </div>
                        <div class="ai-insight">
                            <strong>Longevity:</strong> ${aiInsight.quality_longevity_summary}
                        </div>
                        <div class="ai-insight review-summary">
                            <strong>Review Summary:</strong> ${aiInsight.customer_sentiment_summary}
                        </div>
                        <button class="jump-to-tab" data-tab-id="${prod.tabId}">Go to Product</button>
                    </div>
                </div>
            </div>`;
        });
        finalHtml += '</div>';

        sendUpdate(finalHtml);

    } catch (err) {
        console.error("System Error in runComparison:", err);
        sendUpdate(`<div class="error">Something went wrong.<br/>Error: ${err.message}</div>`);
    }
}

chrome.action.onClicked.addListener(async (tab) => {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['overlay.js']
        });
    } catch (e) {
        console.error(`Cannot inject overlay into this tab (${tab.url}):`, e);
        chrome.action.setBadgeText({ text: "ERR", tabId: tab.id });
        setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 3000);
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    const apiKey = await getApiKey();
    if (!apiKey) {
        const sendUpdate = (htmlContent) => {
            chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_UI', html: htmlContent }, () => {
                if (chrome.runtime.lastError) { let ignore = chrome.runtime.lastError; }
            });
        };
        const html = `
            <div class="api-key-prompt">
                <p>Welcome to <strong>Shopping Agent</strong>.<br/>To intelligently analyze products, please provide your Gemini API Key:</p>
                <input type="password" id="sa-apikey-input" placeholder="AI Studio API Key" />
                <button id="sa-save-apikey">Save Key & Start</button>
                <p style="font-size: 11px; opacity: 0.6; margin-top: 15px;">Your key is stored securely in your browser's local storage and only used for API calls.</p>
            </div>
        `;
        sendUpdate(html);
        return;
    }

    runComparison(tab, apiKey);
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'JUMP_TO_TAB') {
        chrome.tabs.update(request.tabId, { active: true });
    } else if (request.action === 'SAVE_API_KEY') {
        if (request.key && request.key.trim().length > 0) {
            const newKey = request.key.trim();
            await chrome.storage.local.set({ geminiApiKey: newKey });
            
            // Immediately start the comparison
            chrome.tabs.sendMessage(sender.tab.id, { action: 'UPDATE_UI', html: '<div class="loading">API Key verified. Starting auto-comparison...</div>' }, () => {
                if (chrome.runtime.lastError) { let ignore = chrome.runtime.lastError; }
            });
            setTimeout(() => {
                runComparison(sender.tab, newKey);
            }, 800);
        }
    }
});
