---

> A smart, modern AI Chrome extension that automatically reads your shopping tabs and gives you a recommendation with comprehensive comparison.
> 
> ✨ **Your API Key + Your Decision Logic = Your Personalized Shopping Agent.**

---

## 📖 "The What" — What is the product?
Shopping Agent is a Chrome extension built for power shoppers. Instead of helplessly flipping back and forth between 5 different product tabs trying to remember which laptop had better battery life or which headphones had better customer reviews, the Shopping Agent pulls everything into a single, beautiful dark-mode overlay. 

It acts as a literal manifestation of your brain's internal machine learning model. By reading photos, prices, ratings, and raw user reviews directly from your open tabs, it feeds them into Google's Gemini AI and outputs a color-coded sentiment matrix (Positive, Neutral, Negative) entirely mapped to your deeply personalized priorities.

---

## 🤔 "The Why" — The Problem It Solves
Comparing products online is cognitively exhausting. Every shopper inherently builds an internal "mental ML model" of features they care about (e.g., price-to-performance, aesthetics, durability). But actually applying that model computationally across scattered browser tabs forces you to hold massive amounts of transient data in your head. The typical workflow looks like this:

1. Open 5 different tabs for 5 different products.
2. Read the reviews for Product A.
3. Switch to Product B. Try to find the same information.
4. Forget what Product A's warranty was. Switch back to Product A.
5. Create an ugly Excel sheet or make mental notes that immediately vanish.

These constraints make informed shopping tedious and frustrating. 

**Shopping Agent externalizes your mental model.** By extracting your cognitive load into an intelligent UI, shopping becomes instant. You open your tabs, hit the extension button, and the AI evaluates the pages exactly how *you* would. You never lose your place, and you instantly see how products stack up side-by-side against the dimensions that specifically matter to you.

---

## 🛠️ "How to get it"

Since this extension isn't on the Chrome Web Store yet, installing it is a quick 2-minute process using Chrome's Developer Mode.

### 1. Download the Files
- Download this repository as a ZIP file (Click the green `<> Code` button at the top right of this page -> `Download ZIP`).
- Extract and unzip the folder onto your computer.

### 2. Add it to Chrome
- Open Google Chrome and type `chrome://extensions/` in your URL bar.
- Turn on **Developer mode** (the toggle switch in the top right corner).
- Click the **"Load unpacked"** button in the top left.
- Select the completely unzipped folder you downloaded earlier.
- *Tip:* Click the puzzle piece icon 🧩 in your Chrome toolbar and **Pin** the Shopping Agent "Stellar S" icon to your bar so it's always one click away!

### 3. Start Comparing
- Open up a few product pages (e.g., on Amazon) in your browser.
- Click the Shopping Agent icon.
- On your first run, you will be prompted to enter a Gemini API Key (see below). Once entered, the AI will immediately scan your tabs and build your matrix! 

### 🔑 How to generate a Gemini Key
The extension runs natively in your browser, so you need your own AI key. It's completely free and takes less than 60 seconds:
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **"Get API Key"** in the left menu.
4. Click **"Create API key in new project"**.
5. Copy the key and paste it into the Shopping Agent extension. That's it!

---

## 🔧 "The Hard Parts" — Challenges & Learnings
Building an extension that bridges local browser DOM scraping and an external LLM gracefully had several tricky components.

### Dynamic Shadow DOM Injector
If we injected CSS directly into Amazon's pages, Amazon's complex stylesheets would instantly break our matrix layout. The solution was mounting the entire UI inside a **Shadow DOM** (`Element.attachShadow`). This created an isolated CSS environment where our sleek, glassmorphism dark-mode UI couldn't be polluted by Amazon's native styles.

### Structured JSON from LLMs
Prompting an LLM to "compare products" usually results in a massive block of unformatted text. To build a deterministic grid matrix, we had to enforce a strict nested JSON schema. We used a zero-shot prompt instructing Gemini to return exactly a `{ "ProductId": { "Criteria": { "analysis": "...", "score": "positive" } } }` object. The extension parses this JSON programmatically to inject the `sent-positive` (Green) and `sent-negative` (Red) CSS classes natively into the DOM grid.

### Cross-Tab Scraping and Context Execution
Browser security rightfully restricts one tab from reading another. To scrape all the products, the central `background.js` Service Worker had to query `chrome.tabs`, inject the `extractor.js` payload into *every* open Amazon tab asynchronously, wait for the DOM promises to resolve and return the scraped data, and then safely package it into a single payload for the AI API.

### Drag and Drop Physics
Native HTML5 drag-and-drop is famously rigid and stutters heavily on nested DOM elements. We implemented **SortableJS** to handle the custom priority sorting menu. Stripping our custom `pointer-events: none` hacks and letting Sortable natively manage the DOM collision physics resulted in a buttery-smooth, spring-loaded sorting UX.

---

```text
┌─────────────────────────────────────────────────────┐
│                    User's Browser                   │
│                                                     │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│ │ Amazon Tab │  │ Amazon Tab │  │ Amazon Tab │      │
│ └──────┬─────┘  └──────┬─────┘  └──────┬─────┘      │
│        │               │               │            │
│        ▼               ▼               ▼            │
│   (extractor.js scrapes titles, prices, reviews)    │
└────────────────────────┼────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│          Service Worker (background.js)             │
│                                                     │
│  1. Aggregates scraped data from all tabs           │
│  2. Checks local cache for unchanged data           │
│  3. Packages System Prompt & JSON enforcement       │
│  4. HTTPS POST → Google Gemini API                  │
│  5. Parses JSON response & calculates DOM layout    │
│  6. Injects shadow UI into the Active Tab           │
└────────────────────────┼────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│             Active Amazon Tab (UI)                  │
│                                                     │
│  ├─ Displays Shadow DOM Matrix                      │
│  ├─ Maps AI sent-positive/negative CSS              │
│  └─ SortableJS listener for priority drag-drop      │
└─────────────────────────────────────────────────────┘
```

### Key technology choices
| Layer | Technology | Why |
|---|---|---|
| Extension Core | Manifest V3 | Standard for modern secure Chrome extensions |
| UI/Styles | Vanilla HTML/CSS inside Shadow DOM | Zero-dependency, complete style isolation from Amazon |
| Scraping | `chrome.scripting.executeScript` | Allows the background worker to silently extract DOMs |
| AI Engine | Gemini 1.5 Flash Platform | Incredible speed and large context window (generous free tier) |
| Interaction | SortableJS | Provides fluid, magnetic physics for reordering priorities |
| Storage | `chrome.storage.local` | Secure persistence for API keys and UI render caching |

### Project structure
| File / Folder | What it does |
|---|---|
| `manifest.json` | Extension configuration, routing, and strict domain permissions. **(Tip: To expand the agent beyond Amazon, simply add new e-commerce URLs to the `host_permissions` array here!)** |
| `background.js` | The central brain. Manages API calls, error intercepts, and UI generation |
| `extractor.js` | Content script injected into tabs to securely scrape prices, ratings, and reviews. **(Note: You will need to update the CSS selectors here if adapting for a non-Amazon shopping domain.)** |
| `overlay.js` | UI controllers, click listeners, and sorting handlers for the Matrix |
| `overlay.css` | All styling tokens for the dark-mode glassmorphism grid |
| `sortable.min.js` | Physics engine for drag-and-drop customization |

---

*Built by [Pradeep Elavarasan](https://www.linkedin.com/in/pradeepelavarasan/) · Co-created with Google DeepMind Agent*
