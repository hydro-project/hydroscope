/**
 * @fileoverview Explore the actual DOM structure to understand what's really there
 */

import { test, expect, Page } from '@playwright/test';

test.describe('DOM Structure Exploration', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('http://localhost:3000/hydroscope');
    await page.waitForLoadState('networkidle');
  });

  test('should explore actual DOM structure', async () => {
    console.log('🔍 Exploring DOM structure...');
    
    // Load test data
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('test-data/paxos.json');
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Explore all buttons
    console.log('\n🔍 ALL BUTTONS:');
    const allButtons = await page.locator('button').all();
    for (let i = 0; i < allButtons.length; i++) {
      const button = allButtons[i];
      const text = await button.textContent();
      const isVisible = await button.isVisible();
      const classes = await button.getAttribute('class');
      const id = await button.getAttribute('id');
      const dataTestId = await button.getAttribute('data-testid');
      const title = await button.getAttribute('title');
      const ariaLabel = await button.getAttribute('aria-label');
      
      console.log(`  Button ${i}:`);
      console.log(`    Text: "${text}"`);
      console.log(`    Visible: ${isVisible}`);
      console.log(`    Classes: ${classes}`);
      console.log(`    ID: ${id}`);
      console.log(`    Data-testid: ${dataTestId}`);
      console.log(`    Title: ${title}`);
      console.log(`    Aria-label: ${ariaLabel}`);
      console.log('');
    }

    // Explore all nodes
    console.log('\n🔍 REACT FLOW NODES:');
    const nodes = await page.locator('.react-flow__node').all();
    console.log(`Found ${nodes.length} nodes`);
    
    for (let i = 0; i < Math.min(nodes.length, 10); i++) {
      const node = nodes[i];
      const text = await node.textContent();
      const classes = await node.getAttribute('class');
      const dataId = await node.getAttribute('data-id');
      const dataNodeType = await node.getAttribute('data-nodetype');
      const style = await node.getAttribute('style');
      
      console.log(`  Node ${i}:`);
      console.log(`    Text: "${text?.substring(0, 50)}..."`);
      console.log(`    Classes: ${classes}`);
      console.log(`    Data-id: ${dataId}`);
      console.log(`    Data-nodetype: ${dataNodeType}`);
      console.log(`    Style: ${style?.substring(0, 100)}...`);
      console.log('');
    }

    // Look for container-specific elements
    console.log('\n🔍 CONTAINER ELEMENTS:');
    const containerSelectors = [
      '[data-nodetype="container"]',
      '.container',
      '[class*="container"]',
      '[class*="Container"]',
      '*:has-text("container")',
      '*:has-text("Container")'
    ];

    for (const selector of containerSelectors) {
      try {
        const elements = await page.locator(selector).all();
        console.log(`  Selector "${selector}": ${elements.length} elements`);
        
        if (elements.length > 0 && elements.length < 10) {
          for (let i = 0; i < elements.length; i++) {
            const text = await elements[i].textContent();
            const classes = await elements[i].getAttribute('class');
            console.log(`    Element ${i}: "${text?.substring(0, 30)}..." (${classes})`);
          }
        }
      } catch (error) {
        console.log(`  Selector "${selector}": Error - ${error}`);
      }
    }

    // Look for collapse-related elements
    console.log('\n🔍 COLLAPSE ELEMENTS:');
    const collapseSelectors = [
      '*:has-text("collapse")',
      '*:has-text("Collapse")',
      '*:has-text("expand")',
      '*:has-text("Expand")',
      '[title*="collapse"]',
      '[aria-label*="collapse"]',
      '[data-testid*="collapse"]'
    ];

    for (const selector of collapseSelectors) {
      try {
        const elements = await page.locator(selector).all();
        console.log(`  Selector "${selector}": ${elements.length} elements`);
        
        if (elements.length > 0 && elements.length < 10) {
          for (let i = 0; i < elements.length; i++) {
            const text = await elements[i].textContent();
            const tagName = await elements[i].evaluate(el => el.tagName);
            const isVisible = await elements[i].isVisible();
            console.log(`    Element ${i}: <${tagName}> "${text?.substring(0, 30)}..." (visible: ${isVisible})`);
          }
        }
      } catch (error) {
        console.log(`  Selector "${selector}": Error - ${error}`);
      }
    }

    // Explore the page structure
    console.log('\n🔍 PAGE STRUCTURE:');
    const pageStructure = await page.evaluate(() => {
      const getElementInfo = (element, depth = 0) => {
        if (depth > 3) return '...'; // Limit depth
        
        const info = {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          classes: element.className || null,
          text: element.textContent?.substring(0, 30) || null,
          children: []
        };
        
        // Only include elements with meaningful content
        if (element.children.length > 0 && depth < 3) {
          for (let i = 0; i < Math.min(element.children.length, 5); i++) {
            info.children.push(getElementInfo(element.children[i], depth + 1));
          }
        }
        
        return info;
      };
      
      return getElementInfo(document.body);
    });

    console.log('Page structure:', JSON.stringify(pageStructure, null, 2));

    // Check for any elements with "collapse" or "container" in their text
    console.log('\n🔍 TEXT CONTENT SEARCH:');
    const allElements = await page.locator('*').all();
    const relevantElements = [];
    
    for (let i = 0; i < Math.min(allElements.length, 1000); i++) { // Limit to first 1000 elements
      try {
        const element = allElements[i];
        const text = await element.textContent();
        const tagName = await element.evaluate(el => el.tagName);
        
        if (text && (
          text.toLowerCase().includes('collapse') ||
          text.toLowerCase().includes('container') ||
          text.toLowerCase().includes('expand')
        )) {
          relevantElements.push({
            tag: tagName,
            text: text.substring(0, 50),
            visible: await element.isVisible()
          });
        }
      } catch (error) {
        // Skip elements that can't be accessed
      }
    }

    console.log(`Found ${relevantElements.length} elements with relevant text:`);
    relevantElements.slice(0, 10).forEach((el, i) => {
      console.log(`  ${i + 1}. <${el.tag}> "${el.text}" (visible: ${el.visible})`);
    });

    // Take a screenshot for manual inspection
    await page.screenshot({ 
      path: 'hydroscope/test-results/dom-exploration.png',
      fullPage: true 
    });

    console.log('\n✅ DOM exploration complete. Screenshot saved as dom-exploration.png');
  });
});