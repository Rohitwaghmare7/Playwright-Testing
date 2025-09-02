import { Connection, Client } from '@temporalio/client';
import { screenshotWorkflow } from './workflow/screenshot-workflow.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function run() {
  try {
    const connection = await Connection.connect({ 
      address: '3.128.198.251:7233'
    });
    
    const client = new Client({ connection });

    const url = await new Promise((resolve) => {
      rl.question('Enter URL to screenshot (or press Enter for Google): ', (answer) => {
        resolve(answer.trim() || 'https://www.google.com');
      });
    });

    console.log(`🚀 Starting screenshot workflow for: ${url}`);

    const handle = await client.workflow.start(screenshotWorkflow, {
      args: [url],
      taskQueue: 'screenshot-task-queue',
      workflowId: `screenshot-workflow-${Date.now()}`,
    });

    console.log(`📋 Workflow started with ID: ${handle.workflowId}`);
    console.log(`🌐 Monitor at: http://3.128.198.251:8080/namespaces/default/workflows/${handle.workflowId}`);
    console.log('⏳ Waiting for result...');

    const result = await handle.result();
        
    console.log('✅ Workflow completed successfully!');
    console.log(`📸 Screenshot saved at: ${result.screenshotPath}`);
    console.log(`🌐 URL: ${result.url}`);
    console.log(`⏰ Timestamp: ${result.timestamp}`);
   
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    rl.close();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});