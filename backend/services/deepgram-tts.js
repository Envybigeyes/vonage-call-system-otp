const { createClient } = require('@deepgram/sdk');
const fs = require('fs');
const path = require('path');

class DeepgramTTS {
  constructor() {
    if (!process.env.DEEPGRAM_API_KEY) {
      console.warn('⚠️  No DEEPGRAM_API_KEY - TTS will fail');
      this.enabled = false;
      return;
    }
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.enabled = true;
  }

  async generateAudio(text, options = {}) {
    if (!this.enabled) {
      throw new Error('Deepgram not configured');
    }

    const {
      voice = 'aura-asteria-en',
      outputPath = null
    } = options;

    try {
      const response = await this.deepgram.speak.request(
        { text },
        {
          model: voice,
          encoding: 'linear16',  // Changed from 'mp3'
          container: 'wav',      // Changed from 'mp3'
          sample_rate: 24000
        }
      );

      const stream = await response.getStream();
      const buffer = await this.streamToBuffer(stream);

      if (outputPath) {
        // Change extension to .wav
        const wavPath = outputPath.replace('.mp3', '.wav');
        fs.writeFileSync(wavPath, buffer);
        return wavPath;
      }

      return buffer;
    } catch (err) {
      console.error('Deepgram TTS error:', err);
      throw err;
    }
  }

  async streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async generateForVonage(text, callUuid, options = {}) {
    const audioDir = path.join(__dirname, '../audio-cache');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const filename = `${callUuid}-${Date.now()}.wav`;  // Changed extension
    const filePath = path.join(audioDir, filename);
    
    await this.generateAudio(text, { ...options, outputPath: filePath });
    
    return {
      filePath,
      streamUrl: `${process.env.BASE_URL}/audio/${filename}`
    };
  }
}

module.exports = DeepgramTTS;
