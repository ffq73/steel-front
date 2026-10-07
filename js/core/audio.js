/* ============================================================
   core/audio.js —— 零依赖程序化音效（Web Audio API）
   无需任何外部音频文件，双击即响，支持静音切换与平滑降级。
   ============================================================ */

class SoundSystem {
  constructor(){
    this.ctx = null;
    this.muted = false;
    try {
      if(typeof localStorage !== 'undefined'){
        this.muted = localStorage.getItem('steelfront_muted') === '1';
      }
    } catch(e){}
  }

  init(){
    if(!this.ctx && typeof window !== 'undefined'){
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(AudioCtx){
        this.ctx = new AudioCtx();
      }
    }
    if(this.ctx && this.ctx.state === 'suspended'){
      this.ctx.resume().catch(()=>{});
    }
  }

  isMuted(){ return this.muted; }

  toggleMute(){
    this.muted = !this.muted;
    try {
      if(typeof localStorage !== 'undefined'){
        localStorage.setItem('steelfront_muted', this.muted ? '1' : '0');
      }
    } catch(e){}
    return this.muted;
  }

  // 开炮/攻击轰鸣
  playAttack(){
    if(this.muted) return;
    this.init();
    if(!this.ctx) return;
    const now = this.ctx.currentTime;
    // 振荡器频率骤降模拟低沉炮火
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  // 警报/重要事件双音
  playAlert(){
    if(this.muted) return;
    this.init();
    if(!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554].forEach((freq, i)=>{
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.18, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.19);
    });
  }

  // 占领城市/胜利推进短军号
  playCapture(){
    if(this.muted) return;
    this.init();
    if(!this.ctx) return;
    const now = this.ctx.currentTime;
    [392, 523.25, 659.25].forEach((freq, i)=>{
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.26);
    });
  }

  // 胜利军乐
  playVictory(){
    if(this.muted) return;
    this.init();
    if(!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i)=>{
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.16);
      gain.gain.setValueAtTime(0.25, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.16 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.42);
    });
  }

  // 战败沉痛音调
  playDefeat(){
    if(this.muted) return;
    this.init();
    if(!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [392, 349.23, 329.63, 261.63];
    notes.forEach((freq, i)=>{
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.22);
      gain.gain.setValueAtTime(0.2, now + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.22 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.22);
      osc.stop(now + i * 0.22 + 0.38);
    });
  }

  // 点击微弱提示
  playGate(){
    try{
      this.init();
      if(!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type='sine';
      o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(38, t+0.5);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t+0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.62);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t+0.7);
    }catch(e){}
  }
  playHover(){
    try{
      this.init();
      if(!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type='square'; o.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.04, t+0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.06);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t+0.08);
    }catch(e){}
  }
  playStamp(){
    try{
      this.init();
      if(!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.18);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 5);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const lp = this.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 420;
      const g = this.ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp); lp.connect(g); g.connect(this.ctx.destination);
      src.start(t);
    }catch(e){}
  }
  playClick(){
    if(this.muted) return;
    this.init();
    if(!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const sound = new SoundSystem();
