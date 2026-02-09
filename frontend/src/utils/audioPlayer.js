// src/utils/audioPlayer.js
export class AudioStreamPlayer {
    constructor() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      this.nextStartTime = 0;
      this.queue = [];
    }
  
    add16BitPCM(base64Data) {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const float32 = new Float32Array(len / 2);
      const dataView = new DataView(bytes.buffer);
      
      for (let i = 0; i < len / 2; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32[i] = int16 / 32768;
      }
  
      this.queue.push(float32);
      this.scheduleNextBuffer();
    }
  
    scheduleNextBuffer() {
      if (this.queue.length === 0) return;
  
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
  
      const audioData = this.queue.shift();
      const buffer = this.audioContext.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);
  
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
  
      const currentTime = this.audioContext.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }
      
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
    }
}