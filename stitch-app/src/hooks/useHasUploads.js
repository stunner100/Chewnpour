import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useHasUploads = () => {
    const { user } = useAuth();
    const [hasUploads, setHasUploads] = useState(false);

    useEffect(() => {
        if (!user?.id) {
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
                setHasUploads(Array.isArray(payload.uploads) && payload.uploads.length > 0);
            } catch {
                if (!cancelled) setHasUploads(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    return hasUploads;
};
