import { proxyActivities, log, sleep } from '@temporalio/workflow';

const {
  takeScreenshotWithTemplate,
  takeScreenshotWithPlaywright,
  validateSystemConfig
} = proxyActivities({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '10 seconds',
    maximumInterval: '2 minutes',
    maximumAttempts: 3,
  },
});


export async function userScreenshotWorkflow(config = {}) {
  const {
    userId,
    runMode = 'continuous', // 'continuous', 'once', or 'exit'
    intervalMinutes = 1,
    usePlaywright = true
  } = config;

  if (!userId) {
    throw new Error('userId is required for user workflow');
  }

  log.info(`👤 Starting user workflow for: ${userId}`, {
    runMode,
    intervalMinutes,
    usePlaywright
  });

  try {
    let executionCount = 0;
    let shouldContinue = true;
    
    while (shouldContinue) {
      executionCount++;
      log.info(`🔄 Starting execution cycle ${executionCount} for user ${userId}`);
      
      try {
        // Take screenshots based on the configured engine
        const startTime = Date.now();
        const result = usePlaywright ? 
          await takeScreenshotWithPlaywright(userId) : 
          await takeScreenshotWithTemplate(userId);
        const duration = Date.now() - startTime;
        
        log.info(`✅ Execution cycle ${executionCount} completed for user ${userId} in ${duration}ms`);
        
        // Determine if we should continue based on run mode
        if (runMode === 'once') {
          log.info(`👋 One-time execution completed for user ${userId}, exiting workflow`);
          shouldContinue = false;
        } else if (runMode === 'exit') {
          log.info(`👋 Exit mode specified for user ${userId}, exiting workflow after first execution`);
          shouldContinue = false;
        } else {
          // Default is continuous mode
          log.info(`⏰ Waiting ${intervalMinutes} minutes until next execution for user ${userId}...`);
          await sleep(`${intervalMinutes} minutes`);
        }
        
      } catch (cycleError) {
        log.error(`❌ Execution cycle ${executionCount} failed for user ${userId}`, { error: cycleError.message });
        
        // For errors, we still continue in continuous mode, but add a small delay
        if (runMode !== 'continuous') {
          shouldContinue = false;
        } else {
          log.info(`⏰ Waiting 30 seconds before retry after error for user ${userId}...`);
          await sleep('30 seconds');
        }
      }
    }

    const summary = {
      userId,
      totalExecutions: executionCount,
      completedAt: new Date().toISOString(),
      mode: runMode
    };

    log.info(`✅ User workflow completed for ${userId}`, summary);
    return summary;

  } catch (error) {
    log.error(`❌ User workflow failed for ${userId}`, { error: error.message, stack: error.stack });
    throw error;
  }
}