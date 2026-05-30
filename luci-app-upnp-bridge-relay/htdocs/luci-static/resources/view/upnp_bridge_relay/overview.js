'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';

var callStatus = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'status',
	expect: { '': {} }
});

var callSyncNow = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'sync-now',
	expect: { '': {} }
});

var callClear = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'clear',
	expect: { '': {} }
});

function callInitAction(action) {
	return rpc.declare({
		object: 'luci',
		method: 'setInitAction',
		params: ['name', 'action'],
		expect: { result: false }
	})('upnp_bridge_relay', action);
}

return view.extend({
	load: function() {
		return Promise.all([
			callStatus(),
			uci.load('upnp_bridge_relay')
		]).then(function(results) {
			return results[0];
		});
	},

	render: function(status) {
		var m, s, o;
		var running = status.running || false;
		var lastSync = status.last_sync || '-';
		var lastResult = status.last_result || '-';
		var readCount = status.read_count || 0;
		var acceptedCount = status.accepted_count || 0;
		var rejectedCount = status.rejected_count || 0;
		var failureCount = status.failure_count || 0;
		var backend = status.backend || uci.get('upnp_bridge_relay', 'main', 'backend') || '-';
		var nftStatus = status.nft_table_status || '-';
		var openclashStatus = status.openclash_status || '-';

		m = new form.Map('upnp_bridge_relay', _('UPnP Bridge Relay - Overview'));

		s = m.section(form.TypedSection, 'service', _('Service Status'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_running', _('Service Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (running) {
				return '<span style="color:green;font-weight:bold">&#9679; Running</span>';
			} else {
				return '<span style="color:red;font-weight:bold">&#9679; Stopped</span>';
			}
		};

		o = s.option(form.DummyValue, '_version', _('Plugin Version'));
		o.cfgvalue = function() {
			return status.version || '-';
		};

		o = s.option(form.DummyValue, '_last_sync', _('Last Sync Time'));
		o.cfgvalue = function() {
			return lastSync;
		};

		o = s.option(form.DummyValue, '_last_result', _('Last Sync Result'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (lastResult === 'success') {
				return '<span style="color:green">' + lastResult + '</span>';
			} else if (lastResult === '-') {
				return '-';
			} else {
				return '<span style="color:red">' + lastResult + '</span>';
			}
		};

		o = s.option(form.DummyValue, '_read_count', _('Read Mappings'));
		o.cfgvalue = function() {
			return String(readCount);
		};

		o = s.option(form.DummyValue, '_accepted_count', _('Synced Mappings'));
		o.cfgvalue = function() {
			return String(acceptedCount);
		};

		o = s.option(form.DummyValue, '_rejected_count', _('Rejected Mappings'));
		o.cfgvalue = function() {
			return String(rejectedCount);
		};

		o = s.option(form.DummyValue, '_failure_count', _('Consecutive Failures'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (failureCount > 0) {
				return '<span style="color:red;font-weight:bold">' + failureCount + '</span>';
			}
			return String(failureCount);
		};

		o = s.option(form.DummyValue, '_backend', _('Current Backend'));
		o.cfgvalue = function() {
			return backend;
		};

		o = s.option(form.DummyValue, '_nft_status', _('nftables Table Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (nftStatus === 'present') {
				return '<span style="color:green">&#10004; Present</span>';
			} else if (nftStatus === '-') {
				return '-';
			} else {
				return '<span style="color:orange">' + nftStatus + '</span>';
			}
		};

		o = s.option(form.DummyValue, '_openclash_status', _('OpenClash Compatibility'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (openclashStatus === 'running') {
				return '<span style="color:green">&#10004; Running</span>';
			} else if (openclashStatus === 'installed') {
				return '<span style="color:orange">&#9888; Installed (Stopped)</span>';
			} else if (openclashStatus === 'not_installed') {
				return '<span style="color:gray">' + _('Not Installed') + '</span>';
			} else if (openclashStatus === '-') {
				return '-';
			} else {
				return '<span style="color:orange">' + openclashStatus + '</span>';
			}
		};

		s = m.section(form.TypedSection, 'service', _('Service Control'));
		s.anonymous = true;

		o = s.option(form.Button, '_start', _('Start Service'));
		o.inputtitle = _('Start');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var enabled = uci.get('upnp_bridge_relay', 'main', 'enabled');
			var chain = L.resolve();

			if (enabled !== '1') {
				uci.set('upnp_bridge_relay', 'main', 'enabled', '1');
				chain = chain.then(function() { return uci.save(); })
					.then(function() { return uci.apply(); });
			}

			return chain.then(function() {
				return callInitAction('start');
			}).then(function() {
				ui.addNotification(null, E('p', _('Service started.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to start service: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_stop', _('Stop Service'));
		o.inputtitle = _('Stop');
		o.inputstyle = 'reset';
		o.onclick = function() {
			return callInitAction('stop').then(function() {
				ui.addNotification(null, E('p', _('Service stopped.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to stop service: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_restart', _('Restart Service'));
		o.inputtitle = _('Restart');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callInitAction('restart').then(function() {
				ui.addNotification(null, E('p', _('Service restarted.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to restart service: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_sync_now', _('Sync Now'));
		o.inputtitle = _('Sync Now');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callSyncNow().then(function(result) {
				var msg = _('Sync triggered.');
				if (result && result.success === true) {
					msg = _('Sync completed successfully.');
				} else if (result && result.success === false) {
					msg = _('Sync failed: ') + (result.error || 'unknown');
				}
				ui.addNotification(null, E('p', msg), result && result.success ? 'info' : 'warning');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Sync failed: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_clear', _('Clear Dynamic Rules'));
		o.inputtitle = _('Clear Rules');
		o.inputstyle = 'reset';
		o.onclick = function() {
			return callClear().then(function(result) {
				ui.addNotification(null, E('p', _('Dynamic rules cleared.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to clear rules: ') + e.message), 'error');
			});
		};

		return m.render();
	}
});
