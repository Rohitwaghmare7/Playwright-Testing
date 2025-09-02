import { Connection, Client } from '@temporalio/client';
import { multiUserScreenshotWorkflow, singleUserWorkflow, systemValidationWorkflow } from './workflow/multi-user-workflow.js';
import { credentialCheckWorkflow } from './workflow/credential-check-workflow.js';
import { userScreenshotWorkflow } from './workflow/user-workflow.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class BotScheduler {
  constructor() {
    this.client = null;
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await Connection.connect({
        address: '3.128.198.251:7233'
      });
      
      this.client = new Client({ connection: this.connection });
      console.log('✅ Connected to Temporal server');
      
    } catch (error) {
      console.error('❌ Failed to connect to Temporal:', error.message);
      throw error;
    }
  }

  async startMultiUserWorkflow(config = {}) {
    const workflowId = `multi-user-bot-${Date.now()}`;
    
    // Set default configuration with Playwright optimization
    const defaultConfig = {
      runOnce: config.runOnce || false,
      intervalMinutes: config.intervalMinutes || 1,
      maxParallelUsers: config.maxParallelUsers || 10,
      usePlaywright: config.usePlaywright !== undefined ? config.usePlaywright : true,
      optimizeBatches: config.optimizeBatches !== undefined ? config.optimizeBatches : true
    };
    
    console.log('🚀 Starting multi-user screenshot bot workflow...');
    console.log(`📋 Configuration:`, JSON.stringify(defaultConfig, null, 2));
    
    try {
      const handle = await this.client.workflow.start(multiUserScreenshotWorkflow, {
        args: [defaultConfig],
        taskQueue: 'screenshot-task-queue',
        workflowId,
      });

      console.log(`📋 Multi-user workflow started with ID: ${handle.workflowId}`);
      console.log(`🌐 Monitor at: http://3.128.198.251:8080/namespaces/default/workflows/${handle.workflowId}`);
      
      if (config.runOnce) {
        console.log('⏳ Waiting for single execution to complete...');
        const result = await handle.result();
        console.log('✅ Multi-user workflow completed:', JSON.stringify(result, null, 2));
      } else {
        console.log('🔄 Continuous workflow started. Use Ctrl+C to stop or terminate via Temporal UI.');
        console.log(`📊 Check interval: ${config.intervalMinutes || 1} minutes`);
      }

      return handle;
      
    } catch (error) {
      console.error('❌ Multi-user workflow failed:', error.message);
      throw error;
    }
  }

  async startSingleUserWorkflow(userId) {
    const workflowId = `single-user-bot-${userId}-${Date.now()}`;
    
    console.log(`👤 Starting single user workflow for: ${userId}`);
    
    try {
      const handle = await this.client.workflow.start(singleUserWorkflow, {
        args: [userId],
        taskQueue: 'screenshot-task-queue',
        workflowId,
      });

      console.log(`📋 Single user workflow started: ${handle.workflowId}`);
      console.log('⏳ Waiting for completion...');
      
      const result = await handle.result();
      console.log('✅ Single user workflow completed:', JSON.stringify(result, null, 2));
      
      return result;
      
    } catch (error) {
      console.error(`❌ Single user workflow failed for ${userId}:`, error.message);
      throw error;
    }
  }

  async validateSystem() {
    const workflowId = `system-validation-${Date.now()}`;
    
    console.log('🔍 Running system validation...');
    
    try {
      const handle = await this.client.workflow.start(systemValidationWorkflow, {
        args: [],
        taskQueue: 'screenshot-task-queue',
        workflowId,
      });

      const result = await handle.result();
      
      console.log('✅ System validation completed:');
      console.log(`📊 Users: ${result.stats.credentialStats.enabled} enabled, ${result.stats.credentialStats.disabled} disabled`);
      console.log(`📄 Templates: ${result.stats.templateStats.totalLoaded} loaded`);
      console.log(`🎯 RMS Types: ${result.stats.templateStats.availableTypes.join(', ')}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ System validation failed:', error.message);
      throw error;
    }
  }

  async startCredentialCheckWorkflow(config = {}) {
    const workflowId = `credential-check-${Date.now()}`;
    
    // Set default configuration
    const defaultConfig = {
      checkIntervalMinutes: config.checkIntervalMinutes || 1,
      maxParallelWorkflows: config.maxParallelWorkflows || 10
    };
    
    console.log('🔍 Starting credential check workflow...');
    console.log(`📋 Configuration:`, JSON.stringify(defaultConfig, null, 2));
    
    try {
      const handle = await this.client.workflow.start(credentialCheckWorkflow, {
        args: [defaultConfig],
        taskQueue: 'screenshot-task-queue',
        workflowId,
      });

      console.log(`📋 Credential check workflow started with ID: ${handle.workflowId}`);
      console.log(`🌐 Monitor at: http://3.128.198.251:8080/namespaces/default/workflows/${handle.workflowId}`);
      console.log('🔄 Continuous workflow started. Use Ctrl+C to stop or terminate via Temporal UI.');
      console.log(`📊 Check interval: ${defaultConfig.checkIntervalMinutes} minutes`);

      return handle;
      
    } catch (error) {
      console.error('❌ Credential check workflow failed:', error.message);
      throw error;
    }
  }

  async startUserWorkflow(userId, config = {}) {
    const workflowId = `user-workflow-${userId}-${Date.now()}`;
    
    // Set default configuration
    const userConfig = {
      userId,
      runMode: config.runMode || 'continuous',
      intervalMinutes: config.intervalMinutes || 1,
      usePlaywright: config.usePlaywright !== undefined ? config.usePlaywright : true
    };
    
    console.log(`👤 Starting user workflow for: ${userId}`);
    console.log(`📋 Configuration:`, JSON.stringify(userConfig, null, 2));
    
    try {
      const handle = await this.client.workflow.start(userScreenshotWorkflow, {
        args: [userConfig],
        taskQueue: 'screenshot-task-queue',
        workflowId,
      });

      console.log(`📋 User workflow started with ID: ${handle.workflowId}`);
      console.log(`🌐 Monitor at: http://3.128.198.251:8080/namespaces/default/workflows/${handle.workflowId}`);
      
      if (userConfig.runMode === 'continuous') {
        console.log('🔄 Continuous workflow started. Use Ctrl+C to stop or terminate via Temporal UI.');
        console.log(`📊 Check interval: ${userConfig.intervalMinutes} minutes`);
        return handle;
      } else {
        console.log('⏳ Waiting for completion...');
        const result = await handle.result();
        console.log('✅ User workflow completed:', JSON.stringify(result, null, 2));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ User workflow failed for ${userId}:`, error.message);
      throw error;
    }
  }

  async showMenu() {
    console.log('\n🤖 Multi-User Bot Scheduler');
    console.log('===========================');
    console.log('1. 🔍 Start credential check workflow (spawns user workflows)');
    console.log('2. 🔄 Start continuous multi-user workflow (legacy)');
    console.log('3. ⚡ Run single execution for all users');
    console.log('4. 👤 Run workflow for specific user');
    console.log('5. 🔍 Validate system configuration');
    console.log('6. ⚙️ Custom configuration');
    console.log('7. ❌ Exit');
    console.log('===========================');

    return new Promise((resolve) => {
      rl.question('Choose an option (1-6): ', (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async getCustomConfig() {
    console.log('\n⚙️ Custom Configuration');
    console.log('========================');
    
    const intervalMinutes = await new Promise((resolve) => {
      rl.question('Check interval in minutes (default: 1): ', (answer) => {
        const value = parseInt(answer.trim()) || 1;
        resolve(value);
      });
    });

    const maxParallelUsers = await new Promise((resolve) => {
      rl.question('Max parallel users (default: 10): ', (answer) => {
        const value = parseInt(answer.trim()) || 10;
        resolve(value);
      });
    });

    const runOnce = await new Promise((resolve) => {
      rl.question('Run only once? (y/n, default: n): ', (answer) => {
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });

    return { intervalMinutes, maxParallelUsers, runOnce };
  }

  async getUserId() {
    return new Promise((resolve) => {
      rl.question('Enter user ID: ', (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async run() {
    try {
      await this.connect();
      
      let running = true;
      
      while (running) {
        const choice = await this.showMenu();
        
        switch (choice) {
          case '1':
            await this.startCredentialCheckWorkflow();
            running = false; // Exit after starting continuous workflow
            break;
            
          case '2':
            await this.startMultiUserWorkflow();
            running = false; // Exit after starting continuous workflow
            break;
            
          case '3':
            await this.startMultiUserWorkflow({ runOnce: true });
            break;
            
          case '4':
            const userId = await this.getUserId();
            if (userId) {
              const runMode = await this.promptForRunMode();
              await this.startUserWorkflow(userId, { runMode });
            }
            break;
            
          case '5':
            await this.validateSystem();
            break;
            
          case '6':
            const config = await this.getCustomConfig();
            await this.startMultiUserWorkflow(config);
            running = false; // Exit after starting workflow
            break;
            
          case '7':
            console.log('👋 Exiting...');
            running = false;
            break;
            
          default:
            console.log('❌ Invalid option, please try again.');
        }
      }
      
      rl.close();
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
  
  async promptForRunMode() {
    console.log('\n🔄 Select Run Mode:');
    console.log('1. Continuous (runs repeatedly at interval)');
    console.log('2. Once (runs once and completes)');
    console.log('3. Exit (runs once and exits immediately)');
    
    const answer = await new Promise((resolve) => {
      rl.question('Choose run mode (1-3): ', (input) => {
        resolve(input.trim());
      });
    });
    
    switch (answer) {
      case '1': return 'continuous';
      case '2': return 'once';
      case '3': return 'exit';
      default: return 'continuous';
    }
  }
}

// Start the bot scheduler
async function main() {
  const scheduler = new BotScheduler();
  await scheduler.run();
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});