import { proxyActivities, log } from '@temporalio/workflow';

const { takeScreenshotActivity } = proxyActivities({
  startToCloseTimeout: '3 minutes',
  retry: {
    initialInterval: '1 second',
    maximumInterval: '30 seconds',
    maximumAttempts: 3,
  },
});

export async function screenshotWorkflow(url = 'https://www.google.com') {
  log.info(`Raw workflow parameter received: ${JSON.stringify(url)}, type: ${typeof url}`);
  
  let validUrl;
  if (Array.isArray(url)) {
    validUrl = url[0] || 'https://www.google.com';
  } else if (typeof url === 'object' && url !== null && url.url) {
    validUrl = url.url;
  } else if (typeof url === 'string') {
    validUrl = url;
  } else {
    validUrl = 'https://www.google.com';
  }
  
  log.info(`Starting screenshot workflow for processed URL: ${validUrl}`);

  try {
    // Execute the screenshot activity
    const screenshotPath = await takeScreenshotActivity(validUrl);
    
    log.info(`Screenshot workflow completed. File saved: ${screenshotPath}`);
    return {
      success: true,
      screenshotPath,
      url: validUrl,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    log.error(`Screenshot workflow failed: ${error.message}`);
    throw error;
  }
}
