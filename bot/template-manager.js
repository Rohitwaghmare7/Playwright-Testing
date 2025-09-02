import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateManager {
  constructor() {
    this.templatesPath = path.join(__dirname, '../templates');
    this.loadedTemplates = new Map();
  }

  async loadTemplate(rmsType) {
    try {
      if (this.loadedTemplates.has(rmsType)) {
        return this.loadedTemplates.get(rmsType);
      }

      const templateFile = path.join(this.templatesPath, `template-${rmsType}.js`);

      const exists = await fs.pathExists(templateFile);
      if (!exists) {
        throw new Error(`Template file not found: ${templateFile}`);
      }

      const templateModule = await import(`file://${templateFile}`);
      
      const template = {
        rmsType,
        config: templateModule[`template${rmsType}Config`],
        executor: templateModule[`executeTemplate${rmsType}`],
        filePath: templateFile
      };

      this.validateTemplate(template);
      
      this.loadedTemplates.set(rmsType, template);
      
      console.log(`📄 Loaded template ${rmsType}: ${template.config?.name || 'Unnamed'}`);
      return template;
      
    } catch (error) {
      console.error(`❌ Failed to load template ${rmsType}: ${error.message}`);
      throw new Error(`Template loading failed for RMS type ${rmsType}: ${error.message}`);
    }
  }

  async loadAllTemplates() {
    try {
      const templateFiles = await fs.readdir(this.templatesPath);
      const templateNumbers = templateFiles
        .filter(file => file.startsWith('template-') && file.endsWith('.js'))
        .map(file => parseInt(file.match(/template-(\d+)\.js/)?.[1]))
        .filter(num => !isNaN(num));

      const loadedTemplates = {};
      
      for (const rmsType of templateNumbers) {
        try {
          const template = await this.loadTemplate(rmsType);
          loadedTemplates[rmsType] = template;
        } catch (error) {
          console.error(`⚠️ Skipping template ${rmsType}: ${error.message}`);
        }
      }

      console.log(`📚 Loaded ${Object.keys(loadedTemplates).length} templates:`, Object.keys(loadedTemplates).join(', '));
      return loadedTemplates;
      
    } catch (error) {
      console.error(`❌ Failed to load templates: ${error.message}`);
      throw error;
    }
  }


  async getTemplate(rmsType) {
    if (!this.loadedTemplates.has(rmsType)) {
      await this.loadTemplate(rmsType);
    }
    return this.loadedTemplates.get(rmsType);
  }

  async hasTemplate(rmsType) {
    try {
      await this.getTemplate(rmsType);
      return true;
    } catch {
      return false;
    }
  }


  validateTemplate(template) {
    if (!template.config) {
      throw new Error('Template missing config object');
    }

    if (!template.executor || typeof template.executor !== 'function') {
      throw new Error('Template missing executor function');
    }

    if (!template.config.name) {
      throw new Error('Template config missing name');
    }

    if (!template.config.rmsType || template.config.rmsType !== template.rmsType) {
      throw new Error('Template RMS type mismatch');
    }

    if (!Array.isArray(template.config.urls) || template.config.urls.length === 0) {
      throw new Error('Template config missing or empty urls array');
    }

    console.log(`✅ Template ${template.rmsType} validation passed`);
  }

 
  getAvailableTemplates() {
    return Array.from(this.loadedTemplates.keys()).sort((a, b) => a - b);
  }


  async reloadTemplate(rmsType) {
    this.loadedTemplates.delete(rmsType);
    const templateFile = path.join(this.templatesPath, `template-${rmsType}.js`);
    delete require.cache[require.resolve(templateFile)];
    return await this.loadTemplate(rmsType);
  }

  getStats() {
    const templates = Array.from(this.loadedTemplates.values());
    
    return {
      totalLoaded: templates.length,
      availableTypes: this.getAvailableTemplates(),
      templateInfo: templates.map(t => ({
        rmsType: t.rmsType,
        name: t.config.name,
        urlCount: t.config.urls?.length || 0,
        loginRequired: t.config.loginRequired || false
      }))
    };
  }
}