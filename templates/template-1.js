
export const template1Config = {
  name: 'Basic Dashboard Template',
  rmsType: 1,
  urls: [
    'https://www.google.com',
    'https://www.github.com'
  ],
  waitTime: 2000,
  loginRequired: false
};

export async function executeTemplate1(credentials, page, logger) {
  logger.info(`🔵 Template 1: Starting for user ${credentials.username}`);
  
  try {
    const screenshots = [];
    for (const url of template1Config.urls) {
      logger.info(`📷 Template 1: Taking screenshot of ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Use setTimeout instead of page.waitForTimeout
      await new Promise(resolve => setTimeout(resolve, template1Config.waitTime));
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const urlPart = url.split('/').pop() || url.replace(/https?:\/\//g, '').replace(/\./g, '-');
      const filename = `template1_${credentials.id}_${timestamp}_${urlPart}.png`;
      const screenshotPath = `screenshots/template-1/${filename}`;
      
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
      
      logger.info(`✅ Template 1: Screenshot saved - ${screenshotPath}`);
    }
    
    return {
      template: 'template-1',
      user: credentials.id,
      screenshots,
      success: true,
      completedAt: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`❌ Template 1 failed: ${error.message}`);
    throw error;
  }
}