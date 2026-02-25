import assert from "node:assert/strict";
import {
    GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE,
    normalizeRemotePlaybackErrorMessage,
    shouldDisableRemotePlaybackForSession,
} from "../src/lib/voicePlaybackErrors.js";

const convexWrappedMessage =
    "[CONVEX A(ai:synthesizeTopicVoice)] [Request ID: b2f203fb2de17c3c] Server Error Called by client";

assert.equal(
    normalizeRemotePlaybackErrorMessage(convexWrappedMessage),
    GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE,
    "Expected wrapped Convex server errors to normalize to a user-safe generic message."
);

const paymentRequiredMessage =
    'ElevenLabs TTS request failed (402): {"detail":{"status":"payment_required","message":"upgrade required"}}';
assert.equal(
    shouldDisableRemotePlaybackForSession(paymentRequiredMessage),
    true,
    "Expected payment-required failures to disable remote playback for the current session."
);

const unusualActivityMessage =
    'ElevenLabs TTS request failed (401): {"detail":{"status":"detected_unusual_activity"}}';
assert.equal(
    shouldDisableRemotePlaybackForSession(unusualActivityMessage),
    true,
    "Expected unusual-activity failures to disable remote playback for the current session."
);

assert.equal(
    shouldDisableRemotePlaybackForSession("socket timeout"),
    false,
    "Expected transient network failures to remain retryable."
);

console.log("voice-playback-errors-regression tests passed");
