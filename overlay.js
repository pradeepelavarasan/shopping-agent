// Prevent redeclaration errors on re-injection
if (window.shoppingAgentLoaded) {
    if (typeof window.saInjectOverlay === 'function') window.saInjectOverlay();
} else {
    window.shoppingAgentLoaded = true;

    window.currentPriorities = [
      "Customer Sentiment",
      "Reliability",
      "Value for Money",
      "Feature Completeness",
      "Build Quality"
    ];
    window.draftPriorities = [...window.currentPriorities];

  
  function renderDropdownItems(container) {
      container.innerHTML = '';
      window.draftPriorities.forEach((pri, index) => {
          const item = document.createElement('div');
          item.className = 'dropdown-pri-item';
          
          const dragSpan = document.createElement('span');
          dragSpan.className = 'drag-handle';
          dragSpan.innerHTML = '☰';
          
          const textSpan = document.createElement('span');
          textSpan.className = 'pri-text';
          textSpan.innerText = pri;
          textSpan.style.flex = "1";
          
          const delBtn = document.createElement('span');
          delBtn.className = 'del-pri-btn';
          delBtn.innerHTML = '✖';
          delBtn.title = "Remove";
          
          item.appendChild(dragSpan);
          item.appendChild(textSpan);
          item.appendChild(delBtn);
          
          delBtn.addEventListener('click', () => {
              item.remove();
          });
          
          container.appendChild(item);
      });
      
      if (window.Sortable) {
          window.Sortable.create(container, {
              animation: 200,
              handle: '.drag-handle',
              ghostClass: 'dragging',
              easing: "cubic-bezier(1, 0, 0, 1)"
          });
      }
  }

  function toggleScrollLock(lock) {
      if (lock) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }
  }
  
  window.saInjectOverlay = function injectOverlay() {
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
                  </div>
                  <div class="header-actions">
                      <div class="dropdown-wrapper">
                          <button class="tune-btn" id="sa-tune-btn">🧠 How I recommend</button>
                          <div id="sa-tune-dropdown" class="sa-tune-dropdown hidden">
                              <div class="dropdown-title">🧠 How I Recommend</div>
                              <div class="dropdown-sub" style="line-height: 1.5;">Below are the order of decisions I use to evaluate the options. Please reorder based on your preferences or add custom criteria to have a highly personalized experience.</div>
                              <div id="sa-priorities-vertical" class="vertical-drag-list"></div>
                              <div class="add-pri-row">
                                 <input type="text" id="new-pri-input" placeholder="e.g., Aesthetics, Made in India" autocomplete="off" />
                                 <button id="add-pri-btn" title="Add Criteria">+</button>
                              </div>
                              <div class="dropdown-actions">
                                  <button id="sa-cancel-edit" class="btn-cancel">Cancel</button>
                                  <button id="sa-save-edit" class="btn-save">✔ Save</button>
                              </div>
                          </div>
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

          // Floating minimizer button (Only for Amazon domains)
          const isAmazon = /amazon\.(com|in|co\.uk|ca|de|fr|es|it|com\.au|co\.jp|ae|sa|com\.br|com\.mx|sg|nl|tr|be|pl|se)/i.test(window.location.hostname);
          let floater = null;
          if (isAmazon) {
              floater = document.createElement('div');
              floater.id = 'sa-floater';
              floater.innerHTML = `✨ Shopping Agent`;
          }

          shadowRoot.appendChild(container);
          shadowRoot.appendChild(backdrop);
          if (floater) shadowRoot.appendChild(floater);

  
          let editing = false;
          const tuneBtn = shadowRoot.getElementById('sa-tune-btn');
          const dropdown = shadowRoot.getElementById('sa-tune-dropdown');
          const cancelBtn = shadowRoot.getElementById('sa-cancel-edit');
          const saveBtn = shadowRoot.getElementById('sa-save-edit');
          const addPriBtn = shadowRoot.getElementById('add-pri-btn');
          const newPriInput = shadowRoot.getElementById('new-pri-input');
          const verticalList = shadowRoot.getElementById('sa-priorities-vertical');
          
          tuneBtn.addEventListener('click', () => {
              window.draftPriorities = [...window.currentPriorities];
              renderDropdownItems(verticalList);
              dropdown.classList.toggle('hidden');
          });

          addPriBtn.addEventListener('click', () => {
              const val = newPriInput.value.trim();
              const currentNodes = verticalList.querySelectorAll('.pri-text');
              
              if (currentNodes.length >= 7) {
                  newPriInput.value = '';
                  newPriInput.placeholder = "Max 7 criteria limit reached";
                  return;
              }
              
              if (val) {
                  window.draftPriorities = Array.from(currentNodes).map(n => n.innerText);
                  window.draftPriorities.push(val);
                  renderDropdownItems(verticalList);
                  newPriInput.value = '';
                  newPriInput.placeholder = "e.g., Aesthetics, Made in India";
              }
          });
          newPriInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') addPriBtn.click();
          });

          cancelBtn.addEventListener('click', () => {
              dropdown.classList.add('hidden');
          });
          
          saveBtn.addEventListener('click', () => {
              const finalNodes = verticalList.querySelectorAll('.pri-text');
              window.currentPriorities = Array.from(finalNodes).map(n => n.innerText);
              dropdown.classList.add('hidden');
              
              const content = shadowRoot.getElementById('sa-content');
              content.innerHTML = `<div class="loading-block"><div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div><div id="loading-cycler">Initializing Re-analysis...</div></div>`;
              
              saMode = 'Re-analyzing';
              if (window.saLoadingInterval) clearInterval(window.saLoadingInterval);
              const cycler = shadowRoot.getElementById('loading-cycler');
              if (cycler) {
                  let i = 0;
                  window.saLoadingInterval = setInterval(() => {
                        const pris = window.currentPriorities || [];
                        const text = pris.length > 0 ? pris[i % pris.length] : "Evaluating";
                        if (cycler) cycler.innerHTML = `${saMode} ${text}...`;
                      i++;
                  }, 1200);
              }

              chrome.runtime.sendMessage({ action: 'RUN_COMPARISON', priorities: window.currentPriorities, forceRefresh: true });
          });
  
          const closeExtension = () => {
              container.classList.remove('open');
              toggleScrollLock(false);
              setTimeout(() => host.remove(), 400);
              if (window.saLoadingInterval) clearInterval(window.saLoadingInterval);
          };

          // Hard Close
          shadowRoot.getElementById('sa-close').addEventListener('click', closeExtension);

          // Smart Dismissal
          backdrop.addEventListener('click', () => {
              if (isAmazon) {
                  // Minimize on supported pages
                  container.classList.add('minimized');
                  toggleScrollLock(false);
              } else {
                  // Completely close on unsupported pages
                  closeExtension();
              }
          });

          // Un-minimize (Clicking floater)
          if (floater) {
              floater.addEventListener('click', () => {
                  container.classList.remove('minimized');
                  toggleScrollLock(true);
                  const content = shadowRoot.getElementById('sa-content');
                  if (content && content.innerHTML.trim() === '') {
                      content.innerHTML = `<div class="loading-block"><div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div><div id="loading-cycler">Restoring Matrix...</div></div>`;
                      chrome.runtime.sendMessage({ action: 'TRIGGER_FULL_RUN' });
                  }
              });
          }
  
          requestAnimationFrame(() => {
              setTimeout(() => {
                  container.classList.add('open');
                  toggleScrollLock(true);
              }, 50);
          });
      } else {
          // If invoked while already existing but minimized, restore it
          const container = host.shadowRoot.getElementById('shopping-agent-container');
          if (container && container.classList.contains('minimized')) {
              container.classList.remove('minimized');
              toggleScrollLock(true);
          }
      }
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'MINIMIZE_ONLY') {
          const shadowHost = document.getElementById('shopping-agent-host');
          if (shadowHost && shadowHost.shadowRoot) {
              const wrapper = shadowHost.shadowRoot.getElementById('shopping-agent-container');
              if (wrapper) {
                  wrapper.classList.add('minimized');
                  toggleScrollLock(false);
              }
          }
      } else if (request.action === 'UPDATE_UI') {
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
                      const pris = window.currentPriorities || [];
                      const text = pris.length > 0 ? pris[i % pris.length] : "Evaluating";
                      cycler.innerHTML = `${modeText} ${text}...`;
                      i++;
                  }, 1200);
              }
              
              const buttons = shadowHost.shadowRoot.querySelectorAll('.jump-to-tab');
              buttons.forEach(btn => {
                  btn.addEventListener('click', (e) => {
                      const tabWrapper = e.target.closest('.jump-to-tab');
                      if (tabWrapper) {
                          const tabId = parseInt(tabWrapper.dataset.tabId, 10);
                          chrome.runtime.sendMessage({ action: 'JUMP_TO_TAB', tabId });
                      }
                  });
              });
  
              const saveApiKeyBtn = shadowHost.shadowRoot.getElementById('sa-save-apikey');
              if (saveApiKeyBtn) {
                  saveApiKeyBtn.addEventListener('click', () => {
                      const key = shadowHost.shadowRoot.getElementById('sa-apikey-input').value;
                      chrome.runtime.sendMessage({ action: 'SAVE_API_KEY', key: key, priorities: window.currentPriorities });
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

              // Error screen Retry Button
              const retryBtns = shadowHost.shadowRoot.querySelectorAll('.err-retry-btn');
              retryBtns.forEach(btn => {
                  btn.addEventListener('click', () => {
                      const content = shadowHost.shadowRoot.getElementById('sa-content');
                      content.innerHTML = `<div class="loading-block"><div class="ai-analyzer"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div><div id="loading-cycler">Retrying Matrix...</div></div>`;
                      chrome.runtime.sendMessage({ action: 'TRIGGER_FULL_RUN' });
                  });
              });
          }
      }
  });
  window.saInjectOverlay();
}


