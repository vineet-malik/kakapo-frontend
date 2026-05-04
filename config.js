/**
 * API base for the Kakapo Python proxy (no trailing slash).
 * Default: local uvicorn. Override: ?api=… or localStorage.kakapo_api_base.
 * Production (HTTPS UI): set defaultBase to https://YOUR_ID.cloudfront.net in this file and
 * in the inline bootstrap in login.html, dashboard.html, demo.html (see README).
 */
(function () {
  var q = new URLSearchParams(window.location.search).get('api');
  var ls = localStorage.getItem('kakapo_api_base');
  var defaultBase = 'http://127.0.0.1:8000';
  var base = (q || ls || defaultBase).replace(/\/$/, '');
  window.KAKAPO_API_BASE = base;
  if (q) localStorage.setItem('kakapo_api_base', base);

  /** Set on successful local dev sign-in; dashboard serves API fixtures without the Python proxy. */
  window.KAKAPO_DEV_SESSION_TOKEN = 'kakapo_local_dev_session';
})();
