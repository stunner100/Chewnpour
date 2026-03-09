import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await fs.readFile(path.join(root, "src/lib/useVoicePlayback.js"), "utf8");

for (const pattern of [
  "const blockedByAutoplayRef = useRef(false);",
  "if (isMobileBrowser && blockedByAutoplayRef.current && activeAudioRef.current) {",
  "const blockedAudio = activeAudioRef.current;",
  "await blockedAudio.play();",
  "blockedByAutoplayRef.current = true;",
  "blockedByAutoplayRef.current = false;",
  "audio.loop = true;",
  "audio.muted = true;",
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected mobile autoplay retry hardening to include \"${pattern}\".`);
  }
}

console.log("voice-mobile-autoplay-retry-regression.test.mjs passed");
