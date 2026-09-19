import { rmsFromByteTimeDomain, rmsFromFloat32, voiceLevelFromRms } from '@/lib/liveTutorEnergy';

const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;

const floatTo16BitPcm = (float32) => {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    for (let index = 0; index < float32.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, float32[index]));
        view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return buffer;
};

const downsample = (float32, inputRate, outputRate) => {
    if (inputRate === outputRate) return float32;
    const ratio = inputRate / outputRate;
    if (!Number.isFinite(ratio) || ratio <= 0) return float32;
    const length = Math.max(1, Math.floor(float32.length / ratio));
    const result = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
        result[index] = float32[Math.min(float32.length - 1, Math.floor(index * ratio))];
    }
    return result;
};

export const pcm16BufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const slice = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
};

export const base64ToInt16 = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Int16Array(bytes.buffer);
};

export const startMicCapture = async ({ onPcmBase64, onLevel } = {}) => {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
        },
    });
    const audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const silent = audioContext.createGain();
    silent.gain.value = 0;
    processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        onLevel?.(voiceLevelFromRms(rmsFromFloat32(input)));
        const resampled = downsample(input, audioContext.sampleRate, INPUT_SAMPLE_RATE);
        const pcm = floatTo16BitPcm(resampled);
        onPcmBase64?.(pcm16BufferToBase64(pcm));
    };
    source.connect(processor);
    processor.connect(silent);
    silent.connect(audioContext.destination);

    return {
        sampleRate: INPUT_SAMPLE_RATE,
        stop: async () => {
            processor.onaudioprocess = null;
            processor.disconnect();
            source.disconnect();
            silent.disconnect();
            stream.getTracks().forEach((track) => track.stop());
            if (audioContext.state !== 'closed') {
                await audioContext.close();
            }
        },
    };
};

export const createPcmPlayer = ({
    sampleRate = OUTPUT_SAMPLE_RATE,
    onLevel,
    onIdle,
} = {}) => {
    const audioContext = new AudioContext({ sampleRate });
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.18;
    analyser.connect(audioContext.destination);
    const sources = new Set();
    const timeDomain = new Uint8Array(analyser.fftSize);
    let nextTime = 0;
    let utteranceStart = null;
    let closed = false;
    let raf = 0;

    const emitLevel = (level) => {
        if (closed) return;
        onLevel?.(level);
    };

    const stopTick = () => {
        if (!raf) return;
        cancelAnimationFrame(raf);
        raf = 0;
    };

    const tick = () => {
        if (closed) {
            raf = 0;
            return;
        }
        if (sources.size === 0) {
            raf = 0;
            emitLevel(0);
            return;
        }
        analyser.getByteTimeDomainData(timeDomain);
        emitLevel(voiceLevelFromRms(rmsFromByteTimeDomain(timeDomain)));
        raf = requestAnimationFrame(tick);
    };

    const playBase64 = async (base64) => {
        if (!base64 || closed) return;
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        if (closed) return;
        const int16 = base64ToInt16(base64);
        if (!int16.length) return;
        const float32 = new Float32Array(int16.length);
        for (let index = 0; index < int16.length; index += 1) {
            float32[index] = int16[index] / 32768;
        }
        const buffer = audioContext.createBuffer(1, float32.length, sampleRate);
        buffer.getChannelData(0).set(float32);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        source.onended = () => {
            sources.delete(source);
            if (closed) return;
            if (sources.size > 0) return;
            utteranceStart = null;
            stopTick();
            emitLevel(0);
            onIdle?.();
        };
        const now = audioContext.currentTime;
        if (nextTime < now) nextTime = now;
        if (sources.size === 0) utteranceStart = nextTime;
        source.start(nextTime);
        nextTime += buffer.duration;
        sources.add(source);
        if (!raf) raf = requestAnimationFrame(tick);
    };

    const stop = () => {
        stopTick();
        sources.forEach((source) => {
            try {
                source.stop();
            } catch {
                // already stopped
            }
        });
        sources.clear();
        nextTime = audioContext.currentTime;
        utteranceStart = null;
        emitLevel(0);
    };

    const close = async () => {
        closed = true;
        stop();
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    };

    return {
        playBase64,
        stop,
        close,
        isPlaying: () => sources.size > 0,
        getProgress: () => {
            if (closed || utteranceStart == null || sources.size === 0) return 0;
            try {
                const now = audioContext.currentTime;
                const duration = Math.max(0.0001, nextTime - utteranceStart);
                if (now <= utteranceStart) return 0;
                return Math.min(1, (now - utteranceStart) / duration);
            } catch {
                return 0;
            }
        },
    };
};
