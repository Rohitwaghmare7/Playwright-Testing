import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CredentialManager {
  constructor(credentialsPath = '../credentials.json') {
    this.credentialsPath = path.join(__dirname, credentialsPath);
    this.credentials = null;
    this.lastLoaded = null;
  }

  async loadCredentials() {
    try {
      const stats = await fs.stat(this.credentialsPath);
      
      // Only reload if file changed or first load
      if (!this.lastLoaded || stats.mtime > this.lastLoaded) {
        const data = await fs.readJson(this.credentialsPath);
        this.credentials = data;
        this.lastLoaded = stats.mtime;
        
        console.log(`📋 Loaded ${data.users?.length || 0} credentials from ${this.credentialsPath}`);
        console.log(`⚙️ Check interval: ${data.config?.checkIntervalMinutes || 1} minutes`);
      }
      
      return this.credentials;
    } catch (error) {
      console.error(`❌ Failed to load credentials: ${error.message}`);
      throw new Error(`Credential loading failed: ${error.message}`);
    }
  }

  async getEnabledUsers() {
    const creds = await this.loadCredentials();
    return creds.users?.filter(user => user.enabled) || [];
  }

  async getUsersByRmsType(rmsType) {
    const users = await this.getEnabledUsers();
    return users.filter(user => user.rmsType === rmsType);
  }

  async getUserById(userId) {
    const users = await this.getEnabledUsers();
    return users.find(user => user.id === userId);
  }

  async getConfig() {
    const creds = await this.loadCredentials();
    return creds.config || {
      checkIntervalMinutes: 1,
      maxParallelWorkflows: 10,
      screenshotRetries: 3,
      timeout: "5 minutes"
    };
  }

  async getAvailableRmsTypes() {
    const users = await this.getEnabledUsers();
    const rmsTypes = [...new Set(users.map(user => user.rmsType))];
    return rmsTypes.sort((a, b) => a - b);
  }

  async validateCredentials() {
    try {
      const creds = await this.loadCredentials();
      
      if (!creds.users || !Array.isArray(creds.users)) {
        throw new Error('Invalid credentials: users array not found');
      }

      for (const user of creds.users) {
        if (!user.id || !user.username || !user.password || !user.rmsType) {
          throw new Error(`Invalid user entry: ${JSON.stringify(user)}`);
        }
        
        if (typeof user.rmsType !== 'number' || user.rmsType < 1 || user.rmsType > 4) {
          throw new Error(`Invalid RMS type for user ${user.id}: ${user.rmsType}`);
        }
      }

      console.log('✅ Credentials validation passed');
      return true;
    } catch (error) {
      console.error(`❌ Credentials validation failed: ${error.message}`);
      throw error;
    }
  }

  async getStats() {
    const creds = await this.loadCredentials();
    const users = creds.users || [];
    const enabled = users.filter(u => u.enabled);
    
    const rmsStats = {};
    enabled.forEach(user => {
      rmsStats[user.rmsType] = (rmsStats[user.rmsType] || 0) + 1;
    });

    return {
      total: users.length,
      enabled: enabled.length,
      disabled: users.length - enabled.length,
      rmsTypeDistribution: rmsStats,
      lastLoaded: this.lastLoaded
    };
  }
}