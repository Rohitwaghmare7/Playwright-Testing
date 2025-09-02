import { proxyActivities, log, sleep } from '@temporalio/workflow';

const {
  takeScreenshotWithTemplate,
  takeScreenshotWithPlaywright,
  processBatchWithPlaywright,
  getEnabledUsers,
  validateSystemConfig
} = proxyActivities({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '10 seconds',
    maximumInterval: '2 minutes',
    maximumAttempts: 3,
  },
});


export async function multiUserScreenshotWorkflow(config = {}) {
  const {
    runOnce = false,
    intervalMinutes = 1,
    maxParallelUsers = 10,
    usePlaywright = true,
    optimizeBatches = true
  } = config;

  log.info('🎯 Starting multi-user screenshot workflow', {
    runOnce,
    intervalMinutes,
    maxParallelUsers,
    usePlaywright,
    optimizeBatches
  });

  try {
    // Validate system configuration first
    log.info('🔍 Validating system configuration...');
    const systemStats = await validateSystemConfig();
    log.info('📊 System validation passed', {
      enabledUsers: systemStats.credentialStats?.enabled || 0,
      totalTemplates: systemStats.templateStats?.totalLoaded || 0
    });

    let executionCount = 0;
    
    do {
      executionCount++;
      log.info(`🔄 Starting execution cycle ${executionCount}`);
      
      try {
        // Get all enabled users
        const users = await getEnabledUsers();
        
        if (!users || users.length === 0) {
          log.warn('⚠️ No enabled users found, skipping cycle');
        } else {
          log.info(`👥 Processing ${users.length} enabled users`);
          
          // Determine batch size based on user count
          const effectiveBatchSize = calculateOptimalBatchSize(
            users.length, 
            maxParallelUsers, 
            optimizeBatches
          );
          
          // Process users in parallel batches
          await processUsersInBatches(users, effectiveBatchSize, usePlaywright);
        }
      } catch (cycleError) {
        log.error(`❌ Execution cycle ${executionCount} failed`, { error: cycleError.message });
        // Continue to next cycle instead of failing entire workflow
      }
      
      // If not running once, wait for next interval
      if (!runOnce) {
        log.info(`⏰ Waiting ${intervalMinutes} minutes until next cycle...`);
        await sleep(`${intervalMinutes} minutes`);
      }
      
    } while (!runOnce);

    const summary = {
      totalExecutions: executionCount,
      completedAt: new Date().toISOString(),
      mode: runOnce ? 'single-run' : 'continuous'
    };

    log.info('✅ Multi-user workflow completed', summary);
    return summary;

  } catch (error) {
    log.error('❌ Multi-user workflow failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

function calculateOptimalBatchSize(userCount, maxParallel, optimize) {
  if (!optimize) {
    return maxParallel;
  }

  // For large numbers of users, adjust batch size dynamically
  if (userCount > 50) {
    // More users = smaller batches to prevent resource exhaustion
    const optimizedSize = Math.max(5, Math.min(maxParallel, Math.floor(100 / Math.ceil(userCount / 10))));
    log.info(`⚙️ Optimized batch size for ${userCount} users: ${optimizedSize}`);
    return optimizedSize;
  }
  
  return maxParallel;
}

async function processUsersInBatches(users, batchSize, usePlaywright = false) {
  const results = [];
  const totalBatches = Math.ceil(users.length / batchSize);
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    log.info(`🚀 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} users`);
    
    try {
      let batchResults;

      if (usePlaywright && batch.length > 1) {
        // Use optimized batch processing with Playwright
        batchResults = await processBatchWithPlaywrightOptimized(batch);
      } else {
        // Use individual processing
        batchResults = await processUsersIndividually(batch, usePlaywright);
      }
      
      results.push(...batchResults);
      
      // Log batch summary
      const successful = batchResults.filter(r => r.success).length;
      const failed = batchResults.length - successful;
      
      log.info(`📊 Batch ${batchNumber} completed: ${successful} successful, ${failed} failed`);
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < users.length) {
        await sleep('5 seconds');
      }
      
    } catch (batchError) {
      log.error(`❌ Batch ${batchNumber} failed completely`, { error: batchError.message });
      
      // Create failed results for all users in this batch
      const failedResults = batch.map(user => ({
        userId: user.id,
        username: user.username,
        rmsType: user.rmsType,
        success: false,
        error: `Batch processing failed: ${batchError.message}`,
        completedAt: new Date().toISOString()
      }));
      
      results.push(...failedResults);
    }
  }
  
  // Final summary
  const totalSuccessful = results.filter(r => r.success).length;
  const totalFailed = results.length - totalSuccessful;
  
  log.info(`🏁 All batches completed: ${totalSuccessful} successful, ${totalFailed} failed out of ${users.length} total`);
  
  return results;
}

async function processBatchWithPlaywrightOptimized(batch) {
  log.info(`⚡ Using optimized Playwright batch processing for ${batch.length} users`);
  
  const userIds = batch.map(user => user.id);
  const batchResults = await processBatchWithPlaywright(userIds, batch.length);
  
  // Ensure batchResults is an array and has the expected length
  if (!Array.isArray(batchResults) || batchResults.length !== batch.length) {
    throw new Error(`Batch processing returned unexpected results. Expected ${batch.length} results, got ${batchResults?.length || 0}`);
  }
  
  // Format results to match expected structure
  const formattedResults = batchResults.map((result, index) => {
    const user = batch[index];
    if (!user) {
      throw new Error(`Missing user data for batch index ${index}`);
    }
    
    return {
      userId: user.id,
      username: user.username,
      rmsType: user.rmsType,
      success: result?.success !== false,
      result: result,
      error: result?.error,
      duration: result?.duration || 0,
      completedAt: new Date().toISOString()
    };
  });
  
  return formattedResults;
}

/**
 * Process users individually
 */
async function processUsersIndividually(batch, usePlaywright) {
  // Create promises for parallel execution
  const batchPromises = batch.map(async (user) => {
    try {
      log.info(`🔵 Starting workflow for user ${user.id} (RMS Type: ${user.rmsType})`);
      
      const startTime = Date.now();
      const result = usePlaywright ? 
        await takeScreenshotWithPlaywright(user.id) : 
        await takeScreenshotWithTemplate(user.id);
      const duration = Date.now() - startTime;
      
      log.info(`✅ User ${user.id} completed in ${duration}ms`);
      
      return {
        userId: user.id,
        username: user.username,
        rmsType: user.rmsType,
        success: true,
        result,
        duration,
        completedAt: new Date().toISOString()
      };
    
    } catch (error) {
      log.error(`❌ User ${user.id} failed`, { error: error.message });
      
      return {
        userId: user.id,
        username: user.username,
        rmsType: user.rmsType,
        success: false,
        error: error.message,
        completedAt: new Date().toISOString()
      };
    }
  });

  // Wait for all batch promises to complete
  return Promise.all(batchPromises);
}

export async function singleUserWorkflow(userId) {
  log.info(`👤 Starting single user workflow for: ${userId}`);
  
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId provided');
  }
  
  try {
    const result = await takeScreenshotWithTemplate(userId);
    
    log.info(`✅ Single user workflow completed for ${userId}`);
    return {
      userId,
      username: '', // Will be populated by activity if needed
      rmsType: '', // Will be populated by activity if needed
      success: true,
      result,
      completedAt: new Date().toISOString()
    };
    
  } catch (error) {
    log.error(`❌ Single user workflow failed for ${userId}`, { error: error.message });
    throw error;
  }
}

export async function systemValidationWorkflow() {
  log.info('🔍 Running system validation workflow');
  
  try {
    const stats = await validateSystemConfig();
    
    log.info('✅ System validation workflow completed', { stats });
    return {
      validation: 'passed',
      stats,
      completedAt: new Date().toISOString()
    };
    
  } catch (error) {
    log.error('❌ System validation workflow failed', { error: error.message });
    throw error;
  }
}