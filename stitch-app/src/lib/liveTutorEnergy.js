const SILENCE_RMS = 0.003;

export const rmsFromFloat32 = (samples) => {
    if (!samples?.length) return 0;
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) {
        const sample = samples[index];
        sum += sample * sample;
    }
    return Math.sqrt(sum / samples.length);
};

export const rmsFromPcm = (int16) => {
    if (!int16?.length) return 0;
    let sum = 0;
    for (let index = 0; index < int16.length; index += 1) {
        const sample = int16[index] / 32768;
        sum += sample * sample;
    }
    return Math.sqrt(sum / int16.length);
};

export const rmsFromByteTimeDomain = (bytes) => {
    if (!bytes?.length) return 0;
    let sum = 0;
    for (let index = 0; index < bytes.length; index += 1) {
        const sample = (bytes[index] - 128) / 128;
        sum += sample * sample;
    }
    return Math.sqrt(sum / bytes.length);
};

export const voiceLevelFromRms = (rms) => {
    if (!Number.isFinite(rms) || rms < SILENCE_RMS) return 0;
    return Math.min(1, ((rms - SILENCE_RMS) / 0.14) ** 0.62);
};
