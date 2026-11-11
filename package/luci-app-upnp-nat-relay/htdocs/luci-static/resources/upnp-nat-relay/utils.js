'use strict';
'require uci';
'require baseclass';

function safeApply() {
	return uci.apply().catch(function(e) {
		var message = e && e.message ? e.message : String(e);
		if (e === 5 || /\bubus code 5\b/.test(message) || /No data|未收到数据/.test(message))
			return;
		throw e;
	});
}

function setBusy(button, label) {
	if (!button)
		return;
	button.disabled = true;
	button.setAttribute('data-original-title', button.textContent);
	button.textContent = label;
}

function resetBusy(button) {
	if (!button)
		return;
	button.disabled = false;
	button.textContent = button.getAttribute('data-original-title') || button.textContent;
	button.removeAttribute('data-original-title');
}

function reloadSoon(delay) {
	window.setTimeout(function() {
		window.location.reload();
	}, delay || 1200);
}

function waitForServiceReady(callStatus, options) {
	options = options || {};
	var interval = options.interval || 3000;
	var timeout = options.timeout || 120000;
	var startedAt = Date.now();

	function wait(delay) {
		return new Promise(function(resolve) {
			window.setTimeout(resolve, delay);
		});
	}

	function poll() {
		if (options.isActive && !options.isActive())
			return Promise.resolve({});

		return callStatus().then(function(status) {
			status = status || {};
			if (status.running && status.last_result !== 'starting')
				return status;
			if (!status.running && status.last_result === 'stopped')
				return status;
			if (Date.now() - startedAt >= timeout)
				return status;
			return wait(interval).then(poll);
		});
	}

	return poll();
}

function requireSuccess(result) {
	if (!result || result.success !== true)
		throw new Error(result.error || _('service action failed'));
	return result || {};
}

function isTransientXhrError(e) {
	var msg = e && e.message ? e.message : String(e);
	/* LuCI throws these when iOS WebKit / mobile Edge aborts an in-flight
	 * XHR (background throttling, network hiccup, page visibility changes).
	 * They are not real server-side failures and usually succeed on retry.
	 */
	return /aborted by browser|XHR request timed out|NetworkError|Failed to fetch/i.test(msg);
}

function rpcWithRetry(fn, options) {
	options = options || {};
	var retries = options.retries != null ? options.retries : 2;
	var delay = options.delay != null ? options.delay : 800;

	function attempt(remaining) {
		return Promise.resolve()
			.then(fn)
			.catch(function(e) {
				if (remaining > 0 && isTransientXhrError(e)) {
					return new Promise(function(resolve) {
						window.setTimeout(resolve, delay);
					}).then(function() {
						return attempt(remaining - 1);
					});
				}
				throw e;
			});
	}

	return attempt(retries);
}

function loadSharedCSS() {
	if (!document.getElementById('upnp-shared-css')) {
		var link = E('link', {
			'id': 'upnp-shared-css',
			'rel': 'stylesheet',
			'href': L.resource('upnp-nat-relay/upnp-nat-relay.css') + '?v=@PKG_FULL_VERSION@'
		});
		document.head.appendChild(link);
	}
}

return baseclass.extend({
	safeApply: safeApply,
	setBusy: setBusy,
	resetBusy: resetBusy,
	reloadSoon: reloadSoon,
	waitForServiceReady: waitForServiceReady,
	requireSuccess: requireSuccess,
	rpcWithRetry: rpcWithRetry,
	isTransientXhrError: isTransientXhrError,
	loadSharedCSS: loadSharedCSS
});
