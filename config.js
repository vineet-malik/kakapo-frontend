/**
 * API base for the Kakapo Python proxy (no trailing slash).
 * Override: ?api=http://127.0.0.1:8000  or  localStorage.setItem('kakapo_api_base', 'http://...')
 */
(function () {
  var q = new URLSearchParams(window.location.search).get('api');
  var ls = localStorage.getItem('kakapo_api_base');
  var base = (q || ls || 'http://127.0.0.1:8000').replace(/\/$/, '');
  window.KAKAPO_API_BASE = base;
  if (q) localStorage.setItem('kakapo_api_base', base);
})();
