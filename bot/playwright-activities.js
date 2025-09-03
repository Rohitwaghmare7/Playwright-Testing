import { Context } from '@temporalio/activity';
import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { CredentialManager } from './credential-manager.js';
import { TemplateManager } from './template-manager.js';

const credentialManager = new CredentialManager();
const templateManager = new TemplateManager();

export async function takeScreenshotWithPlaywright(userId) {
  const logger = Context.current().log;
  logger.info(`🚀 Starting Playwright-based screenshot for user: ${userId}`);

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

    const screenshotsDir = `screenshots/template-${credentials.rmsType}`;
    await fs.ensureDir(screenshotsDir);

    browser = await chromium.launch({
      headless: true, 
    });

    logger.info('🌐 Browser launched successfully with Playwright');

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    const page = await context.newPage();

    logger.info(`⚡ Executing template ${credentials.rmsType} for user ${userId} with Playwright`);
    const result = await template.executor(credentials, page, logger, 'playwright');

    logger.info(`✅ Playwright template execution completed successfully for user ${userId}`);
    return result;

  } catch (error) {
    logger.error(`❌ Playwright screenshot workflow failed for user ${userId}: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      logger.info('🔒 Playwright browser closed successfully');
    }
  }
}


export async function processBatchWithPlaywright(userIds, concurrencyLimit = 5) {
  const logger = Context.current().log;
  logger.info(`🚀 Starting batch processing for ${userIds.length} users with concurrency limit ${concurrencyLimit}`);

  const results = [];
  const batches = [];
  
  for (let i = 0; i < userIds.length; i += concurrencyLimit) {
    batches.push(userIds.slice(i, i + concurrencyLimit));
  }
  
  logger.info(`📊 Created ${batches.length} batches for processing`);
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    logger.info(`⚡ Processing batch ${batchIndex + 1} of ${batches.length}`);
    
    const batchPromises = batch.map(async (userId) => {
      try {
        return await takeScreenshotWithPlaywright(userId);
      } catch (error) {
        logger.error(`❌ Failed processing user ${userId}: ${error.message}`);
        return {
          userId,
          success: false,
          error: error.message
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    

    const successful = batchResults.filter(r => r.success !== false).length;
    const failed = batchResults.filter(r => r.success === false).length;
    
    logger.info(`✅ Batch ${batchIndex + 1} completed: ${successful} successful, ${failed} failed`);
  }
  
  return results;
}