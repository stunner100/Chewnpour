import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = async (relativePath) =>
  fs.readFile(path.join(root, relativePath), "utf8");

const source = await read("src/lib/useVoicePlayback.js");

for (const pattern of [
  "const isLikelyAutoplayPolicyErrorMessage = (message) => {",
  "/not\\s+allowed/i,",
  "/denied permission/i,",
  "const isLikelyMobileBrowser = () => {",
  "navigator.userAgentData && navigator.userAgentData.mobile",
  "const platform = String(navigator.platform || \"\").toLowerCase();",
  "const maxTouchPoints = Number(navigator.maxTouchPoints || 0);",
  "if (platform === \"macintel\" && maxTouchPoints > 1) return true;",
  "window.matchMedia(\"(pointer: coarse)\").matches",
  "const canCreateAudioElement = () => {",
  "const createAudioElement = (src) => {",
  "const speechStartTimeoutMs = useMemo(() => (isMobileBrowser ? 9000 : 2000), [isMobileBrowser]);",
  "const maxSpeechStartRetries = useMemo(() => (isMobileBrowser ? 2 : 1), [isMobileBrowser]);",
  "const unlockAudioOutput = useCallback(() => {",
  "const unlockSpeechSynthesisOutput = useCallback(() => {",
  "const fetchRemoteAudioBlobUrl = useCallback(async (streamUrl) => {",
  "window.AudioContext || window.webkitAudioContext",
  "const audio = createAudioElement(sourceUrl);",
  "const sourceUrl = isMobileBrowser",
  "activeAudioObjectUrlRef.current = sourceUrl;",
  "audio.crossOrigin = \"anonymous\";",
  "audio.playsInline = true;",
  "if (retryFirstChunk(\"First utterance did not start\")) {",
  "Voice did not start on mobile. Turn off silent mode, raise media volume, then tap Play again.",
  "if (isMobileBrowser) {",
  "setError(remoteMessage);",
  "if (isLikelyAutoplayPolicyErrorMessage(remoteMessage)) {",
  "const hasBrowserVoiceFallback = Boolean(hasSpeechSynthesis && synthesisRef.current);",
  "remotePlaybackDisabledRef.current = true;",
  "AI voice blocked by autoplay/permission policy. Falling back to browser voice.",
  "setError(\"Audio was blocked by your mobile browser. Tap Play again.\");",
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected mobile voice playback hardening to include \"${pattern}\".`);
  }
}

console.log("voice-mobile-playback-regression.test.mjs passed");
