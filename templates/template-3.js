export const template3Config = {
  name: 'CRM & Customer Management Template',
  rmsType: 3,
  urls: [
    'https://www.stackoverflow.com',
    'https://httpbin.org/json'
  ],
  waitTime: 3000,
  loginRequired: false
};

export async function executeTemplate3(credentials, page, logger) {
  logger.info(`🟡 Template 3: Starting for user ${credentials.username}`);
  
  try {
    const screenshots = [];
    for (const url of template3Config.urls) {
      logger.info(`💼 Template 3: Processing ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Use setTimeout instead of page.waitForTimeout
      await new Promise(resolve => setTimeout(resolve, template3Config.waitTime));
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const urlPart = url.split('/').pop() || url.replace(/https?:\/\//g, '').replace(/\./g, '-');
      const filename = `template3_${credentials.id}_${timestamp}_${urlPart}.png`;
      const screenshotPath = `screenshots/template-3/${filename}`;
      
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
      
      logger.info(`✅ Template 3: Screenshot saved - ${screenshotPath}`);
    }
    
    return {
      template: 'template-3',
      user: credentials.id,
      screenshots,
      success: true,
      completedAt: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`❌ Template 3 failed: ${error.message}`);
    throw error;
  }
}