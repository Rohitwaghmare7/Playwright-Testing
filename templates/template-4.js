export const template4Config = {
  name: 'Financial Reports Template',
  rmsType: 4,
  urls: [
    'https://www.example.com',
    'https://httpbin.org/robots.txt'
  ],
  waitTime: 2000,
  loginRequired: false
};

export async function executeTemplate4(credentials, page, logger) {
  logger.info(`🟣 Template 4: Starting for user ${credentials.username}`);
  
  try {
    const screenshots = [];
    for (const url of template4Config.urls) {
      logger.info(`💰 Template 4: Processing ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Use setTimeout instead of page.waitForTimeout
      await new Promise(resolve => setTimeout(resolve, template4Config.waitTime));
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const urlPart = url.split('/').pop() || url.replace(/https?:\/\//g, '').replace(/\./g, '-');
      const filename = `template4_${credentials.id}_${timestamp}_${urlPart}.png`;
      const screenshotPath = `screenshots/template-4/${filename}`;
      
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });
      
      screenshots.push({
        url,
        path: screenshotPath,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`✅ Template 4: Screenshot saved - ${screenshotPath}`);
    }
    
    return {
      template: 'template-4',
      user: credentials.id,
      screenshots,
      success: true,
      completedAt: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`❌ Template 4 failed: ${error.message}`);
    throw error;
  }
}