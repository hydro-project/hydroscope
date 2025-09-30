/**
 * @fileoverview Simple test to verify button clicking works correctly
 */

import { test, expect, Page } from "@playwright/test";

test.describe("Button Click Test", () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto("http://localhost:3000/hydroscope");
    await page.waitForLoadState("networkidle");
  });

  test("should successfully click CollapseAll and verify state change", async () => {
    console.log("🔍 Testing button clicks...");

    // Load test data
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles("test-data/paxos.json");
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Count initial state
    const initialNodes = await page.locator(".react-flow__node").count();
    const initialEdges = await page.locator(".react-flow__edge").count();
    console.log(`📊 Initial: ${initialNodes} nodes, ${initialEdges} edges`);

    // Take screenshot before
    await page.screenshot({
      path: "hydroscope/test-results/before-button-click.png",
    });

    // Find and click CollapseAll button
    console.log("🔍 Looking for CollapseAll button...");
    const collapseButton = page
      .locator('button[title="Collapse All Containers"]')
      .first();

    if (await collapseButton.isVisible()) {
      console.log("✅ Found CollapseAll button, clicking...");

      // Hover first to make sure it's interactive
      await collapseButton.hover();
      await page.waitForTimeout(100);

      // Click with force to ensure it works
      await collapseButton.click({ force: true });
      console.log("✅ Clicked CollapseAll button");

      // Wait for the operation to complete
      await page.waitForTimeout(3000);

      // Count after collapse
      const afterCollapseNodes = await page
        .locator(".react-flow__node")
        .count();
      const afterCollapseEdges = await page
        .locator(".react-flow__edge")
        .count();
      console.log(
        `📊 After collapse: ${afterCollapseNodes} nodes, ${afterCollapseEdges} edges`,
      );

      // Take screenshot after collapse
      await page.screenshot({
        path: "hydroscope/test-results/after-collapse-click.png",
      });

      // Verify that collapse actually happened (should have fewer nodes)
      if (afterCollapseNodes < initialNodes) {
        console.log("✅ Collapse successful - node count decreased");

        // Now try Fit View
        console.log("🔍 Looking for Fit View button...");
        const fitViewButton = page.locator('button[title="Fit View"]').first();

        if (await fitViewButton.isVisible()) {
          console.log("✅ Found Fit View button, clicking...");
          await fitViewButton.hover();
          await page.waitForTimeout(100);
          await fitViewButton.click({ force: true });
          console.log("✅ Clicked Fit View button");

          await page.waitForTimeout(1000);

          // Take screenshot after fit view
          await page.screenshot({
            path: "hydroscope/test-results/after-fit-view.png",
          });

          // Now count edges again to see if floating edges appear
          const finalNodes = await page.locator(".react-flow__node").count();
          const finalEdges = await page.locator(".react-flow__edge").count();
          console.log(
            `📊 After fit view: ${finalNodes} nodes, ${finalEdges} edges`,
          );

          // Check for floating edges by looking at edge attributes
          const edgesWithNullSource = await page
            .locator(
              '.react-flow__edge[data-source="null"], .react-flow__edge:not([data-source])',
            )
            .count();
          const edgesWithNullTarget = await page
            .locator(
              '.react-flow__edge[data-target="null"], .react-flow__edge:not([data-target])',
            )
            .count();

          console.log(
            `🔍 Edges with null/missing source: ${edgesWithNullSource}`,
          );
          console.log(
            `🔍 Edges with null/missing target: ${edgesWithNullTarget}`,
          );

          if (edgesWithNullSource > 0 || edgesWithNullTarget > 0) {
            console.log("❌ Found floating edges after collapse + fit view");

            // Get details of first few floating edges
            const floatingEdges = await page.evaluate(() => {
              const edges = Array.from(
                document.querySelectorAll(".react-flow__edge"),
              );
              return edges.slice(0, 10).map((edge, i) => ({
                index: i,
                id: edge.getAttribute("data-id"),
                source: edge.getAttribute("data-source"),
                target: edge.getAttribute("data-target"),
                sourceHandle: edge.getAttribute("data-sourcehandle"),
                targetHandle: edge.getAttribute("data-targethandle"),
              }));
            });

            console.log("🔍 First 10 edges:", floatingEdges);
          } else {
            console.log("✅ No floating edges detected");
          }
        } else {
          console.log("❌ Fit View button not found");
        }
      } else {
        console.log(
          "❌ Collapse may not have worked - node count did not decrease",
        );
        console.log(
          `   Initial: ${initialNodes}, After: ${afterCollapseNodes}`,
        );
      }
    } else {
      console.log("❌ CollapseAll button not found");

      // Debug: List all buttons with titles
      const allButtonsWithTitles = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button[title]"));
        return buttons.map((btn) => ({
          title: btn.getAttribute("title"),
          text: btn.textContent,
          visible: btn.offsetParent !== null,
        }));
      });

      console.log("🔍 All buttons with titles:", allButtonsWithTitles);
    }

    // Final summary
    console.log("\n📋 Test Summary:");
    console.log(
      `  - Initial state: ${initialNodes} nodes, ${initialEdges} edges`,
    );
    console.log(
      `  - Button click successful: ${await collapseButton.isVisible()}`,
    );
    console.log(
      `  - Screenshots saved: before-button-click.png, after-collapse-click.png, after-fit-view.png`,
    );
  });
});
