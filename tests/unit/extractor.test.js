import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const extractorCode = fs.readFileSync(path.resolve(__dirname, '../../extractor.js'), 'utf8');

describe('extractor.js', () => {
  let dom;
  let document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.Node = dom.window.Node;
    global.Element = dom.window.Element;
  });

  const runExtractor = () => {
    // We use a Function constructor to simulate the execution environment
    // and capture the return value of the IIFE.
    return new Function('document', 'window', `return ${extractorCode}`)(document, dom.window);
  };

  it('extracts product title correctly', () => {
    document.body.innerHTML = '<h1 id="productTitle">   Test Product Title   </h1>';
    const result = runExtractor();
    expect(result.title).toBe('Test Product Title');
  });

  it('extracts price from common Amazon selectors', () => {
    document.body.innerHTML = `
      <span class="a-price a-text-price">
        <span class="a-offscreen">$99.99</span>
      </span>
    `;
    const result = runExtractor();
    expect(result.price).toBe('$99.99');
  });

  it('extracts rating and count', () => {
    document.body.innerHTML = `
      <span id="acrPopover" title="4.5 out of 5 stars">4.5 out of 5 stars</span>
      <span id="acrCustomerReviewText">1,234 ratings</span>
    `;
    const result = runExtractor();
    expect(result.rating).toBe('4.5');
    expect(result.reviews).toBe('1,234');
  });

  it('extracts Amazon AI summary (High Confidence)', () => {
    const summaryText = 'Customers say this product is great and reliable. Generated from the text of customer reviews.';
    document.body.innerHTML = `
      <div data-hook="cr-summarization-attribute">
        ${summaryText}
      </div>
    `;
    const result = runExtractor();
    expect(result.topReviews).toBe('Customers say this product is great and reliable.');
    expect(result.reviewsSource).toContain('High Confidence');
  });

  it('falls back to raw reviews (Low Confidence) if AI summary is missing', () => {
    document.body.innerHTML = `
      <div data-hook="review-body">Great product!</div>
      <div class="review-text">Would buy again.</div>
    `;
    const result = runExtractor();
    expect(result.topReviews).toBe('Great product! | Would buy again.');
    expect(result.reviewsSource).toContain('Low Confidence');
  });
});
