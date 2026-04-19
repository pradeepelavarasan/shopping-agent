// background.js
async function getApiKey() {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    return result.geminiApiKey;
}
  
async function runComparison(tab, apiKey, priorities, forceRefresh = false) {
    const defaultPriorities = [
        "Customer Sentiment",
        "Reliability",
        "Value for Money",
        "Feature Completeness",
        "Build Quality"
    ];
    const activePriorities = priorities || defaultPriorities;

    const sendUpdate = (htmlContent) => {
        chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_UI', html: htmlContent }, () => {
            if (chrome.runtime.lastError) { let ignore = chrome.runtime.lastError; }
        });
    };

    try {
        sendUpdate(`
        <div class="loading-block">
            <div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
            <div id="loading-cycler">Locating active Amazon tabs...</div>
        </div>`);

        const tabs = await chrome.tabs.query({ 
            url: [
                "*://*.amazon.com/*", "*://*.amazon.in/*", "*://*.amazon.co.uk/*", "*://*.amazon.ca/*",
                "*://*.amazon.de/*", "*://*.amazon.fr/*", "*://*.amazon.es/*", "*://*.amazon.it/*",
                "*://*.amazon.com.au/*", "*://*.amazon.co.jp/*", "*://*.amazon.ae/*", "*://*.amazon.sa/*",
                "*://*.amazon.com.br/*", "*://*.amazon.com.mx/*"
            ], 
            currentWindow: true 
        });
        
        const productTabs = tabs.filter(t => /\/dp\/|\/gp\/product\/|\/d\//i.test(t.url)).slice(0, 8);

        if (productTabs.length === 0) {
            sendUpdate(`
            <div class="agent-error-container">
                <div class="error-icon">🛒</div>
                <div class="error-title">No Products Found</div>
                <div class="error-user-msg">Invoke the agent when you already have some Amazon tabs open.</div>
                <p style="font-size: 13px; opacity: 0.7; margin-top: 10px;">The agent compares products you've already opened in your browser.</p>
            </div>`);
            return;
        }

        // --- CACHING SYSTEM LOGIC ---
        // Create a definitive hash string capturing the exact URLs and priority order!
        const currentHash = productTabs.map(t => t.url).sort().join('||') + '###' + activePriorities.join('|');
        const storageData = await chrome.storage.local.get(['cachedTabsHash', 'cachedMatrixHtml']);
        
        if (!forceRefresh && storageData.cachedTabsHash === currentHash && storageData.cachedMatrixHtml) {
            console.log("CACHE HIT! Displaying saved matrix to save API calls.");
            // Artificial delay so the loading spinner runs momentarily, improving UX
            await new Promise(r => setTimeout(r, 400));
            sendUpdate(storageData.cachedMatrixHtml);
            return;
        }


        sendUpdate(`
        <div class="loading-block">
            <div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
            <div id="loading-cycler">Extracting data from ${productTabs.length} products...</div>
        </div>`);

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

        sendUpdate(`
        <div class="loading-block">
            <div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
            <div id="loading-cycler">Analyzing Criteria...</div>
        </div>`);

        const highPri = activePriorities.slice(0, 2).join(", ");
        const medPri = activePriorities[2] || "None specifically";
        const lowPri = activePriorities.slice(3).join(", ");

        let _schemaEvalsStr = "";
        activePriorities.forEach((crit, index) => {
            const isLast = index === activePriorities.length - 1;
            _schemaEvalsStr += `         "${crit}": {
            "analysis": "<evaluate critically based on data>",
            "score": "<Type EXACTLY: positive, neutral, or negative>"
         }${isLast ? '' : ','}\n`;
        });

        const prompt = `You are an expert AI Shopping Agent. I am providing you with multiple products extracted from a user's browser.
You must construct a deeply analytical grid comparing these items.

Critique each product across ALL the specific criteria the user provided. You must dynamically generate a 1-2 sentence evaluation for EACH of the exact distinct criteria strings provided.

When choosing the Top Recommendation, you MUST strictly adhere to this custom user Priority Weighting:
[HIGH WEIGHT - Dealmakers]: ${highPri}
[MEDIUM WEIGHT - Tiebreakers]: ${medPri}
[LOW WEIGHT - Minor factors]: ${lowPri}

Crucially, you MUST speak directly to the user as their personal executive assistant. Provide a single "overall_agent_summary" at the root level explaining EXACTLY why you chose the top recommendation compared to the rest of the field.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "overall_agent_summary": "<1-2 natural language sentences explaining to the user exactly why you are recommending the Top Recommendation compared to the rest of the options.>",
  "products": [
    {
      "tabId": <number>,
      "is_top_recommendation": <boolean>,
      "evaluations": {
${_schemaEvalsStr}      }
    }
  ]
}

Products Data:
` + JSON.stringify(productDataList.map(p => ({ tabId: p.tabId, title: p.title, description: p.description, price: p.price, rating: p.rating, reviewsCount: p.reviews, reviewsSourceLevel: p.reviewsSource, reviewsTextData: p.topReviews })));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const aiData = await response.json();
        let aiText = aiData.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        // Robust JSON Sanitize for Gemini LLM trailing commas
        aiText = aiText.replace(/,\s*([\]}])/g, '$1');

        const parsedAiData = JSON.parse(aiText);

        const productsArray = Array.isArray(parsedAiData) ? parsedAiData : (parsedAiData.products || []);
        const rootSummary = parsedAiData.overall_agent_summary || "I have evaluated the market based on your priorities. Here is how they stack up.";

        const topRecId = productsArray.find(x => x.is_top_recommendation)?.tabId;
        productDataList.sort((a, b) => {
            if (a.tabId === topRecId) return -1;
            if (b.tabId === topRecId) return 1;
            return 0;
        });

        let finalHtml = `
        <div class="global-agent-summary">
            <div class="agent-avatar">✨</div>
            <div class="agent-text">"${rootSummary}"</div>
        </div>
        <div class="comparison-grid">`;
        productDataList.forEach(prod => {
            const aiInsight = productsArray.find(x => x.tabId === prod.tabId) || { evaluations: {} };
            const isTop = prod.tabId === topRecId;

            let colClass = isTop ? "grid-col top-rec" : "grid-col";
            let topBadge = isTop ? '<div class="top-badge-matrix">⭐ Top Recommendation</div>' : "";
            
            let evalRows = '';
            activePriorities.forEach(crit => {
                 const evalPayload = aiInsight.evaluations[crit];
                 let analysisText = "No data available from Agent.";
                 let scoreClass = "sent-neutral";
                 
                 if (evalPayload) {
                     if (typeof evalPayload === 'string') {
                         analysisText = evalPayload; // Fallback for old cache structure
                     } else {
                         analysisText = evalPayload.analysis || analysisText;
                         const score = (evalPayload.score || '').toLowerCase();
                         if (score.includes('pos')) scoreClass = 'sent-positive';
                         else if (score.includes('neg')) scoreClass = 'sent-negative';
                     }
                 }

                 evalRows += `
                 <div class="eval-row ${scoreClass}">
                    <span class="eval-label">${crit}</span>
                    <span class="eval-text">${analysisText}</span>
                 </div>`;
            });

            const reviewsStr = prod.reviews ? ` (${prod.reviews} reviews)` : '';
            const ratingStr = prod.rating ? `⭐ ${prod.rating}${reviewsStr}` : 'No Rating';

            finalHtml += `
            <div class="${colClass}">
                ${topBadge}
                <div class="product-click-zone jump-to-tab" data-tab-id="${prod.tabId}" title="Go to Product">
                    <div class="matrix-img-wrapper">
                         <div class="matrix-img"><img src="${prod.image || 'https://via.placeholder.com/180?text=No+Image'}" /></div>
                    </div>
                    <div class="grid-header">
                         <div class="matrix-title" title="${prod.title.replace(/"/g, '&quot;')}">${prod.title}</div>
                         <div class="matrix-metrics">
                               <span class="price">${prod.price || 'N/A'}</span>
                               <span class="rating">${ratingStr}</span>
                         </div>
                    </div>
                </div>
                <div class="grid-body">
                    ${evalRows}
                </div>
            </div>`;
        });
        finalHtml += '</div>';

        // Write to Chrome persistence cache
        await chrome.storage.local.set({ cachedTabsHash: currentHash, cachedMatrixHtml: finalHtml });

        sendUpdate(finalHtml);

    } catch (err) {
        console.error("System Error in runComparison:", err);
        
        let userMessage = "Something went wrong while processing the matrix data.";
        let rawError = err.message || err.toString();

        if (rawError.includes("AbortError")) {
            userMessage = "Analysis Timed Out. The AI Agent server took too long to respond. The connection was closed to prevent hanging. Please retry.";
        } else if (rawError.toLowerCase().includes("failed to fetch")) {
            userMessage = "Network Connection Error. Please verify your internet connection or check if the Gemini API is reachable from your network.";
        } else if (rawError.includes("429") || rawError.includes("quota")) {
            userMessage = "API Rate Limit Exceeded. The Agent has made too many requests. Please wait a moment and try again.";
        } else if (rawError.includes("JSON") || rawError.includes("parse") || rawError.includes("double-quoted property")) {
            userMessage = "The AI Agent generated an invalid or interrupted data structure. Simply hit 'Save Setup' above to force the agent to try again.";
        } else if (rawError.includes("403") || rawError.includes("400") || rawError.includes("API key not valid")) {
            userMessage = "API Key Error. Please ensure your Gemini key is correct and has the necessary permissions active.";
        } else if (rawError.includes("503")) {
            userMessage = "Google's Gemini AI servers are currently overloaded (Error 503). Please wait a few seconds and try again!";
        } else if (rawError.includes("500") || rawError.includes("502") || rawError.includes("504")) {
            userMessage = "Google's AI servers are temporarily experiencing connection issues. Please try again soon.";
        }

        const errorHtml = `
        <div class="agent-error-container">
            <div class="error-icon">⚠️</div>
            <div class="error-title">Agent Analysis Failed</div>
            <div class="error-user-msg">${userMessage}</div>
            <div class="error-actions" style="display: flex; gap: 12px; justify-content: center;">
                <button class="err-toggle-btn">Show Error Details</button>
                <button class="err-retry-btn">Retry</button>
            </div>
            <div class="error-raw-trace hidden">${rawError}</div>
        </div>`;
        
        sendUpdate(errorHtml);
    }
}

chrome.action.onClicked.addListener(async (tab) => {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['sortable.min.js', 'overlay.js']
        });
    } catch (e) {
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

    const defaultPriorities = [
        "Customer Sentiment",
        "Reliability",
        "Value for Money",
        "Feature Completeness",
        "Build Quality"
    ];
    runComparison(tab, apiKey, defaultPriorities, false);
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'JUMP_TO_TAB') {
        try {
            await chrome.scripting.executeScript({ target: { tabId: request.tabId }, files: ['sortable.min.js', 'overlay.js'] });
            chrome.tabs.sendMessage(request.tabId, { action: 'MINIMIZE_ONLY' });
            
            const data = await chrome.storage.local.get(['cachedMatrixHtml']);
            if (data.cachedMatrixHtml) {
                chrome.tabs.sendMessage(request.tabId, { action: 'UPDATE_UI', html: data.cachedMatrixHtml });
            }
        } catch (e) { console.warn("Could not inject proxy floater", e); }
        chrome.tabs.update(request.tabId, { active: true });
    } else if (request.action === 'SAVE_API_KEY') {
        if (request.key && request.key.trim().length > 0) {
            const newKey = request.key.trim();
            await chrome.storage.local.set({ geminiApiKey: newKey });
            
            chrome.tabs.sendMessage(sender.tab.id, { action: 'UPDATE_UI', html: `
            <div class="loading-block">
                <div class="spinner-modern"></div>
                <div id="loading-cycler">API Key verified. Starting auto-comparison...</div>
            </div>` }, () => {
                if (chrome.runtime.lastError) { let ignore = chrome.runtime.lastError; }
            });
            setTimeout(() => {
                runComparison(sender.tab, newKey, request.priorities, false);
            }, 800);
        }
    } else if (request.action === 'RUN_COMPARISON') {
        const apiKey = await getApiKey();
        if (apiKey) {
            runComparison(sender.tab, apiKey, request.priorities, request.forceRefresh);
        }
    } else if (request.action === 'TRIGGER_FULL_RUN') {
        const apiKey = await getApiKey();
        if (apiKey) {
            runComparison(sender.tab, apiKey, null, false);
        }
    }
});
