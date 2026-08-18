export const BOTTOM_CHROME_SELECTOR = '[data-cp-bottom-chrome]';

const isHidden = (element, win) => {
    if (!element) return true;
    const style = win.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden';
};

export const getBottomChromeLimit = (win = window, doc = document) => {
    const visual = win.visualViewport;
    const viewportBottom = visual
        ? visual.offsetTop + visual.height
        : win.innerHeight;
    const chrome = doc.querySelector(BOTTOM_CHROME_SELECTOR);
    if (isHidden(chrome, win)) return viewportBottom;
    return Math.min(chrome.getBoundingClientRect().top, viewportBottom);
};
