/**
 * API base for the Kakapo Python proxy (no trailing slash).
 * Default: dev ALB over HTTP (matches working curl). If the HTML is served over HTTPS
 * (e.g. Amplify), the browser blocks fetch() to http:// — use ?api= with an HTTPS API or a proxy.
 * Local: ?api=http://127.0.0.1:8000  or  localStorage.setItem('kakapo_api_base', 'http://127.0.0.1:8000')
 *
 * The same bootstrap is inlined in login.html, dashboard.html, and demo.html so production
 * works even when the static host does not serve /config.js. Change defaults in all four places.
 */
(function () {
  var q = new URLSearchParams(window.location.search).get('api');
  var ls = localStorage.getItem('kakapo_api_base');
  var defaultBase = 'http://kakapo-dev-alb-2083012355.ap-south-1.elb.amazonaws.com';
  var base = (q || ls || defaultBase).replace(/\/$/, '');
  window.KAKAPO_API_BASE = base;
  if (q) localStorage.setItem('kakapo_api_base', base);

  /** Set on successful local dev sign-in; dashboard serves API fixtures without the Python proxy. */
  window.KAKAPO_DEV_SESSION_TOKEN = 'kakapo_local_dev_session';
})();
