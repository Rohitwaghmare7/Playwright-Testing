export const templatePlaywrightConfig = {
  name: 'Playwright Enhanced Template',
  rmsType: 5, // Assign a new RMS type for Playwright templates
  urls: [
    'https://www.google.com',
    'https://www.github.com',
    'https://www.example.com'
  ],
  waitTime: 2000,
  loginRequired: false,
  // Playwright-specific configurations
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false
};

export async function executeTemplatePlaywright(credentials, page, logger, engine = 'playwright') {
  logger.info(`🔵 Playwright Template: Starting for user ${credentials.username}`);
  
  try {
    const screenshots = [];
    
    for (const url of templatePlaywrightConfig.urls) {
      logger.info(`📷 Playwright Template: Taking screenshot of ${url}`);
      
      // Navigate to URL with Playwright's advanced options
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Wait specified time
      await page.waitForTimeout(templatePlaywrightConfig.waitTime);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const urlPart = url.split('/').pop() || url.replace(/https?:/\//g, '').replace(/\./g, '-');
      const filename = `playwright_${credentials.id}_${timestamp}_${urlPart}.png`;
      const screenshotPath = `screenshots/template-5/${filename}`;
      
      // Take screenshot with Playwright
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });
      
      // Demonstrate Playwright's advanced capabilities
      // 1. Element screenshot
      try {
        const elementSelector = 'header, nav, .header, .navbar';
        const headerElement = await page.$(elementSelector);
        
        if (headerElement) {
          const headerFilename = `playwright_${credentials.id}_${timestamp}_${urlPart}_header.png`;
          const headerPath = `screenshots/template-5/${headerFilename}`;
          
          await headerElement.screenshot({
            path: headerPath,
            type: 'png'
          });
          
          screenshots.push({
            url,
            path: headerPath,
            type: 'element',
            element: 'header',
            timestamp: new Date().toISOString()
          });
          
          logger.info(`✅ Playwright Template: Element screenshot saved - ${headerPath}`);
        }
      } catch (elementError) {
        logger.warn(`⚠️ Could not take element screenshot: ${elementError.message}`);
      }
      
      // 2. Mobile viewport simulation (if specified)
      if (templatePlaywrightConfig.simulateMobile) {
        await page.setViewportSize({ width: 375, height: 812 });
        
        const mobileFilename = `playwright_${credentials.id}_${timestamp}_${urlPart}_mobile.png`;
        const mobilePath = `screenshots/template-5/${mobileFilename}`;
        
        await page.screenshot({
          path: mobilePath,
          fullPage: true,
          type: 'png'
        });
        
        // Reset viewport
        await page.setViewportSize(templatePlaywrightConfig.viewport);
        
        screenshots.push({
          url,
          path: mobilePath,
          type: 'mobile',
          timestamp: new Date().toISOString()
        });
        
        logger.info(`✅ Playwright Template: Mobile screenshot saved - ${mobilePath}`);
      }
      
      // Add main screenshot to results
      screenshots.push({
        url,
        path: screenshotPath,
        type: 'fullpage',
        timestamp: new Date().toISOString()
      });
      
      logger.info(`✅ Playwright Template: Screenshot saved - ${screenshotPath}`);
    }
    
    return {
      template: 'template-playwright',
      user: credentials.id,
      screenshots,
      success: true,
      completedAt: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`❌ Playwright Template failed: ${error.message}`);
    throw error;
  }
}