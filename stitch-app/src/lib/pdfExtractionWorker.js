/**
 * Web Worker for PDF text extraction.
 * Runs PDF.js page-by-page text extraction off the main thread
 * to prevent UI blocking during file upload.
 */

let pdfWorkerInitialized = false;

self.onmessage = async (event) => {
    const { arrayBuffer } = event.data;

    try {
        const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
        if (!pdfWorkerInitialized) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/build/pdf.worker.min.mjs',
                import.meta.url
            ).toString();
            pdfWorkerInitialized = true;
        }

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const MAX_CLIENT_PAGES = 300;
        const maxPages = Math.min(pdf.numPages, MAX_CLIENT_PAGES);
        const parts = [];

        for (let i = 1; i <= maxPages; i += 1) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items
                .map((item) => (typeof item.str === 'string' ? item.str : ''))
                .join(' ');
            parts.push(pageText);
        }

        self.postMessage({ success: true, text: parts.join('\n').trim() });
    } catch (error) {
        self.postMessage({ success: false, error: error.message || 'PDF extraction failed' });
    }
};
