import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

let cachedHasUploads = false;

export const useHasUploads = () => {
    const { user } = useAuth();
    const [hasUploads, setHasUploads] = useState(cachedHasUploads);

    useEffect(() => {
        if (!user?.id) {
            cachedHasUploads = false;
            setHasUploads(false);
            return undefined;
        }

        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch('/api/uploads', {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (cancelled) return;
                const next = Array.isArray(payload.uploads) && payload.uploads.length > 0;
                cachedHasUploads = next;
                setHasUploads(next);
            } catch {
                if (!cancelled) setHasUploads(cachedHasUploads);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    return hasUploads;
};
