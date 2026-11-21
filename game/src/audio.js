// All sound is synthesized live with WebAudio — no audio files, no network. The
// context is created on the first user gesture (browsers forbid sound before one),
// and every call below is a no-op until then, so headless screenshots stay silent.
let ctx = null;
let master = null;
let ambientOn = false;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

/** Call from the first key press or click so later sounds are allowed to play. */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  startAmbient();
}

function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  const c = ensure();
  if (!c) return;
  try {
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch {
    // Sound is decoration: a failure here must never break the game.
  }
}

function noiseBurst(dur, vol, filterFreq, when = 0) {
  const c = ensure();
  if (!c) return;
  try {
    const t = c.currentTime + when;
    const length = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  } catch {
    // Sound is decoration.
  }
}

/** A soft step: quieter and lower while sneaking. */
export function playFootstep(sneaking) {
  if (sneaking) noiseBurst(0.06, 0.05, 500);
  else noiseBurst(0.09, 0.12, 900);
}

/** The alert sting: two rising brass-ish notes when a warden gives chase. */
export function playAlert() {
  tone(220, 0.28, 'sawtooth', 0.16, 0, 330);
  tone(330, 0.34, 'sawtooth', 0.14, 0.14, 440);
  noiseBurst(0.2, 0.08, 2400, 0.05);
}

/** A short suspicious murmur when a warden stops to stare. */
export function playSuspicious() {
  tone(180, 0.18, 'triangle', 0.1, 0, 140);
}

/** The coin's bright clink as it lands and rolls. */
export function playCoin() {
  tone(2093, 0.1, 'sine', 0.14);
  tone(2637, 0.16, 'sine', 0.12, 0.07);
  tone(1568, 0.2, 'sine', 0.08, 0.16);
}

/** The smoke puff: a soft whoosh. */
export function playSmoke() {
  noiseBurst(0.5, 0.18, 700);
}

/** A warm chime when a treasure or the ledger is pocketed. */
export function playPickup(ledger) {
  if (ledger) {
    tone(523, 0.16, 'sine', 0.16);
    tone(659, 0.16, 'sine', 0.16, 0.09);
    tone(784, 0.3, 'sine', 0.18, 0.18);
    tone(1047, 0.4, 'sine', 0.14, 0.27);
  } else {
    tone(880, 0.14, 'sine', 0.14);
    tone(1319, 0.22, 'sine', 0.12, 0.08);
  }
}

/** The win fanfare: a small rising arpeggio over a low drone. */
export function playWin() {
  [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, 0.4, 'triangle', 0.15, i * 0.11));
  tone(131, 1.4, 'sine', 0.12, 0, 131);
}

/** The caught sting: a low falling note. */
export function playCaught() {
  tone(220, 0.7, 'sawtooth', 0.16, 0, 55);
  noiseBurst(0.4, 0.1, 500, 0.05);
}

/** A quiet dusk drone under the whole night: two detuned sines, very soft. */
export function startAmbient() {
  const c = ensure();
  if (!c || ambientOn) return;
  try {
    ambientOn = true;
    const gain = c.createGain();
    gain.gain.value = 0.035;
    gain.connect(master);
    for (const freq of [55, 55.4, 110.3]) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
    }
  } catch {
    // Sound is decoration.
  }
}
