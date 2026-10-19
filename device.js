(() => {
  const mobile = navigator.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    ((navigator.platform === 'MacIntel' || /Macintosh/.test(navigator.userAgent)) && navigator.maxTouchPoints > 1);
  // Touch-enabled computers keep the complete desktop exhibition.
  window.beijianDevice = Object.freeze({
    mobile,
    reducedQuery: mobile ? '(prefers-reduced-motion:reduce)' : 'not all',
    mobileQuery: mobile ? '(max-width:800px), (max-width:1100px) and (pointer:coarse)' : 'not all',
    desktopQuery: mobile ? 'not all' : 'all'
  });
  document.documentElement.classList.add(mobile ? 'is-mobile-device' : 'is-desktop-device');
})();
