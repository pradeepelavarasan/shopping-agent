// overlay.js

let currentPriorities = [
    "Customer Sentiment",
    "Reliability",
    "Value for Money",
    "Feature Completeness",
    "Build Quality"
  ];
  let draftPriorities = [...currentPriorities];
  
  function renderChips(container, editing) {
      container.innerHTML = '';
      const prioritiesToRender = editing ? draftPriorities : currentPriorities;
      
      prioritiesToRender.forEach((pri, index) => {
          const chip = document.createElement('div');
          chip.className = 'chip';
          
          let tierClass = "tier-low";
          if (index < 2) tierClass = "tier-high";
          else if (index === 2) tierClass = "tier-med";
          chip.classList.add(tierClass);
          
          const handleHtml = editing ? `<span class="drag-handle"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></span>` : "";
            
          chip.innerHTML = `${handleHtml}<span>${pri}</span>`;
          
          if (editing) {
              chip.draggable = true;
              chip.dataset.index = index;
              
              chip.addEventListener('dragstart', (e) => {
                  e.dataTransfer.setData('text/plain', index);
                  setTimeout(() => chip.style.opacity = '0.4', 0);
              });
              chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });
              chip.addEventListener('dragover', (e) => e.preventDefault());
              chip.addEventListener('drop', (e) => {
                  e.preventDefault();
                  const fromIndex = e.dataTransfer.getData('text/plain');
                  const toIndex = index;
                  const item = draftPriorities.splice(fromIndex, 1)[0];
                  draftPriorities.splice(toIndex, 0, item);
                  renderChips(container, true);
              });
          }
          container.appendChild(chip);
      });
  }
  
  function injectOverlay() {
      let host = document.getElementById('shopping-agent-host');
      
      let saMode = 'Analyzing'; // State variable for cycler (Analyzing vs Re-analyzing)
      
      if (!host) {
          host = document.createElement('div');
          host.id = 'shopping-agent-host';
          host.style.position = 'fixed';
          host.style.top = '0';
          host.style.right = '0';
          host.style.width = '0';
          host.style.height = '0';
          host.style.zIndex = '2147483647';
          document.body.appendChild(host);
  
          const shadowRoot = host.attachShadow({ mode: 'open' });
          
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = chrome.runtime.getURL('overlay.css');
          shadowRoot.appendChild(link);
  
          // Core Container
          const container = document.createElement('div');
          container.id = 'shopping-agent-container';
          container.innerHTML = `
              <div class="header">
                  <div class="header-left">
                      <h2>✨ Shopping Agent</h2>
                      <div class="chips-container" id="sa-chips"></div>
                  </div>
                  <div class="header-actions">
                      <div class="edit-actions">
                          <button class="icon-btn" id="sa-edit-btn" title="Edit Priority Order"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                          <button class="icon-btn danger hidden" id="sa-cancel-btn" title="Cancel Actions"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                          <button class="icon-btn success hidden" id="sa-save-btn" title="Save & Re-analyze"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
                      </div>
                      <div class="divider"></div>
                      <button id="sa-close" title="Close Completely">&times;</button>
                  </div>
              </div>
              <div id="sa-content">
                  <div class="loading-block">
                      <div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
                      <div id="loading-cycler">Initializing Agent...</div>
                  </div>
              </div>
          `;
          
          // Backdrop for capturing outside clicks
          const backdrop = document.createElement('div');
          backdrop.id = 'sa-backdrop';

          // Floating minimizer button
          const floater = document.createElement('div');
          floater.id = 'sa-floater';
          floater.innerHTML = `✨ Shopping Agent`;

          shadowRoot.appendChild(container);
          shadowRoot.appendChild(backdrop);
          shadowRoot.appendChild(floater);
  
          let editing = false;
          const chipsContainer = shadowRoot.getElementById('sa-chips');
          const editBtn = shadowRoot.getElementById('sa-edit-btn');
          const cancelBtn = shadowRoot.getElementById('sa-cancel-btn');
          const saveBtn = shadowRoot.getElementById('sa-save-btn');
          
          renderChips(chipsContainer, false);
  
          function setEditMode(state) {
              editing = state;
              if (editing) {
                  draftPriorities = [...currentPriorities]; 
                  editBtn.classList.add('hidden');
                  cancelBtn.classList.remove('hidden');
                  saveBtn.classList.remove('hidden');
                  chipsContainer.classList.add('editing');
                  renderChips(chipsContainer, true);
              } else {
                  editBtn.classList.remove('hidden');
                  cancelBtn.classList.add('hidden');
                  saveBtn.classList.add('hidden');
                  chipsContainer.classList.remove('editing');
                  renderChips(chipsContainer, false);
              }
          }

          editBtn.addEventListener('click', () => setEditMode(true));
          cancelBtn.addEventListener('click', () => setEditMode(false));
          
          saveBtn.addEventListener('click', () => {
              currentPriorities = [...draftPriorities];
              setEditMode(false);
              const content = shadowRoot.getElementById('sa-content');
              content.innerHTML = `<div class="loading-block"><div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div><div id="loading-cycler">Initializing Re-analysis...</div></div>`;
              
              saMode = 'Re-analyzing';
              if (window.saLoadingInterval) clearInterval(window.saLoadingInterval);
              const cycler = shadowRoot.getElementById('loading-cycler');
              if (cycler) {
                  let i = 0;
                  window.saLoadingInterval = setInterval(() => {
                      cycler.innerHTML = `${saMode} ${currentPriorities[i % currentPriorities.length]}...`;
                      i++;
                  }, 1200);
              }

              chrome.runtime.sendMessage({ action: 'RUN_COMPARISON', priorities: currentPriorities, forceRefresh: true });
          });
  
          // Hard Close
          shadowRoot.getElementById('sa-close').addEventListener('click', () => {
              container.classList.remove('open');
              setTimeout(() => host.remove(), 400);
              if (window.saLoadingInterval) clearInterval(window.saLoadingInterval);
          });

          // Soft Minimize (Clicking background)
          backdrop.addEventListener('click', () => {
              container.classList.add('minimized');
          });

          // Un-minimize (Clicking floater)
          floater.addEventListener('click', () => {
              container.classList.remove('minimized');
          });
  
          requestAnimationFrame(() => {
              setTimeout(() => container.classList.add('open'), 50);
          });
      } else {
          // If invoked while already existing but minimized, restore it
          const container = host.shadowRoot.getElementById('shopping-agent-container');
          if (container && container.classList.contains('minimized')) {
              container.classList.remove('minimized');
          }
      }
  }
  
  injectOverlay();
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'UPDATE_UI') {
          const shadowHost = document.getElementById('shopping-agent-host');
          if (shadowHost && shadowHost.shadowRoot) {
              const content = shadowHost.shadowRoot.getElementById('sa-content');
              content.innerHTML = request.html;
              
              if (window.saLoadingInterval) clearInterval(window.saLoadingInterval);
              const cycler = shadowHost.shadowRoot.getElementById('loading-cycler');
              if (cycler) {
                  let i = 0;
                  // If we don't have a specific mode set yet, default to 'Analyzing'
                  const modeText = typeof saMode !== 'undefined' ? saMode : 'Analyzing';
                  window.saLoadingInterval = setInterval(() => {
                      cycler.innerHTML = `${modeText} ${currentPriorities[i % currentPriorities.length]}...`;
                      i++;
                  }, 1200);
              }
              
              const buttons = shadowHost.shadowRoot.querySelectorAll('.jump-to-tab');
              buttons.forEach(btn => {
                  btn.addEventListener('click', (e) => {
                      const tabId = parseInt(e.target.dataset.tabId, 10);
                      chrome.runtime.sendMessage({ action: 'JUMP_TO_TAB', tabId });
                  });
              });
  
              const saveApiKeyBtn = shadowHost.shadowRoot.getElementById('sa-save-apikey');
              if (saveApiKeyBtn) {
                  saveApiKeyBtn.addEventListener('click', () => {
                      const key = shadowHost.shadowRoot.getElementById('sa-apikey-input').value;
                      chrome.runtime.sendMessage({ action: 'SAVE_API_KEY', key: key, priorities: currentPriorities });
                  });
              }

              const errBtns = shadowHost.shadowRoot.querySelectorAll('.err-toggle-btn');
              errBtns.forEach(btn => {
                  btn.addEventListener('click', () => {
                      const trace = btn.parentElement.nextElementSibling;
                      if (trace && trace.classList.contains('hidden')) {
                          trace.classList.remove('hidden');
                          btn.innerText = 'Hide Error Details';
                      } else if (trace) {
                          trace.classList.add('hidden');
                          btn.innerText = 'Show Error Details';
                      }
                  });
              });
          }
      }
  });
