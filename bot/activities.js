import { Context } from '@temporalio/activity';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { URL } from 'url';

export async function takeScreenshotActivity(url = 'https://www.google.com') {
  const logger = Context.current().log;
  
  logger.info(`Raw URL parameter received: ${JSON.stringify(url)}, type: ${typeof url}`);
  
  let validUrl;
  try {
    if (Array.isArray(url)) {
      validUrl = url[0] || 'https://www.google.com';
    } else if (typeof url === 'object' && url !== null && url.url) {
      validUrl = url.url;
    } else if (typeof url === 'string') {
      validUrl = url;
    } else {
      validUrl = 'https://www.google.com';
    }
    
    if (validUrl && !validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = `https://${validUrl}`;
    }
    
    new URL(validUrl);
    
    logger.info(`Processed and validated URL: ${validUrl}`);
    
  } catch (urlError) {
    logger.error(`URL processing error: ${urlError.message}, using fallback`);
    validUrl = 'https://www.google.com';
    logger.info(`Using fallback URL: ${validUrl}`);
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    logger.info('Browser opened successfully');

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    logger.info(`About to navigate to: ${validUrl}`);

    await page.goto(validUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    logger.info(`Successfully navigated to: ${validUrl}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.info('Page rendering wait completed');

    await fs.ensureDir('screenshots');

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('.')[0]; 
    const screenshotPath = path.join('screenshots', `screenshot_${timestamp}.png`);

    logger.info(`Taking screenshot, saving to: ${screenshotPath}`);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    logger.info(`Screenshot saved successfully to: ${screenshotPath}`);
  
    const absolutePath = path.resolve(screenshotPath);
    logger.info(`Absolute path: ${absolutePath}`);
    
    return screenshotPath;

  } catch (error) {
    logger.error(`Error taking screenshot: ${error.message}`);
    logger.error(`Error name: ${error.name}`);
    if (error.stack) {
      logger.error(`Error stack: ${error.stack}`);
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      logger.info('Browser closed successfully');
    }
  }
}
