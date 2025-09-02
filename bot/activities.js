import { Context } from '@temporalio/activity';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { CredentialManager } from './credential-manager.js';
import { TemplateManager } from './template-manager.js';

const credentialManager = new CredentialManager();
const templateManager = new TemplateManager();

export async function takeScreenshotWithTemplate(userId) {
  const logger = Context.current().log;
  logger.info(`🚀 Starting template-based screenshot for user: ${userId}`);

  let browser = null;

  try {
    const credentials = await credentialManager.getUserById(userId);
    if (!credentials) {
      throw new Error(`User not found: ${userId}`);
    }

    logger.info(`👤 Processing user: ${credentials.username} (RMS Type: ${credentials.rmsType})`);

    const template = await templateManager.getTemplate(credentials.rmsType);
    if (!template) {
      throw new Error(`No template found for RMS type: ${credentials.rmsType}`);
    }

    logger.info(`📄 Using template: ${template.config.name}`);

    // Ensure screenshots directory exists
    const screenshotsDir = `screenshots/template-${credentials.rmsType}`;
    await fs.ensureDir(screenshotsDir);

    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    logger.info('🌐 Browser launched successfully');

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    logger.info(`⚡ Executing template ${credentials.rmsType} for user ${userId}`);
    const result = await template.executor(credentials, page, logger);

    logger.info(`✅ Template execution completed successfully for user ${userId}`);
    return result;

  } catch (error) {
    logger.error(`❌ Screenshot workflow failed for user ${userId}: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      logger.info('🔒 Browser closed successfully');
    }
  }
}

export async function getEnabledUsers() {
  const logger = Context.current().log;
  
  try {
    const users = await credentialManager.getEnabledUsers();
    logger.info(`📋 Retrieved ${users.length} enabled users`);
    
    return users.map(user => ({
      id: user.id,
      username: user.username,
      rmsType: user.rmsType,
      metadata: user.metadata
    }));
  } catch (error) {
    logger.error(`❌ Failed to get enabled users: ${error.message}`);
    throw error;
  }
}

export async function validateSystemConfig() {
  const logger = Context.current().log;
  
  try {
    await credentialManager.validateCredentials();
    
    const templates = await templateManager.loadAllTemplates();
    const enabledUsers = await credentialManager.getEnabledUsers();
    const requiredRmsTypes = [...new Set(enabledUsers.map(u => u.rmsType))];
    const availableTemplates = Object.keys(templates).map(k => parseInt(k));
    
    const missingTemplates = requiredRmsTypes.filter(type => !availableTemplates.includes(type));
    
    if (missingTemplates.length > 0) {
      throw new Error(`Missing templates for RMS types: ${missingTemplates.join(', ')}`);
    }

    const stats = {
      credentialStats: await credentialManager.getStats(),
      templateStats: templateManager.getStats(),
      validation: 'passed'
    };

    logger.info('✅ System configuration validation passed');
    logger.info(`📊 Stats: ${JSON.stringify(stats, null, 2)}`);
    
    return stats;
    
  } catch (error) {
    logger.error(`❌ System validation failed: ${error.message}`);
    throw error;
  }
}

export async function takeScreenshotActivity(url = 'https://www.google.com') {
  const logger = Context.current().log;
  
  logger.info(`📸 Legacy screenshot activity for URL: ${url}`);
  
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
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await fs.ensureDir('screenshots');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const screenshotPath = path.join('screenshots', `legacy_screenshot_${timestamp}.png`);
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    logger.info(`📸 Legacy screenshot saved: ${screenshotPath}`);
    return screenshotPath;

  } catch (error) {
    logger.error(`❌ Legacy screenshot failed: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}