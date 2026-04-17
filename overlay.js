// overlay.js
function injectOverlay() {
    let host = document.getElementById('shopping-agent-host');
    
    if (!host) {
        // Create the host for the Shadow DOM
        host = document.createElement('div');
        host.id = 'shopping-agent-host';
        // Avoid affecting host page layout
        host.style.position = 'fixed';
        host.style.top = '0';
        host.style.right = '0';
        host.style.width = '0';
        host.style.height = '0';
        host.style.zIndex = '2147483647';
        document.body.appendChild(host);

        // Attach Shadow DOM to prevent CSS cross-contamination
        const shadowRoot = host.attachShadow({ mode: 'open' });
        
        // Inject custom CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('overlay.css');
        shadowRoot.appendChild(link);

        // Inject UI Container
        const container = document.createElement('div');
        container.id = 'shopping-agent-container';
        container.innerHTML = `
            <div class="header">
                <h2>✨ Shopping Agent</h2>
                <button id="sa-close" title="Close Overlay">&times;</button>
            </div>
            <div id="sa-content">
                <div class="loading">Connecting to Shopping Agent...</div>
            </div>
        `;
        shadowRoot.appendChild(container);

        // Close logic
        shadowRoot.getElementById('sa-close').addEventListener('click', () => {
            container.classList.remove('open');
            setTimeout(() => host.remove(), 400); // remove after transition
        });

        // Slight delay to trigger CSS transition
        requestAnimationFrame(() => {
            setTimeout(() => {
                container.classList.add('open');
            }, 50);
        });
    }
}

injectOverlay();

// Listen for updates from the background worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'UPDATE_UI') {
        const shadowHost = document.getElementById('shopping-agent-host');
        if (shadowHost && shadowHost.shadowRoot) {
            const content = shadowHost.shadowRoot.getElementById('sa-content');
            content.innerHTML = request.html;
            
            // Attach event listeners for dynamic UI elements
            
            // 1. Jump to Tab buttons
            const buttons = shadowHost.shadowRoot.querySelectorAll('.jump-to-tab');
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tabId = parseInt(e.target.dataset.tabId, 10);
                    chrome.runtime.sendMessage({ action: 'JUMP_TO_TAB', tabId });
                });
            });

            // 2. Save API Key button
            const saveBtn = shadowHost.shadowRoot.getElementById('sa-save-apikey');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const key = shadowHost.shadowRoot.getElementById('sa-apikey-input').value;
                    chrome.runtime.sendMessage({ action: 'SAVE_API_KEY', key: key });
                });
            }
        }
    }
});
