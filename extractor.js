// extractor.js
(function() {
  const getSafeText = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.innerText.trim() : "";
  };

  const getSafeAttr = (selector, attr) => {
    const el = document.querySelector(selector);
    return el ? el.getAttribute(attr) : "";
  };

  const title = getSafeText('#productTitle');
  const price = getSafeText('.a-price .a-offscreen') || getSafeText('#priceblock_ourprice') || getSafeText('.a-color-price');
  
  const rawRating = getSafeText('#acrPopover') || getSafeText('.a-icon-star .a-icon-alt') || getSafeText('.a-icon-star');
  const ratingMatch = rawRating.match(/(\d+\.\d+)/);
  const rating = ratingMatch ? ratingMatch[1] : "";

  const rawReviews = getSafeText('#acrCustomerReviewText');
  const reviewMatch = rawReviews.match(/([\d,]+)/);
  const reviewsCount = reviewMatch ? reviewMatch[1] : "";

  const image = getSafeAttr('#landingImage', 'src') || getSafeAttr('#imgBlkFront', 'src') || getSafeAttr('#main-image', 'src');
  
  // Extract bullet points
  const bulletPoints = Array.from(document.querySelectorAll('#feature-bullets li span.a-list-item'))
    .map(el => el.innerText.trim())
    .filter(text => text.length > 5 && !text.includes('Make sure this fits'))
    .join('. ');
    
  // Sub-description
  const descriptionText = getSafeText('#productDescription') || "";

  // Extract Amazon AI Summary or fallback to Raw Reviews
  let summaryBlock = document.querySelector('div[data-hook="cr-summarization-attribute"]');
  if (!summaryBlock) summaryBlock = document.querySelector('#cr-summarization-attributes-list');
  if (!summaryBlock) {
      const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
      const customersSayH = headings.find(h => h.innerText.trim().toLowerCase() === 'customers say');
      if (customersSayH) summaryBlock = customersSayH.parentElement;
  }

  let topReviewsText = "";
  let reviewsSource = "";
  
  if (summaryBlock && summaryBlock.innerText.length > 50) {
      // High Confidence: Has the Amazon aggregated AI summary and tagging pills
      topReviewsText = summaryBlock.innerText.replace(/Generated from the text of customer reviews/gi, '').trim();
      reviewsSource = "Amazon AI Aggregate Summary (High Confidence factor)";
  } else {
      // Low Confidence: New product, manually scrape the top raw reviews instead
      const reviewElements = Array.from(document.querySelectorAll('[data-hook="review-body"], .review-text'));
      if (reviewElements.length > 0) {
          topReviewsText = reviewElements.slice(0, 4).map(el => el.innerText.trim()).join(' | ');
          reviewsSource = `Raw User Reviews (Low Confidence factor, only ${reviewElements.length} reviews scraped)`;
      } else {
          topReviewsText = "No reviews found.";
          reviewsSource = "No Data";
      }
  }
    
  return {
    title,
    price,
    rating,
    reviews: reviewsCount,
    image,
    description: (bulletPoints + " " + descriptionText).substring(0, 1000),
    topReviews: topReviewsText.substring(0, 1500),
    reviewsSource: reviewsSource
  };
})();
