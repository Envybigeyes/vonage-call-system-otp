const axios = require('axios');
const { db } = require('../database');

class WebhookRetryService {
  constructor() {
    this.retryInterval = 60000; // Check every minute
    this.startRetryWorker();
  }

  startRetryWorker() {
    setInterval(() => {
      this.processRetries();
    }, this.retryInterval);
  }

  async queueWebhook(type, payload, url, maxRetries = 3) {
    try {
      const insert = db.prepare(`
        INSERT INTO webhook_retry_queue (webhook_type, payload, url, max_retries, next_retry)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);
      insert.run(type, JSON.stringify(payload), url, maxRetries);
      console.log(`📋 Queued ${type} webhook for retry`);
    } catch (err) {
      console.error('Failed to queue webhook:', err);
    }
  }

  async processRetries() {
    try {
      const pending = db.prepare(`
        SELECT * FROM webhook_retry_queue 
        WHERE status = 'pending' 
        AND retry_count < max_retries 
        AND next_retry <= datetime('now')
        LIMIT 10
      `).all();

      for (const webhook of pending) {
        await this.retryWebhook(webhook);
      }
    } catch (err) {
      console.error('Retry processing error:', err);
    }
  }

  async retryWebhook(webhook) {
    try {
      const response = await axios.post(webhook.url, JSON.parse(webhook.payload), {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status >= 200 && response.status < 300) {
        db.prepare('UPDATE webhook_retry_queue SET status = ? WHERE id = ?').run('completed', webhook.id);
        console.log(`✅ Webhook retry succeeded: ${webhook.webhook_type}`);
      } else {
        this.incrementRetry(webhook);
      }
    } catch (err) {
      console.error(`❌ Webhook retry failed: ${webhook.webhook_type}`, err.message);
      this.incrementRetry(webhook);
    }
  }

  incrementRetry(webhook) {
    const newRetryCount = webhook.retry_count + 1;
    const nextRetry = new Date(Date.now() + Math.pow(2, newRetryCount) * 60000).toISOString();
    
    if (newRetryCount >= webhook.max_retries) {
      db.prepare('UPDATE webhook_retry_queue SET status = ?, retry_count = ? WHERE id = ?')
        .run('failed', newRetryCount, webhook.id);
      console.log(`💀 Webhook permanently failed after ${newRetryCount} retries`);
    } else {
      db.prepare('UPDATE webhook_retry_queue SET retry_count = ?, next_retry = ? WHERE id = ?')
        .run(newRetryCount, nextRetry, webhook.id);
      console.log(`🔄 Scheduled retry ${newRetryCount} for webhook ${webhook.id}`);
    }
  }
}

module.exports = WebhookRetryService;
