'use strict';
'require uci';

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

function loadSharedCSS() {
	if (!document.getElementById('ubr-shared-css')) {
		var link = E('link', {
			'id': 'ubr-shared-css',
			'rel': 'stylesheet',
			'href': L.resource('upnp-bridge-relay/upnp-bridge-relay.css')
		});
		document.head.appendChild(link);
	}
}

return {
	safeApply: safeApply,
	setBusy: setBusy,
	resetBusy: resetBusy,
	reloadSoon: reloadSoon,
	loadSharedCSS: loadSharedCSS
};
