export const isLiveTutorUiEnabled = () =>
    String(import.meta.env.VITE_LIVE_TUTOR_ENABLED || '').trim() === 'true';
