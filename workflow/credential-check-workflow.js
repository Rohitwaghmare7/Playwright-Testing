import { proxyActivities, log, sleep, startChild, CancellationScope } from '@temporalio/workflow';

const {
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


export async function credentialCheckWorkflow(config = {}) {
  const {
    checkIntervalMinutes = 1,
    maxParallelWorkflows = 10,
  } = config;

  log.info('🔍 Starting credential check workflow', {
    checkIntervalMinutes,
    maxParallelWorkflows
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
    const activeWorkflows = new Map(); // Track active workflows by user ID with their handles and configurations
    
    while (true) {
      executionCount++;
      log.info(`🔄 Starting credential check cycle ${executionCount}`);
      
      try {
        // Get all enabled users
        const users = await getEnabledUsers();
        
        if (!users || users.length === 0) {
          log.warn('⚠️ No enabled users found, skipping cycle');
        } else {
          log.info(`👥 Found ${users.length} enabled users`);
          log.info(`📊 Current active workflows: ${activeWorkflows.size}`);
          
          // Process each user and manage their workflows
          // This will only create new workflows if needed (user config changed or workflow ended)
          await manageUserWorkflows(users, activeWorkflows, maxParallelWorkflows);
        }
      } catch (cycleError) {
        log.error(`❌ Credential check cycle ${executionCount} failed`, { error: cycleError.message });
      }
      
      log.info(`⏰ Waiting ${checkIntervalMinutes} minutes until next credential check...`);
      await sleep(`${checkIntervalMinutes} minutes`);
    }

  } catch (error) {
    log.error('❌ Credential check workflow failed', { error: error.message, stack: error.stack });
    throw error;
  }
}


async function manageUserWorkflows(users, activeWorkflows, maxParallelWorkflows) {
  // First, check for users that are no longer enabled and cancel their workflows
  const currentUserIds = new Set(users.map(user => user.id));
  
  for (const [userId, workflowInfo] of activeWorkflows.entries()) {
    if (!currentUserIds.has(userId)) {
      log.info(`👤 User ${userId} is no longer enabled, cancelling workflow`);
      try {
        // Cancel the workflow if it exists
        if (workflowInfo.handle && workflowInfo.handle.cancel) {
          await workflowInfo.handle.cancel();
        }
        activeWorkflows.delete(userId);
      } catch (error) {
        log.warn(`⚠️ Failed to cancel workflow for user ${userId}`, { error: error.message });
      }
    }
  }
  
  // Now process enabled users
  for (const user of users) {
    const userId = user.id;
    const workflowInfo = activeWorkflows.get(userId);
    
    // Skip if we've reached max parallel workflows
    if (activeWorkflows.size >= maxParallelWorkflows && !workflowInfo) {
      log.warn(`⚠️ Maximum parallel workflows (${maxParallelWorkflows}) reached, skipping user ${userId}`);
      continue;
    }
    
    // Check if workflow already exists for this user
    if (workflowInfo) {
      try {
        // Check if workflow is still running
        const status = await workflowInfo.handle.describe();
        
        // Log detailed workflow status information
        log.info(`👤 Workflow status for user ${userId}:`, {
          workflowId: workflowInfo.workflowId,
          status: status.status.name,
          startTime: new Date(workflowInfo.startedAt).toISOString(),
          runningTime: `${Math.floor((Date.now() - workflowInfo.startedAt) / 1000 / 60)} minutes`
        });
        
        if (status.status.name === 'COMPLETED' || status.status.name === 'FAILED' || status.status.name === 'CANCELED') {
          log.info(`👤 Workflow for user ${userId} has ended with status: ${status.status.name}`);
          activeWorkflows.delete(userId);
          // Will start a new workflow below
        } else {
          log.info(`👤 Workflow for user ${userId} is still running with status: ${status.status.name}`);
          
          // Check if user config has changed and needs update
          const currentConfig = {
            runMode: user.runMode || 'continuous',
            intervalMinutes: user.intervalMinutes || 1,
            usePlaywright: user.usePlaywright !== undefined ? user.usePlaywright : true
          };
          
          const storedConfig = workflowInfo.config || {};
          
          // Only restart workflow if configuration has changed
          if (JSON.stringify(currentConfig) !== JSON.stringify(storedConfig)) {
            log.info(`🔄 Configuration changed for user ${userId}, restarting workflow`);
            try {
              await workflowInfo.handle.cancel();
              activeWorkflows.delete(userId);
              // Will start a new workflow below with updated config
            } catch (cancelError) {
              log.warn(`⚠️ Failed to cancel workflow for user ${userId} during config update`, { error: cancelError.message });
              continue; // Skip to next user if we can't cancel
            }
          } else {
            log.info(`👤 Skipping user ${userId} as workflow is already running with same configuration`);
            continue; // Skip to next user if workflow is running and config hasn't changed
          }
        }
      } catch (error) {
        if (error.message && error.message.includes('not found')) {
          log.info(`👤 Workflow for user ${userId} no longer exists (ID: ${workflowInfo?.workflowId || 'unknown'}), will start a new one`);
          activeWorkflows.delete(userId);
          // Will start a new workflow below
        } else {
          log.warn(`⚠️ Failed to check workflow status for user ${userId}`, { 
            error: error.message,
            workflowId: workflowInfo?.workflowId || 'unknown'
          });
          
          log.info(`👤 Skipping user ${userId} due to workflow status check error - preventing potential duplicate workflow`);
          continue;
        }
      }
    }
    
    // Start a new workflow for this user
    try {
      // Determine workflow execution mode based on user configuration
      const userConfig = {
        userId: userId,
        runMode: user.runMode || 'continuous', // 'continuous', 'once', or 'exit'
        intervalMinutes: user.intervalMinutes || 1,
        usePlaywright: user.usePlaywright !== undefined ? user.usePlaywright : true
      };
      
      // Generate a unique workflow ID for this user
      const childWorkflowId = `user-workflow-${userId}-${Date.now()}`;
      
      log.info(`🚀 Starting NEW workflow for user ${userId} with ID: ${childWorkflowId}`);
      
      // Add additional logging to track workflow creation
      log.info(`📊 Current active workflows count: ${activeWorkflows.size}/${maxParallelWorkflows}`);
      log.info(`📝 User ${userId} configuration: ${JSON.stringify(userConfig)}`);
      log.info(`⚠️ Creating new workflow because: ${workflowInfo ? 'Previous workflow ended or config changed' : 'No existing workflow found'}`);
      
      // Start the child workflow
      const handle = await startChild('userScreenshotWorkflow', {
        workflowId: childWorkflowId,
        args: [userConfig],
        parentClosePolicy: 'PARENT_CLOSE_POLICY_ABANDON',
      });
      
      // Store the workflow handle and configuration for future reference
      activeWorkflows.set(userId, {
        handle,
        startedAt: Date.now(),
        workflowId: childWorkflowId,
        config: {
          runMode: user.runMode || 'continuous',
          intervalMinutes: user.intervalMinutes || 1,
          usePlaywright: user.usePlaywright !== undefined ? user.usePlaywright : true
        }
      });
      
      log.info(`✅ Started workflow for user ${userId} with ID: ${childWorkflowId}`);
      
    } catch (error) {
      log.error(`❌ Failed to start workflow for user ${userId}`, { error: error.message });
    }
  }
  
  log.info(`📊 Currently managing ${activeWorkflows.size} active user workflows`);
  return activeWorkflows.size;
}