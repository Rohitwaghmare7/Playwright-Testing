import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './bot/activities.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const connection = await NativeConnection.connect({
      address: '3.128.198.251:7233',
    });

    const worker = await Worker.create({
      connection,
      workflowsPath: path.join(__dirname, 'workflow'),
      activities,
      taskQueue: 'screenshot-task-queue',
    });

    console.log('✅ Worker started successfully!');
    console.log('📋 Task Queue: screenshot-task-queue');
    console.log('🌐 Temporal Web UI: http://3.128.198.251:8080');
    console.log('⚡ Listening for workflow tasks...');
    console.log('\nPress Ctrl+C to stop the worker.\n');
    
    await worker.run();
  } catch (error) {
    console.error('❌ Worker failed to start:', error);
    console.error('Connection details:', error.message);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});