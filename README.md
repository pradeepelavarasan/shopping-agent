# Shopping Agent

> A smart, modern AI Chrome extension that automatically reads your shopping tabs and gives you a recommendation with comprehensive comparison.
> 
> ✨ **Your API Key + Your Decision Logic = Your Personalized Shopping Agent.**

<img src=".github/assets/screenshot.png" width="800" alt="Shopping Agent UI Matrix">

📹 **Demo Video:** [https://www.youtube.com/watch?v=w7zaF-Wk0hI](https://www.youtube.com/watch?v=w7zaF-Wk0hI)


---

## 📖 "The What" — What is the product?
Shopping Agent is a Chrome extension built for power shoppers. Instead of helplessly flipping back and forth between several product tabs trying to remember specific details or customer reviews, the Shopping Agent pulls everything into a single, beautiful dark-mode overlay. 

It acts as a literal manifestation of your brain's internal machine learning model. By reading photos, prices, ratings, and raw user reviews directly from your open tabs, it feeds them into Google's Gemini AI and outputs a color-coded sentiment matrix (Positive, Neutral, Negative) entirely mapped to your deeply personalized priorities.

---

## 🤔 "The Why" — The Problem It Solves
Comparing products online is cognitively exhausting. Every shopper inherently builds an internal "mental ML model" of features they care about (e.g., price-to-performance, aesthetics, durability). But actually applying that model computationally across scattered browser tabs forces you to hold massive amounts of transient data in your head. The typical fragmented workflow looks like this:

1. Open multiple tabs for various product options.
2. Read and analyze the reviews for Product A.
3. Switch to Product B and try to locate the same metrics.
4. Forget a specific detail from Product A and switch back.
5. Manually track differences in a mental list or a separate document.

These context-switches and data-memory gaps kill comprehension and make informed shopping tedious and frustrating. Shopping Agent was built to collapse these steps into a single, instant view.

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
4. Click **"Create API key"** (found in the right-hand side top corner). 
   - *Tip:* The header also mentions how to generate a **Gemini (Free Tier)** key.
5. Copy the key and paste it into the Shopping Agent extension. That's it!

> [!NOTE] 
> **You will not be charged extra.** The Gemini Free Tier has no cost. Just ensure it is showing up as **Free Tier billing** to stay within the rate limits (which include a set number of calls per minute and per day).


---

## 🔧 "The Hard Parts" — Challenges & Learnings
Building an intelligent agent that feels like a natural extension of a user's decision-making process required solving several application-strategy dilemmas.

### 📍 The Scouting Limit (Search Results vs. Open Tabs)
One of our core challenges was deciding *where* the agent should scout. While searching for data on the search results page seems logical, these pages are data-poor and technically restricted from "deep-scraping" products that aren't yet open. We chose a **"Tab-First" strategy**: this ensures we only evaluate products the user has actually expressed interest in, while providing the high-fidelity data required for a nuanced AI comparison.

### 📊 Compliance vs. Data (The Review Strategy)
A major application hurdle is the inability to navigate through thousands of historical reviews, which are typically gated behind sub-pages and separate navigation structures. Since "deep-crawling" these off-tab pages is not a compliant way to navigate and is often restricted by anti-bot standards, we smartly pivoted our strategy. We leverage the "Top Reviews" and Amazon's own AI-generated sentiment summaries found directly on the main product page—delivering verified consumer sentiment while staying entirely within a compliant, high-speed browsing session.

### 🧠 The Missing Link (Personalization & Order History)
A true personalized agent would ideally auto-populate your preferences by analyzing your order history. Since reading past behavior is a significant privacy and technical hurdle, we chose to make the "Decision Logic" manual and transparent for now. Users can manually tweak priorities and criteria—building a bridge to future versions where we hope to remove this manual setup entirely by natively understanding your past shopping aspects.

---

## 🛠️ "The How" — Technical Architecture

```text
┌─────────────────────────────────────────────────────┐
│                    User's Browser                   │
│                                                     │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│ │ Product Tab│  │ Product Tab│  │ Product Tab│      │
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
│  4. HTTPS POST → Google Gemini AI                   │
│  5. Parses JSON response & calculates DOM layout    │
│  6. Injects shadow UI into the Active Tab           │
└────────────────────────┼────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│             Active Shopping Tab (UI)                │
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
| UI/Styles | Vanilla HTML/CSS inside Shadow DOM | Zero-dependency, complete style isolation from the host site |
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

*Built by [Pradeep Elavarasan](https://www.linkedin.com/in/pradeepelavarasan/) · Co-created with Google Agent*
