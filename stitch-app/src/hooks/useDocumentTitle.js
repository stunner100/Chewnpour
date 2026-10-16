import { useEffect } from 'react';
import { formatDocumentTitle } from '../lib/documentTitle';

// Names the tab after the page's subject once it is known ("Cell Theory · ChewnPour").
// The route default from resolveRouteTitle stays until then.
export const useDocumentTitle = (name) => {
    useEffect(() => {
        const text = String(name || '').trim();
        if (!text || typeof document === 'undefined') return;
        document.title = formatDocumentTitle(text);
    }, [name]);
};

export default useDocumentTitle;
