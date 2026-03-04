import { useEffect, useRef, useState } from "react";

// ─── Dither Engine ────────────────────────────────────────────────────────────
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const h2r = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const lumf = (r,g,b) => 0.2126*r + 0.7152*g + 0.0722*b;
function closestIdx(v){ if(v<64)return 3; if(v<128)return 2; if(v<192)return 1; return 0; }
function applyIdx(out,idx,i,pal){ const[r,g,b]=h2r(pal[idx]); out[i]=r;out[i+1]=g;out[i+2]=b;out[i+3]=255; }
function prepLum(data,w,h){ const a=new Float32Array(w*h); const cf=(259*(255*0.2+255))/(255*(259-255*0.2)); for(let i=0;i<w*h;i++){const p=i*4;a[i]=clamp(cf*(lumf(data[p],data[p+1],data[p+2])-128)+128,0,255);} return a; }
const VC16=[[0,128,32,160,8,136,40,168,2,130,34,162,10,138,42,170],[192,64,224,96,200,72,232,104,194,66,226,98,202,74,234,106],[48,176,16,144,56,184,24,152,50,178,18,146,58,186,26,154],[240,112,208,80,248,120,216,88,242,114,210,82,250,122,218,90],[12,140,44,172,4,132,36,164,14,142,46,174,6,134,38,166],[204,76,236,108,196,68,228,100,206,78,238,110,198,70,230,102],[60,188,28,156,52,180,20,148,62,190,30,158,54,182,22,150],[252,124,220,92,244,116,212,84,254,126,222,94,246,118,214,86],[3,131,35,163,11,139,43,171,1,129,33,161,9,137,41,169],[195,67,227,99,203,75,235,107,193,65,225,97,201,73,233,105],[51,179,19,147,59,187,27,155,49,177,17,145,57,185,25,153],[243,115,211,83,251,123,219,91,241,113,209,81,249,121,217,89],[15,143,47,175,7,135,39,167,13,141,45,173,5,133,37,165],[207,79,239,111,199,71,231,103,205,77,237,109,197,69,229,101],[63,191,31,159,55,183,23,151,61,189,29,157,53,181,21,149],[255,127,223,95,247,119,215,87,253,125,221,93,245,117,213,85]];
const B4=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function dVoid(lums,w,h,pal){const out=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const t=VC16[y%16][x%16]/256-0.5;const v=clamp(lums[i]+t*128,0,255);applyIdx(out,closestIdx(v),i*4,pal);}return out;}
function dBayer4(lums,w,h,pal){const out=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const t=B4[y%4][x%4]/16-0.5;const v=clamp(lums[i]+t*128,0,255);applyIdx(out,closestIdx(v),i*4,pal);}return out;}
function blendLayers(A,B,w,h,mix){const out=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const s=B4[y%4][x%4]/16<mix?B:A;out[i]=s[i];out[i+1]=s[i+1];out[i+2]=s[i+2];out[i+3]=255;}return out;}
function ditherCanvas(src,out,pal){
  const w=src.width,h=src.height; out.width=w; out.height=h;
  const lums=prepLum(src.getContext('2d').getImageData(0,0,w,h).data,w,h);
  const p1=dVoid(lums,w,h,pal);
  const l2=new Float32Array(w*h); for(let i=0;i<w*h;i++) l2[i]=lumf(p1[i*4],p1[i*4+1],p1[i*4+2]);
  const p2=dBayer4(l2,w,h,pal);
  out.getContext('2d').putImageData(new ImageData(blendLayers(p1,p2,w,h,0.48),w,h),0,0);
}

// Colors
const BG       = '#F5F2EC'; // hero / main bg
const BG_ALT   = '#EDE8E0'; // alternate section bg — warm beige
const ACCENT   = '#F57FB6'; // reddish-orange CTA
const ACCENT_FG= '#FFFFFF';
const INK      = '#1A1814';
const DPAL     = ['#F0EDE6','#D4D0C8','#8A8680','#1E1C18'];

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}
function Reveal({ children, delay=0, direction='up', style={} }) {
  const [ref, visible] = useReveal();
  const dy = direction==='up' ? 24 : direction==='down' ? -24 : 0;
  const dx = direction==='left' ? 24 : direction==='right' ? -24 : 0;
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translate(0,0)' : `translate(${dx}px,${dy}px)`,
      transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Dither Strip ─────────────────────────────────────────────────────────────
function DitherStrip({ label='', h=52 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const W = Math.max(c.offsetWidth || 1400, 200);
    c.width = W; c.height = h;
    const src = document.createElement('canvas'); src.width=W; src.height=h;
    const ctx = src.getContext('2d');
    const g = ctx.createLinearGradient(0,0,W,h);
    g.addColorStop(0,   '#E0DBD2');
    g.addColorStop(0.3, '#CEC9C0');
    g.addColorStop(0.7, '#C8C3BA');
    g.addColorStop(1,   '#E0DBD2');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,h);
    for (let i=0; i<5; i++) {
      ctx.beginPath();
      for (let x=0; x<=W; x+=3)
        ctx.lineTo(x, h/2 + Math.sin((x/W)*Math.PI*3 + i*1.5)*(h*0.2*(0.4+i*0.12)));
      ctx.strokeStyle = 'rgba(50,44,36,0.07)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ditherCanvas(src, c, DPAL);
  }, [h]);
  return (
    <div style={{ position:'relative', width:'100%', overflow:'hidden' }}>
      <canvas ref={ref} style={{ display:'block', width:'100%', height:h, imageRendering:'pixelated' }} />
      {label && (
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', paddingLeft:52,
          fontFamily:"'Space Mono',monospace", fontSize:9, color:'rgba(26,24,20,0.42)',
          letterSpacing:'0.24em', pointerEvents:'none',
        }}>{label}</div>
      )}
    </div>
  );
}

// ─── Dithered Icon ────────────────────────────────────────────────────────────
// Draws a named icon onto a canvas then applies the dither engine.
// icons: 'mic' | 'book' | 'note'
function DitheredIcon({ icon, size=72 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const S = 2; // retina
    const W = size * S, H = size * S;
    c.width = W; c.height = H;

    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const ctx = src.getContext('2d');

    // Warm parchment background
    ctx.fillStyle = '#D8D4CC';
    rr(ctx, 0, 0, W, H, 10*S); ctx.fill();

    // Draw icon in near-black
    ctx.strokeStyle = '#1A1814';
    ctx.fillStyle   = '#1A1814';
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    const u = S; // 1 logical px in canvas units

    if (icon === 'mic') {
      // Microphone body (capsule)
      const mx = W/2, capT = 10*u, capH = 24*u, capR = 9*u;
      ctx.lineWidth = 2.5*u;
      ctx.beginPath();
      ctx.moveTo(mx - capR, capT + capR);
      ctx.arcTo(mx - capR, capT, mx, capT, capR);
      ctx.arcTo(mx + capR, capT, mx + capR, capT + capR, capR);
      ctx.lineTo(mx + capR, capT + capH);
      ctx.arcTo(mx + capR, capT + capH + capR, mx, capT + capH + capR, capR);
      ctx.arcTo(mx - capR, capT + capH + capR, mx - capR, capT + capH, capR);
      ctx.closePath();
      ctx.stroke();
      // Grille lines inside capsule
      ctx.lineWidth = 1.2*u;
      for (let g = 0; g < 3; g++) {
        const gy = capT + capR*0.8 + g * 7*u;
        const hw = Math.sqrt(Math.max(0, capR*capR - Math.pow(gy - (capT+capH/2+capR*0.1), 2)));
        ctx.beginPath(); ctx.moveTo(mx - hw*0.85, gy); ctx.lineTo(mx + hw*0.85, gy); ctx.stroke();
      }
      // Stand arc
      const arcCy = capT + capH + capR + 2*u;
      ctx.lineWidth = 2.5*u;
      ctx.beginPath();
      ctx.arc(mx, arcCy, 13*u, Math.PI, 0, true);
      ctx.stroke();
      // Stem
      ctx.beginPath(); ctx.moveTo(mx, arcCy + 13*u); ctx.lineTo(mx, arcCy + 13*u + 7*u); ctx.stroke();
      // Base
      ctx.beginPath(); ctx.moveTo(mx - 10*u, arcCy + 20*u); ctx.lineTo(mx + 10*u, arcCy + 20*u); ctx.stroke();
    }

    if (icon === 'book') {
      const bx = 10*u, by = 11*u, bw = W - 20*u, bh = H - 22*u;
      const spine = bx + bw/2;
      ctx.lineWidth = 2.5*u;
      // Left cover
      ctx.beginPath();
      ctx.moveTo(spine, by + 4*u);
      ctx.lineTo(bx + 3*u, by);
      ctx.lineTo(bx, by + 4*u);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(spine, by + bh - 2*u);
      ctx.closePath();
      ctx.stroke();
      // Right cover
      ctx.beginPath();
      ctx.moveTo(spine, by + 4*u);
      ctx.lineTo(bx + bw - 3*u, by);
      ctx.lineTo(bx + bw, by + 4*u);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(spine, by + bh - 2*u);
      ctx.closePath();
      ctx.stroke();
      // Spine line
      ctx.lineWidth = 1.5*u;
      ctx.beginPath(); ctx.moveTo(spine, by + 4*u); ctx.lineTo(spine, by + bh - 2*u); ctx.stroke();
      // Page lines on right page
      ctx.lineWidth = 1.2*u;
      const lx1 = spine + 5*u, lx2 = bx + bw - 7*u;
      for (let l = 0; l < 4; l++) {
        const ly = by + 14*u + l * 8*u;
        ctx.beginPath(); ctx.moveTo(lx1, ly); ctx.lineTo(lx2, ly); ctx.stroke();
      }
    }

    if (icon === 'note') {
      const nx = W/2, noteY = 14*u;
      // Note head (filled ellipse)
      ctx.lineWidth = 2*u;
      ctx.beginPath();
      ctx.ellipse(nx - 4*u, H - 18*u, 8*u, 6*u, -0.4, 0, Math.PI*2);
      ctx.fill();
      // Stem
      ctx.lineWidth = 2.5*u;
      ctx.beginPath(); ctx.moveTo(nx + 4*u, H - 18*u); ctx.lineTo(nx + 4*u, noteY + 4*u); ctx.stroke();
      // Flag (eighth note)
      ctx.lineWidth = 2*u;
      ctx.beginPath();
      ctx.moveTo(nx + 4*u, noteY + 4*u);
      ctx.bezierCurveTo(nx + 20*u, noteY + 10*u, nx + 20*u, noteY + 20*u, nx + 10*u, noteY + 26*u);
      ctx.stroke();
      // Second flag
      ctx.beginPath();
      ctx.moveTo(nx + 4*u, noteY + 14*u);
      ctx.bezierCurveTo(nx + 18*u, noteY + 20*u, nx + 18*u, noteY + 28*u, nx + 10*u, noteY + 34*u);
      ctx.stroke();
    }

    ditherCanvas(src, c, DPAL);
  }, [icon, size]);

  return (
    <canvas ref={ref} style={{ display:'block', width:size, height:size, imageRendering:'pixelated', borderRadius:5 }} />
  );
}

// ─── Music constants ──────────────────────────────────────────────────────────
const NOTE_FREQS = {C:261.63,'C#':277.18,D:293.66,'D#':311.13,E:329.63,F:349.23,'F#':369.99,G:392.00,'G#':415.30,A:440.00,'A#':466.16,B:493.88};
const ALL_SEMI   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CHORD_TYPES = [
  {id:'maj', label:'Maj', intervals:[0,4,7]   },
  {id:'min', label:'min', intervals:[0,3,7]   },
  {id:'7',   label:'7',   intervals:[0,4,7,10]},
  {id:'maj7',label:'M7',  intervals:[0,4,7,11]},
  {id:'min7',label:'m7',  intervals:[0,3,7,10]},
  {id:'dim', label:'dim', intervals:[0,3,6]   },
];
const WHITE_KEYS = [{note:'C'},{note:'D'},{note:'E'},{note:'F'},{note:'G'},{note:'A'},{note:'B'}];
const BLACK_KEYS = [{note:'C#',gap:0},{note:'D#',gap:1},{note:'F#',gap:3},{note:'G#',gap:4},{note:'A#',gap:5}];

function getFreq(root,s){const bi=ALL_SEMI.indexOf(root),ti=(bi+s)%12,oct=Math.floor((bi+s)/12);return(NOTE_FREQS[ALL_SEMI[ti]]||261.63)*Math.pow(2,oct);}
function playNote(root){
  try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const g=ctx.createGain();g.connect(ctx.destination);g.gain.setValueAtTime(0.12,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.7);const o=ctx.createOscillator();o.connect(g);o.type='sine';o.frequency.value=NOTE_FREQS[root]||261.63;o.start();o.stop(ctx.currentTime+0.7);}catch(e){}
}
function playChord(root,intervals){
  try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const mg=ctx.createGain();mg.connect(ctx.destination);mg.gain.setValueAtTime(0,ctx.currentTime);mg.gain.linearRampToValueAtTime(0.16,ctx.currentTime+0.02);mg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+2.2);intervals.forEach((s,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(mg);o.type='triangle';o.frequency.value=getFreq(root,s);g.gain.value=0.38;o.start(ctx.currentTime+i*0.014);o.stop(ctx.currentTime+2.2);});}catch(e){}
}

// ─── Instrument canvas drawing ────────────────────────────────────────────────
// Layout (logical px, drawn at 2× retina):
//   Body: W=370, H=232
//   Pads: PR=15, stride=36. Cols right-aligned to piano right (352).
//         Col centres: 265, 301, 337.  Row centres: 20, 56.
//   Piano: KX=10, KY=96, WKW=48, WKH=128, gap=1
const IW=370, IH=232;
const PR=15, PGAP=6, PSTRIDE=36;
const PX=[265,301,337], PY=[20,56];
const KX=10, KY=96, WKW=48, WKH=128, BKW=28, BKH=80;

function rr(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
}

function drawInstrument(ctx, S, rootNote, pressedKey, activeChordId) {
  // Body
  ctx.fillStyle = '#D8D5CE';
  rr(ctx, 0, 0, IW*S, IH*S, 10*S); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = S;
  rr(ctx, S*.5, S*.5, IW*S-S, IH*S-S, 10*S); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = S;
  rr(ctx, 2*S, 2*S, IW*S-4*S, IH*S-4*S, 9*S); ctx.stroke();

  // Chord pads
  CHORD_TYPES.forEach((ct, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const cx = PX[col]*S, cy = PY[row]*S;
    const isActive = activeChordId === ct.id;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.arc(cx+S*.5, cy+1.5*S, PR*S, 0, Math.PI*2); ctx.fill();
    const pg = ctx.createRadialGradient(cx-2*S, cy-2*S, S, cx, cy, PR*S);
    if (isActive) { pg.addColorStop(0,'#686460'); pg.addColorStop(1,'#3A3830'); }
    else          { pg.addColorStop(0,'#B0ACA4'); pg.addColorStop(1,'#848078'); }
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, PR*S, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = isActive ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = isActive ? 1.5*S : S;
    ctx.beginPath(); ctx.arc(cx, cy, PR*S, 0, Math.PI*2); ctx.stroke();
  });

  // White keys — dark borders visible through dither
  WHITE_KEYS.forEach((key, i) => {
    const x=(KX+i*(WKW+1))*S, y=KY*S, w=WKW*S, h=WKH*S;
    const sel = rootNote===key.note, pressed = pressedKey===key.note;
    const kg = ctx.createLinearGradient(x, y, x, y+h);
    if (sel)         { kg.addColorStop(0,'#A8A49C'); kg.addColorStop(1,'#989490'); }
    else if (pressed){ kg.addColorStop(0,'#C0BCB4'); kg.addColorStop(1,'#B0ACA4'); }
    else             { kg.addColorStop(0,'#F0EDE6'); kg.addColorStop(1,'#E0DDD6'); }
    ctx.fillStyle = kg;
    rr(ctx, x+S*.5, y+S*.5, w-S, h-S, 3*S); ctx.fill();
    ctx.strokeStyle = sel ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = sel ? 2*S : 1.5*S;
    rr(ctx, x+S*.5, y+S*.5, w-S, h-S, 3*S); ctx.stroke();
    if (sel) { ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+S*.5, y+S*.5, w-S, 4*S); }
  });

  // Black keys
  BLACK_KEYS.forEach(key => {
    const x=(KX+key.gap*(WKW+1)+WKW-BKW/2)*S, y=KY*S, w=BKW*S, h=BKH*S;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, x+1.5*S, y, w, h+2*S, 3*S); ctx.fill();
    const bkg = ctx.createLinearGradient(x, y, x+w, y+h);
    bkg.addColorStop(0,'#161412'); bkg.addColorStop(1,'#28241E');
    ctx.fillStyle = bkg;
    rr(ctx, x, y, w, h, 3*S); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    rr(ctx, x+S, y+S, w-2*S, 5*S, 2*S); ctx.fill();
  });
}

// ─── Instrument component ─────────────────────────────────────────────────────
function Instrument() {
  const canvasRef    = useRef(null);
  const rippleRef    = useRef(null);
  const rafRef       = useRef(null);
  const ripplesState = useRef([]);
  const [rootNote,   setRootNote]   = useState(null);
  const [activeChord,setActiveChord]= useState(null);
  const [pressedKey, setPressedKey] = useState(null);
  const [pressedPad, setPressedPad] = useState(null);
  const S = 2;

  // Draw instrument canvas whenever state changes
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.width = IW*S; c.height = IH*S;
    const src = document.createElement('canvas'); src.width=IW*S; src.height=IH*S;
    drawInstrument(src.getContext('2d'), S, rootNote, pressedKey, activeChord?.id || null);
    ditherCanvas(src, c, DPAL);
  }, [rootNote, pressedKey, activeChord]);

  // Ripple animation loop
  useEffect(() => {
    const c = rippleRef.current; if (!c) return;
    c.width = IW; c.height = IH;
    let running = true;
    function tick() {
      if (!running) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, IW, IH);
      const now = performance.now();
      ripplesState.current = ripplesState.current.filter(r => (now-r.t) < 1400);
      ripplesState.current.forEach(r => {
        const age = (now-r.t)/1400;
        for (let w=0; w<3; w++) {
          const wa = Math.max(0, age - w*0.12);
          if (wa <= 0) continue;
          const alpha = (1-wa)*0.22;
          if (alpha <= 0) continue;
          ctx.beginPath();
          ctx.arc(r.x, r.y, wa*110, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(26,24,20,' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 1.5*(1-wa*0.6);
          ctx.stroke();
        }
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { running=false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const triggerRipple = idx => {
    ripplesState.current.push({
      x: KX + idx*(WKW+1) + WKW/2,
      y: KY + WKH*0.35,
      t: performance.now(),
    });
  };

  const onKey = key => {
    const idx = WHITE_KEYS.findIndex(k => k.note===key.note);
    setPressedKey(key.note); setRootNote(key.note); setActiveChord(null);
    playNote(key.note); triggerRipple(idx);
    setTimeout(() => setPressedKey(null), 160);
  };
  const onPad = ct => {
    if (!rootNote) return;
    setPressedPad(ct.id); setActiveChord(ct);
    playChord(rootNote, ct.intervals);
    setTimeout(() => setPressedPad(null), 180);
  };

  const chordLabel = activeChord ? rootNote + ' ' + activeChord.label : null;
  const chordNotes = activeChord
    ? activeChord.intervals.map(s => ALL_SEMI[(ALL_SEMI.indexOf(rootNote)+s)%12]).join(' · ')
    : null;

  // Width of chord screen = space left of leftmost pad column
  const screenW = PX[0] - PR - 14;

  return (
    <div style={{ display:'flex', flexDirection:'column', width:IW, userSelect:'none', position:'relative' }}>

      {/* Chord gen screen — top-left, sized to fit beside pads */}
      <div style={{ position:'absolute', top:4, left:8, width:screenW, zIndex:25, pointerEvents:'none' }}>
        <div style={{
          background:'#090A08', border:'1px solid rgba(0,0,0,0.5)', borderRadius:3,
          padding:'5px 8px', height:KY-8,
          display:'flex', flexDirection:'column', justifyContent:'space-between',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.1) 3px,rgba(0,0,0,0.1) 4px)', pointerEvents:'none' }} />
          <div style={{ fontFamily:"'Space Mono',monospace", fontSize:7, color:'rgba(255,255,255,0.4)', letterSpacing:'0.18em', position:'relative', zIndex:1 }}>CHORD GEN</div>
          {chordLabel ? (
            <>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:'0.05em', lineHeight:1.1, color:'#FFFFFF', position:'relative', zIndex:1 }}>
                {'▸ ' + chordLabel.toUpperCase()}
              </div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:7, letterSpacing:'0.09em', color:'rgba(255,255,255,0.5)', position:'relative', zIndex:1 }}>
                {chordNotes}
              </div>
            </>
          ) : rootNote ? (
            <>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:'0.05em', lineHeight:1.1, color:'rgba(255,255,255,0.7)', position:'relative', zIndex:1 }}>
                {rootNote + ' ·'}
              </div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:7, letterSpacing:'0.08em', color:'rgba(255,255,255,0.4)', position:'relative', zIndex:1, lineHeight:1.8 }}>
                2. choose a chord type →
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:7, letterSpacing:'0.08em', color:'rgba(255,255,255,0.55)', position:'relative', zIndex:1, lineHeight:1.9 }}>
                1. choose a root key ↓
              </div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:7, letterSpacing:'0.08em', color:'rgba(255,255,255,0.35)', position:'relative', zIndex:1, lineHeight:1.9 }}>
                2. choose a chord type →
              </div>
            </>
          )}
        </div>
      </div>



      {/* Canvas + overlays */}
      <div style={{ position:'relative', width:IW, height:IH, flexShrink:0 }}>
        <canvas ref={canvasRef} style={{ display:'block', width:IW, height:IH, imageRendering:'pixelated' }} />
        <canvas ref={rippleRef} style={{ position:'absolute', inset:0, width:IW, height:IH, pointerEvents:'none', zIndex:20 }} />

        {/* Chord pad overlays */}
        {CHORD_TYPES.map((ct, i) => {
          const col=i%3, row=Math.floor(i/3);
          const cx=PX[col], cy=PY[row];
          const isActive = activeChord?.id===ct.id;
          const isPressed = pressedPad===ct.id;
          return (
            <div key={ct.id} onClick={() => onPad(ct)} style={{
              position:'absolute', left:cx-PR, top:cy-PR, width:PR*2, height:PR*2,
              borderRadius:'50%', cursor:rootNote?'pointer':'not-allowed', zIndex:10,
              display:'flex', alignItems:'center', justifyContent:'center',
              transform:isPressed?'scale(0.88)':'scale(1)', transition:'transform 0.07s',
            }}>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:7, fontWeight:700, color:isActive?'#FFFFFF':'rgba(26,24,20,0.72)', letterSpacing:'0.02em', pointerEvents:'none', transition:'color 0.1s' }}>{ct.label}</span>
            </div>
          );
        })}

        {/* White key overlays */}
        {WHITE_KEYS.map((key, i) => {
          const sel = rootNote===key.note;
          return (
            <div key={key.note} onClick={() => onKey(key)} style={{
              position:'absolute', left:KX+i*(WKW+1), top:KY, width:WKW, height:WKH,
              cursor:'pointer', zIndex:5, display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:8,
            }}>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, fontWeight:700, color:sel?'rgba(26,24,20,0.85)':'rgba(26,24,20,0.42)', letterSpacing:'0.04em', pointerEvents:'none', transition:'color 0.08s' }}>{key.note}</span>
            </div>
          );
        })}

        {/* Black key blockers */}
        {BLACK_KEYS.map(key => (
          <div key={key.note} style={{ position:'absolute', left:KX+key.gap*(WKW+1)+WKW-BKW/2, top:KY, width:BKW, height:BKH, zIndex:8, pointerEvents:'all' }} />
        ))}
      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, padding:'16px 52px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#E8E4DC', borderBottom:'1px solid rgba(26,24,20,0.1)' }}>
      <span style={{ fontFamily:"'Space Mono',monospace", fontSize:12, color:ACCENT, letterSpacing:'0.06em' }}>PROJECT PLAY</span>
      <div style={{ display:'flex', gap:2, alignItems:'center' }}>
        {[['Features','#features'],['Vision','#vision'],['How it works','#usecases']].map(([l,h]) => (
          <a key={l} href={h} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'rgba(26,24,20,0.45)', textDecoration:'none', padding:'6px 14px' }}>{l}</a>
        ))}
        <a href="#signup" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, color:ACCENT_FG, background:ACCENT, padding:'8px 18px', borderRadius:4, textDecoration:'none', marginLeft:10 }}>Get early access</a>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ minHeight:'100vh', background:BG, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>

      {/* Corner labels */}
      <div style={{ position:'absolute', top:0, left:0, right:0, padding:'20px 52px', display:'flex', justifyContent:'space-between', zIndex:5, pointerEvents:'none' }}>
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:ACCENT, letterSpacing:'0.18em' }}>PROJECT PLAY — FIG. I</span>
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:ACCENT, letterSpacing:'0.18em' }}>PRODUCT 2025</span>
      </div>

      {/* Hairline frame */}
      <div style={{ position:'absolute', top:44, left:36, right:36, bottom:0, border:'1px solid rgba(26,24,20,0.07)', borderBottom:'none', pointerEvents:'none', zIndex:1 }} />

      {/* Centered text block */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'110px 52px 0', position:'relative', zIndex:2 }}>

        <Reveal delay={0}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:36, justifyContent:'center' }}>
            <div style={{ width:20, height:1, background:ACCENT, opacity:0.4 }} />
            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:ACCENT, letterSpacing:'0.22em' }}>POCKET SYNTHESIZER</span>
            <div style={{ width:20, height:1, background:ACCENT, opacity:0.4 }} />
          </div>
        </Reveal>

        <Reveal delay={60}>
          <h1 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(38px,5.5vw,76px)', lineHeight:1.04, color:INK, margin:0, fontWeight:700, letterSpacing:'-0.03em' }}>Play chords</h1>
        </Reveal>
        <Reveal delay={110}>
          <h1 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(38px,5.5vw,76px)', lineHeight:1.04, color:ACCENT, margin:0, fontWeight:700, letterSpacing:'-0.03em' }}>Learn theory</h1>
        </Reveal>
        <Reveal delay={160}>
          <h1 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(38px,5.5vw,76px)', lineHeight:1.04, color:INK, margin:'0 0 10px', fontWeight:700, letterSpacing:'-0.03em' }}>Make music</h1>
        </Reveal>

        <Reveal delay={210}>
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:16, lineHeight:1.8, color:'rgba(26,24,20,0.48)', maxWidth:440, margin:'0 0 28px' }}>
            A pocket synthesizer for songwriters and students.<br />Try it yourself ↓
          </p>
        </Reveal>

        {/* CTAs — right above the piano */}
        <Reveal delay={250}>
          <div style={{ display:'flex', gap:12, alignItems:'center', justifyContent:'center', marginBottom:36 }}>
            <a href="#signup" onClick={e=>{e.preventDefault();document.getElementById('email-input').focus();document.getElementById('signup').scrollIntoView({behavior:'smooth'});}}
              style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, color:'rgba(26,24,20,0.75)', background:'rgba(26,24,20,0.07)', border:'1.5px solid rgba(26,24,20,0.35)', padding:'11px 26px', borderRadius:4, textDecoration:'none', cursor:'pointer' }}>
              Join the waitlist
            </a>
            <a href="#signup" onClick={e=>{e.preventDefault();document.getElementById('email-input').focus();document.getElementById('signup').scrollIntoView({behavior:'smooth'});}}
              style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, color:ACCENT_FG, background:ACCENT, padding:'11px 26px', borderRadius:4, textDecoration:'none', cursor:'pointer' }}>
              Get early access →
            </a>
          </div>
        </Reveal>
      </div>

      {/* Instrument — 1.4× scale, centered, stats below */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingBottom:80, position:'relative', zIndex:2 }}>
        <Reveal delay={300} direction="up" style={{ display:'flex', justifyContent:'center', width:'100%' }}>
          <div style={{ transform:'scale(1.4)', transformOrigin:'top center', lineHeight:0, marginBottom:-93, flexShrink:0 }}>
            <Instrument />
          </div>
        </Reveal>


      </div>

    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const fx = [
    {n:'01',title:'Chord pads × 6',body:'Six pads give instant access to major, minor, dominant 7th, major 7th, minor 7th, and diminished voicings. Root note set by the piano key you pressed.'},
    {n:'02',title:'Theory screen', body:"Every chord decoded live — name, type, and the notes that make it up. The context that's normally missing when you're just exploring."},
    {n:'03',title:'Loop & layer',  body:"Capture a progression, loop it, and build on top. Try soundpacks, arpeggiate, hold notes — exploration that doesn't feel like homework."},
    {n:'04',title:'Works with your DAW', body:'Standard USB-C MIDI. Zero-config with Ableton, Logic, GarageBand, FL Studio. Standalone or full production controller.'},
  ];
  return (
    <section id="features" style={{ background:BG_ALT, paddingBottom:140 }}>
      <DitherStrip label="01 / FEATURES" />
      <div style={{ maxWidth:1060, margin:'0 auto', padding:'0 52px' }}>
        <Reveal>
          <div style={{ padding:'48px 0 52px' }}>
            <h2 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(20px,2.4vw,34px)', color:INK, fontWeight:700, margin:0, lineHeight:1.12, letterSpacing:'-0.02em' }}>
              Built for how people<br />actually learn music.
            </h2>
          </div>
        </Reveal>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderTop:'1px solid rgba(26,24,20,0.08)', borderBottom:'1px solid rgba(26,24,20,0.08)' }}>
          {fx.map((f,i) => (
            <Reveal key={f.n} delay={i*80} style={{ borderRight:i%2===0?'1px solid rgba(26,24,20,0.08)':'none', borderBottom:'1px solid rgba(26,24,20,0.08)' }}>
              <div style={{ padding:'44px 40px' }}>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:ACCENT, letterSpacing:'0.2em' }}>{f.n}</span>
                <h3 style={{ fontFamily:"'Space Mono',monospace", fontSize:13, color:INK, fontWeight:700, margin:'14px 0 12px', letterSpacing:'0.03em' }}>{f.title}</h3>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, lineHeight:1.85, color:'rgba(26,24,20,0.52)', margin:0 }}>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Vision ───────────────────────────────────────────────────────────────────
function Vision() {
  return (
    <section id="vision" style={{ background:BG, paddingBottom:140 }}>
      <DitherStrip label="02 / VISION" />
      <div style={{ maxWidth:1060, margin:'0 auto', padding:'0 52px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:96, alignItems:'start', paddingTop:72 }}>
          <Reveal>
            <div>
              <h2 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(18px,2.2vw,30px)', color:INK, fontWeight:700, margin:'0 0 28px', lineHeight:1.2, letterSpacing:'-0.02em' }}>
                Anyone can create<br />those goosebumps<br />for someone else.
              </h2>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, lineHeight:1.85, color:'rgba(26,24,20,0.52)', margin:'0 0 16px' }}>
                Traditional music education makes you wait years before you feel the emotional power of what you're learning. We think that's backwards.
              </p>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, lineHeight:1.85, color:'rgba(26,24,20,0.52)', margin:0 }}>
                Project Play exists to expand who gets to make music — and to put the sense of play back into learning it.
              </p>
            </div>
          </Reveal>
          <div style={{ paddingTop:8 }}>
            {[['Expanding access','For more people to play music.'],['Putting play back','Into learning music.']].map(([title,sub],i) => (
              <Reveal key={title} delay={i*100}>
                <div style={{ padding:'28px 0', borderBottom:'1px solid rgba(26,24,20,0.08)', display:'grid', gridTemplateColumns:'32px 1fr', gap:16, alignItems:'start' }}>
                  <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:ACCENT, letterSpacing:'0.14em', paddingTop:3 }}>0{i+1}</div>
                  <div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, color:INK, fontWeight:600, marginBottom:6 }}>{title}</div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:'rgba(26,24,20,0.5)', lineHeight:1.7 }}>{sub}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Use Cases ────────────────────────────────────────────────────────────────
function UseCases() {
  const cases = [
    {tag:'For songwriters',icon:'mic', title:'Write your first song',   body:'Lock in a chord progression with loop mode, layer on top with soundpacks, and export via MIDI to keep going in your DAW.'},
    {tag:'For learners',   icon:'book',title:'Learn while you play',    body:'The screen shows chord names, intervals, and the notes that make it up — as you play, not after.'},
    {tag:'For producers',  icon:'note',title:'Plug in and produce',     body:'USB-C MIDI to Ableton, Logic, or FL Studio. Zero setup. Use as a production controller or standalone synth.'},
  ];
  return (
    <section id="usecases" style={{ background:BG_ALT, paddingBottom:140 }}>
      <DitherStrip label="03 / USE CASES" />
      <div style={{ maxWidth:1060, margin:'0 auto', padding:'0 52px', paddingTop:72 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', borderTop:'1px solid rgba(26,24,20,0.08)' }}>
          {cases.map((c,i) => (
            <Reveal key={c.tag} delay={i*90}>
              <div style={{ padding:'44px 32px 44px 0', borderRight:i<2?'1px solid rgba(26,24,20,0.08)':'none', paddingLeft:i>0?32:0 }}>
                <div style={{ marginBottom:24 }}>
                  <DitheredIcon icon={c.icon} size={64} />
                </div>
                <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:ACCENT, letterSpacing:'0.2em', marginBottom:14 }}>{c.tag.toUpperCase()}</div>
                <h3 style={{ fontFamily:"'Space Mono',monospace", fontSize:13, color:INK, fontWeight:700, margin:'0 0 14px', lineHeight:1.35 }}>{c.title}</h3>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, lineHeight:1.85, color:'rgba(26,24,20,0.5)', margin:0 }}>{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Signup ───────────────────────────────────────────────────────────────────
function Signup() {
  const [em,       setEm]       = useState('');
  const [mailDone, setMailDone] = useState(false);

  return (
    <section id="signup" style={{ background:BG }}>
      <DitherStrip label="04 / EARLY ACCESS" />

      <div style={{ maxWidth:1060, margin:'0 auto', padding:'80px 52px 120px' }}>

        {/* Section headline */}
        <Reveal delay={0}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <h2 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(22px,2.6vw,38px)', color:INK, fontWeight:700, margin:'0 0 14px', lineHeight:1.1, letterSpacing:'-0.02em' }}>
              Be first to play it.
            </h2>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, lineHeight:1.8, color:'rgba(26,24,20,0.5)', maxWidth:440, margin:'0 auto' }}>
              Two ways in — stay in the loop for free, or lock in your unit now with a refundable $1 deposit.
            </p>
          </div>
        </Reveal>

        {/* Two-column cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, border:'1px solid rgba(26,24,20,0.1)', borderRadius:6, overflow:'hidden' }}>

          {/* LEFT — Mailing list */}
          <Reveal delay={80}>
            <div style={{ padding:'52px 48px', background:BG, borderRight:'1px solid rgba(26,24,20,0.1)', height:'100%', display:'flex', flexDirection:'column' }}>
              {/* Badge */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:28 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'rgba(26,24,20,0.25)' }} />
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:8, color:'rgba(26,24,20,0.4)', letterSpacing:'0.2em' }}>FREE</span>
              </div>

              <h3 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(16px,1.6vw,22px)', color:INK, fontWeight:700, margin:'0 0 12px', lineHeight:1.15, letterSpacing:'-0.01em' }}>
                Join the mailing list
              </h3>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, lineHeight:1.85, color:'rgba(26,24,20,0.5)', margin:'0 0 32px', flex:1 }}>
                Be the first to hear about the launch, development updates, and early-bird pricing. No spam, unsubscribe any time.
              </p>

              {/* What you get */}
              <ul style={{ listStyle:'none', margin:'0 0 36px', padding:0, display:'flex', flexDirection:'column', gap:10 }}>
                {['Launch & pricing updates','Development behind the scenes','Community access'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ color:'rgba(26,24,20,0.3)', fontSize:11 }}>—</span>
                    <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'rgba(26,24,20,0.6)' }}>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Email form */}
              {mailDone ? (
                <div style={{ padding:'14px 20px', background:'rgba(26,24,20,0.04)', borderRadius:4, fontFamily:"'DM Sans',sans-serif", fontSize:14, color:INK, fontWeight:500, textAlign:'center' }}>
                  ✓ You're on the list
                </div>
              ) : (
                <form onSubmit={e => { e.preventDefault(); const f=e.target; if(f.email.value.trim()) setMailDone(true); }} style={{ display:'flex' }}>
                  <input id="email-input" name="email" type="email" placeholder="your@email.com"
                    style={{ flex:1, padding:'12px 14px', background:'rgba(245,242,236,0.7)', border:'1px solid rgba(26,24,20,0.15)', borderRight:'none', color:INK, fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:'none', borderRadius:'4px 0 0 4px' }} />
                  <button type="submit" style={{ padding:'12px 18px', background:INK, color:'#F0EDE6', border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, borderRadius:'0 4px 4px 0', whiteSpace:'nowrap' }}>
                    Subscribe →
                  </button>
                </form>
              )}
            </div>
          </Reveal>

          {/* RIGHT — Reserve ($1) */}
          <Reveal delay={160}>
            <div style={{ padding:'52px 48px', background:ACCENT, height:'100%', display:'flex', flexDirection:'column' }}>
              {/* Badge */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:28 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.5)' }} />
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:8, color:'rgba(255,255,255,0.6)', letterSpacing:'0.2em' }}>PRIORITY ACCESS</span>
              </div>

              <h3 style={{ fontFamily:"'Space Mono',monospace", fontSize:'clamp(16px,1.6vw,22px)', color:ACCENT_FG, fontWeight:700, margin:'0 0 12px', lineHeight:1.15, letterSpacing:'-0.01em' }}>
                Reserve yours now
              </h3>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, lineHeight:1.85, color:'rgba(250,246,242,0.72)', margin:'0 0 32px', flex:1 }}>
                Put down a refundable $1 deposit to hold your place at the front of the queue and lock in 10% off the final retail price.
              </p>

              {/* What you get */}
              <ul style={{ listStyle:'none', margin:'0 0 36px', padding:0, display:'flex', flexDirection:'column', gap:10 }}>
                {['Priority shipping — first units out','10% off final retail price','Direct line to the founders','$1 fully refundable, any time'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ color:'rgba(250,246,242,0.45)', fontSize:11 }}>—</span>
                    <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'rgba(250,246,242,0.85)' }}>{item}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <a href="#reserve" id="reserve" onClick={e => { e.preventDefault(); alert('Payment flow coming soon! Drop us an email at hello@projectplay.com to reserve manually.'); }}
                  style={{ display:'block', textAlign:'center', padding:'14px 24px', background:ACCENT_FG, color:ACCENT, fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700, borderRadius:4, textDecoration:'none', cursor:'pointer', letterSpacing:'0.01em' }}>
                  Reserve for $1 →
                </a>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:'rgba(250,246,242,0.45)', textAlign:'center', margin:0, lineHeight:1.6 }}>
                  Secure checkout · Fully refundable · No hidden fees
                </p>
              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background:BG_ALT, borderTop:'1px solid rgba(26,24,20,0.08)', padding:'22px 52px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:'rgba(26,24,20,0.3)', letterSpacing:'0.06em' }}>PROJECT PLAY</span>
      <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:'rgba(26,24,20,0.28)' }}>© 2025</span>
    </footer>
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────
// Full-viewport intro: ripples emanate from center, "PROJECT PLAY" fades in,
// then the whole overlay fades out to reveal the page underneath.
function SplashScreen({ onDone }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const startRef  = useRef(null);

  // Total duration before we call onDone (ms)
  const TOTAL    = 1400;
  // How many staggered ripple bursts
  const BURSTS   = 2;
  // Max radius — fills the diagonal of any viewport
  const MAX_R    = 1200;

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;

    const resize = () => {
      c.width  = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    startRef.current = performance.now();

    function tick(now) {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / TOTAL, 1);

      const ctx = c.getContext('2d');
      const W = c.width, H = c.height;
      const cx = W / 2, cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      // Background — warm paper, fades out after ~70% of animation
      const bgAlpha = progress < 0.65
        ? 1
        : Math.max(0, 1 - (progress - 0.65) / 0.35);
      ctx.fillStyle = `rgba(245,242,236,${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);

      // Ripple rings — 5 bursts staggered by 220ms each, like a chord strike
      for (let b = 0; b < BURSTS; b++) {
        const burstDelay = b * 0.09; // fraction of TOTAL
        const burstAge   = Math.max(0, progress - burstDelay);
        if (burstAge <= 0) continue;

        // Each burst has 3 concentric rings offset by a small delay
        for (let r = 0; r < 1; r++) {
          const ringAge = Math.max(0, burstAge - r * 0.04);
          if (ringAge <= 0) continue;

          const radius  = ringAge * MAX_R * 0.7;
          // Opacity: rises fast, then decays — also gated by bg fade
          const rawAlpha = Math.sin(ringAge * Math.PI) * 0.28 * (1 - b * 0.05);
          const alpha    = rawAlpha * bgAlpha;
          if (alpha <= 0.005) continue;

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(26,24,20,${alpha.toFixed(3)})`;
          ctx.lineWidth   = 1.5 + (1 - ringAge) * 2;
          ctx.stroke();
        }
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Text animation: fade in at 15%, hold, fade out at 65%
  // We drive this with CSS animation via inline keyframes trick using opacity state
  const TEXT_IN  = 0.15 * TOTAL;  // ms
  const TEXT_OUT = 0.60 * TOTAL;  // ms
  const TEXT_DUR = TEXT_OUT - TEXT_IN;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center',
      pointerEvents:'none',
    }}>
      {/* Ripple canvas */}
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />

      {/* "PROJECT PLAY" wordmark — fades in then out via CSS animation */}
      <div style={{
        position:'relative', zIndex:1, textAlign:'center',
        animation: `splashText ${TOTAL}ms ease forwards`,
      }}>
        <div style={{
          fontFamily:"'Space Mono',monospace", fontWeight:400,
          fontSize:'clamp(13px,1.6vw,20px)', letterSpacing:'0.12em',
          lineHeight:1, display:'flex', alignItems:'baseline', gap:'0.35em',
          justifyContent:'center',
        }}>
          <span style={{ color:INK }}>PROJECT</span>
          <span style={{ color:ACCENT }}>PLAY</span>
        </div>
      </div>

      {/* Inject keyframes once */}
      <style>{`
        @keyframes splashText {
          0%   { opacity: 0; transform: scale(0.96); }
          15%  { opacity: 0; transform: scale(0.96); }
          28%  { opacity: 1; transform: scale(1);    }
          62%  { opacity: 1; transform: scale(1);    }
          80%  { opacity: 0; transform: scale(1.03); }
          100% { opacity: 0; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const l = document.createElement('link');
    l.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap';
    l.rel = 'stylesheet'; document.head.appendChild(l);
    const s = document.createElement('style');
    s.textContent = `
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      html{scroll-behavior:smooth;}
      body{overflow-x:hidden;background:#F5F2EC;}
      ::selection{background:rgba(245,127,182,0.18);}
      input::placeholder{color:rgba(26,24,20,0.22);}
    `;
    document.head.appendChild(s);
  }, []);

  return (
    <div style={{ background:BG }}>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <Nav /><Hero /><Features /><Vision /><UseCases /><Signup /><Footer />
    </div>
  );
}
