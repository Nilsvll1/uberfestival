/**
 * isListingPage(html)
 *
 * Returns true if the page is a directory/listing page that links to many
 * individual items — i.e. not a specific single opportunity.
 *
 * Strategy:
 *   Strip all navigation chrome (semantic HTML5 nav/header/footer + common
 *   CMS navigation patterns like WordPress li.menu-item, Bootstrap nav-item,
 *   breadcrumbs, sidebars). Then count list links left in the content area.
 *   More than 25 remaining list links → listing page.
 *
 * Why not just count all ul/ol links?
 *   Sites like Artist Communities Alliance use heavy WordPress navigation
 *   in <li class="menu-item"> elements (41 links) that are NOT inside
 *   <nav>, <header>, or <footer>. Without stripping those, both the listing
 *   page and the individual opportunity page look identical (63 links each).
 *   After stripping, the individual page drops to ~19; the listing page keeps
 *   all its content cards on top.
 */

import * as cheerio from "cheerio";

const STRIP_SELECTORS = [
  "nav",
  "header",
  "footer",
  "aside",
  '[role="navigation"]',
  '[class*="menu-item"]',   // WordPress: li.menu-item
  '[class*="nav-item"]',    // Bootstrap / Drupal nav items
  '[class*="breadcrumb"]',  // Breadcrumbs (all CMS flavours)
  '[class*="sidebar"]',     // Generic sidebars
  '[id*="sidebar"]',
  '[id*="navigation"]',
].join(", ");

export function isListingPage(html) {
  const $ = cheerio.load(html);
  $(STRIP_SELECTORS).remove();
  return $("ul a, ol a").length > 25;
}
