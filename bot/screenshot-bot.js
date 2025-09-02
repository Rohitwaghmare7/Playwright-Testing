import { takeScreenshotActivity } from './activities.js';

export class ScreenshotBot {
  constructor() {
    this.name = 'Screenshot Bot';
  }

  async captureScreenshot(url) {
    return await takeScreenshotActivity(url);
  }
}
