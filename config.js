/**
 * API base for the Kakapo Python proxy (no trailing slash).
 * Default: CloudFront → ALB. Local uvicorn: ?api=http://127.0.0.1:8000 or localStorage.kakapo_api_base.
 */
(function () {
  var q = new URLSearchParams(window.location.search).get('api');
  var ls = localStorage.getItem('kakapo_api_base');
  var defaultBase = 'https://d3msaxyuekquhy.cloudfront.net';
  var base = (q || ls || defaultBase).replace(/\/$/, '');
  window.KAKAPO_API_BASE = base;
  if (q) localStorage.setItem('kakapo_api_base', base);

  /** Set on successful local dev sign-in; dashboard serves API fixtures without the Python proxy. */
  window.KAKAPO_DEV_SESSION_TOKEN = 'kakapo_local_dev_session';
})();
