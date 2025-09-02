export const template2Config = {
  name: 'Analytics & Reports Template',
  rmsType: 2,
  urls: [
    'https://www.wikipedia.org',
    'https://httpbin.org/html'
  ],
  waitTime: 2000,
  loginRequired: false
};

export async function executeTemplate2(credentials, page, logger) {
  logger.info(`🟢 Template 2: Starting for user ${credentials.username}`);
  
  try {
    const screenshots = [];
    for (const url of template2Config.urls) {
      logger.info(`📊 Template 2: Processing page ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Use setTimeout instead of page.waitForTimeout
      await new Promise(resolve => setTimeout(resolve, template2Config.waitTime));
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const urlPart = url.split('/').pop() || url.replace(/https?:\/\//g, '').replace(/\./g, '-');
      const filename = `template2_${credentials.id}_${timestamp}_${urlPart}.png`;
      const screenshotPath = `screenshots/template-2/${filename}`;
      
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });
      
      screenshots.push({
        url,
        path: screenshotPath,
        timestamp: new Date().toISOString(),
        dataLoaded: true
      });
      
      logger.info(`✅ Template 2: Screenshot saved - ${screenshotPath}`);
    }
    
    return {
      template: 'template-2',
      user: credentials.id,
      screenshots,
      success: true,
      completedAt: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`❌ Template 2 failed: ${error.message}`);
    throw error;
  }
}