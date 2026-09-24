import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/email-automation-original.wav");
mkdirSync(dirname(target), {recursive: true});

const sampleRate = 44_100;
const duration = 60;
const channels = 2;
const samples = sampleRate * duration;
const pcm = Buffer.alloc(samples * channels * 2);
const bpm = 128;
const beat = 60 / bpm;
const roots = [110, 82.41, 130.81, 98]; // A2, E2, C3, G2
const melody = [2, 2.25, 2.5, 3, 2.5, 2.25, 2, 1.5];
let noise = 0x28ad91f3;

const clamp = (value) => Math.max(-1, Math.min(1, value));
const saw = (phase) => 2 * (phase - Math.floor(phase + 0.5));
const pulse = (phase, width = 0.5) => (phase % 1 < width ? 1 : -1);
const env = (time, decay) => Math.exp(-time * decay);

for (let i = 0; i < samples; i += 1) {
  const t = i / sampleRate;
  const beatIndex = Math.floor(t / beat);
  const beatPhaseSeconds = t % beat;
  const beatPhase = beatPhaseSeconds / beat;
  const eighth = beat / 2;
  const eighthPhase = (t % eighth) / eighth;
  const bar = Math.floor(beatIndex / 4);
  const rootFrequency = roots[bar % roots.length];
  const intro = t < 8;
  const build = t >= 8 && t < 16;
  const dropOne = t >= 16 && t < 32;
  const breakDown = t >= 32 && t < 40;
  const dropTwo = t >= 40 && t < 56;
  const outro = t >= 56;
  const drop = dropOne || dropTwo;

  // Four-on-the-floor kick with pitch drop and a deeper transient during the drops.
  const kickPitch = 84 * Math.exp(-beatPhaseSeconds * 22) + 43;
  const kick = Math.sin(Math.PI * 2 * kickPitch * beatPhaseSeconds) * env(beatPhaseSeconds, 16) * (drop ? 0.72 : build ? 0.48 : 0.34);
  const sidechain = drop ? 0.28 + 0.72 * Math.min(1, beatPhase * 2.8) : 0.9;

  // Wide supersaw chords, introduced in the build and opened fully at each drop.
  const chordGain = intro ? 0.06 + t / 8 * 0.05 : build ? 0.12 + (t - 8) / 8 * 0.12 : drop ? 0.28 : breakDown ? 0.11 : 0.08;
  const chordTones = [1, 1.1892, 1.4983];
  let chordLeft = 0;
  let chordRight = 0;
  for (const tone of chordTones) {
    chordLeft += saw(t * rootFrequency * tone * 2 * 0.996) + 0.7 * saw(t * rootFrequency * tone * 2 * 1.004);
    chordRight += saw(t * rootFrequency * tone * 2 * 1.003) + 0.7 * saw(t * rootFrequency * tone * 2 * 0.997);
  }
  chordLeft *= chordGain / 7 * sidechain;
  chordRight *= chordGain / 7 * sidechain;

  // Syncopated bass and a bright lead motif for a recognizable drop.
  const bassGate = eighthPhase < 0.68 ? env(eighthPhase, 1.4) : 0;
  const bass = (Math.sin(Math.PI * 2 * rootFrequency / 2 * t) * 0.7 + saw(t * rootFrequency / 2) * 0.3) * bassGate * (drop ? 0.34 : 0.12) * sidechain;
  const leadFrequency = rootFrequency * melody[Math.floor(t / eighth) % melody.length];
  const leadEnvelope = env((t % eighth), drop ? 8 : 13);
  const leadGain = drop ? 0.17 : build ? 0.09 : breakDown ? 0.07 : 0.035;
  const lead = (pulse(t * leadFrequency, 0.46) * 0.55 + Math.sin(Math.PI * 2 * leadFrequency * t) * 0.45) * leadEnvelope * leadGain * sidechain;

  // Snare/clap on beats two and four; energetic off-beat hats in both drops.
  noise = (noise * 1664525 + 1013904223) >>> 0;
  const white = noise / 0xffffffff * 2 - 1;
  const snareBeat = beatIndex % 4;
  const clap = (snareBeat === 1 || snareBeat === 3) && beatPhaseSeconds < 0.13 ? white * env(beatPhaseSeconds, 28) * (drop ? 0.24 : 0.13) : 0;
  const hatPhase = (t + beat / 2) % beat;
  const hat = hatPhase < 0.055 ? white * env(hatPhase, 72) * (drop ? 0.11 : build ? 0.075 : 0.025) : 0;
  const shakerPhase = t % (beat / 4);
  const shaker = drop && shakerPhase < 0.025 ? white * env(shakerPhase, 110) * 0.045 : 0;

  // White-noise risers pull the build into the drops at 16s and 40s.
  const nextDrop = t < 16 ? 16 : t < 40 ? 40 : 64;
  const riseDistance = nextDrop - t;
  const riser = riseDistance > 0 && riseDistance < 8 ? white * Math.pow(1 - riseDistance / 8, 2) * 0.16 : 0;
  const impactDistance = Math.min(Math.abs(t - 16), Math.abs(t - 40));
  const impact = impactDistance < 0.7 ? white * env(impactDistance, 8) * 0.13 : 0;

  const master = intro ? 0.78 : outro ? Math.max(0, (60 - t) / 4) : 0.88;
  const left = clamp((kick + bass + chordLeft + lead * 0.78 + clap + hat + shaker + riser + impact) * master);
  const right = clamp((kick + bass + chordRight + lead + clap + hat * 0.85 + shaker + riser + impact) * master);
  pcm.writeInt16LE(Math.round(left * 32767), i * 4);
  pcm.writeInt16LE(Math.round(right * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * channels * 2, 28); header.writeUInt16LE(channels * 2, 32);
header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
writeFileSync(target, Buffer.concat([header, pcm]));
console.log(`Generated ${target} (${duration}s stereo EDM, original synthesis, no samples)`);
