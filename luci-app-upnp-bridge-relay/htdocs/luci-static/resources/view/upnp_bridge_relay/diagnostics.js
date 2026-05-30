'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';
'require fs';

var callStatus = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'status',
	expect: { '': {} }
});

var callCheckEnv = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'check-env',
	expect: { '': {} }
});

var callCheckNetwork = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'check-network',
	expect: { '': {} }
});

var callRollback = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'rollback',
	expect: { '': {} }
});

var callClear = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'clear',
	expect: { '': {} }
});

var callRemoveOpenclashRule = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'remove-openclash-rule',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('upnp_bridge_relay'),
			callStatus(),
			callCheckEnv()
		]).then(function(results) {
			return {
				status: results[1],
				env: results[2]
			};
		});
	},

	render: function(data) {
		var status = data.status || {};
		var env = data.env || {};

		var container = E('div', { 'class': 'cbi-map' });

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('UPnP Bridge Relay - Diagnostics & Rollback')));

		container.appendChild(E('h3', {}, _('Environment Detection')));
		var envSection = E('div', { 'class': 'cbi-section' });

		var envItems = [
			{ label: _('OpenWrt Version'), value: env.openwrt_version || '-' },
			{ label: _('Package Manager'), value: env.package_manager || '-', warn: env.package_manager === 'unknown' },
			{ label: _('Firewall'), value: env.firewall || '-', warn: env.firewall !== 'fw4' },
			{ label: _('nft'), value: env.nft ? _('Installed') : _('Missing'), warn: !env.nft },
			{ label: _('upnpc'), value: env.upnpc ? _('Installed') : _('Missing'), warn: !env.upnpc },
			{ label: _('LuCI'), value: env.luci ? _('Installed') : _('Missing'), warn: !env.luci },
			{ label: _('OpenClash'), value: env.openclash_installed ? (env.openclash_running ? _('Running') : _('Installed (Stopped)')) : _('Not Installed'), warn: false }
		];

		var envTable = E('table', { 'class': 'table' }, [
			E('thead', {}, E('tr', {}, [
				E('th', {}, _('Item')),
				E('th', {}, _('Value'))
			]))
		]);

		for (var i = 0; i < envItems.length; i++) {
			var item = envItems[i];
			var valueHtml = item.warn ?
				'<span style="color:red;font-weight:bold">' + item.value + '</span>' :
				'<span style="color:green">' + item.value + '</span>';
			envTable.appendChild(E('tr', {}, [
				E('td', {}, item.label),
				E('td', { 'innerHTML': valueHtml })
			]));
		}
		envSection.appendChild(envTable);

		var envBtnBar = E('div', { 'style': 'margin-top:1em;display:flex;gap:1em' });
		envBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				return callCheckEnv().then(function(result) {
					ui.addNotification(null, E('p', _('Environment detection completed.')), 'info');
					window.location.reload();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Detection failed: ') + e.message), 'error');
				});
			}
		}, _('Run Environment Check')));
		envSection.appendChild(envBtnBar);
		container.appendChild(envSection);

		container.appendChild(E('h3', {}, _('Network Detection')));
		var netSection = E('div', { 'class': 'cbi-section' });
		var netTable = E('table', { 'class': 'table', 'id': 'network-check-table' }, [
			E('thead', {}, E('tr', {}, [
				E('th', {}, _('Check Item')),
				E('th', {}, _('Result'))
			]))
		]);
		netTable.appendChild(E('tr', {}, [
			E('td', { 'colspan': '2' }, _('Click "Run Network Check" to detect network status.'))
		]));
		netSection.appendChild(netTable);

		var netBtnBar = E('div', { 'style': 'margin-top:1em;display:flex;gap:1em' });
		netBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				return callCheckNetwork().then(function(result) {
					var tbody = netTable;
					while (tbody.rows.length > 1) {
						tbody.deleteRow(1);
					}

					var checks = [
						{ label: _('Bind Interface'), key: 'iface_exists' },
						{ label: _('Bind IP'), key: 'bind_ip_configured' },
						{ label: _('Downstream LAN Gateway'), key: 'gateway_reachable' },
						{ label: _('UPnP IGD Read'), key: 'upnpc_readable' },
						{ label: _('Downstream WAN IP'), key: 'wan_ip_reachable' },
						{ label: _('Upstream WAN Interface'), key: 'upstream_wan_exists' },
						{ label: _('Default Route Risk'), key: 'default_route_on_bind' },
						{ label: _('Extra Forwarding'), key: 'bad_forwarding' }
					];

					var riskKeys = { 'default_route_on_bind': true, 'bad_forwarding': true };

					for (var i = 0; i < checks.length; i++) {
						var check = checks[i];
						var val = result[check.key];
						var isRisk = riskKeys[check.key];
						var statusHtml;
						if (isRisk) {
							if (val === 1 || val === true) {
								statusHtml = '<span style="color:orange">&#9888; ' + _('Warning') + '</span>';
							} else if (val === 0 || val === false) {
								statusHtml = '<span style="color:green">&#10004; ' + _('OK') + '</span>';
							} else {
								statusHtml = '<span style="color:gray">' + (val || '-') + '</span>';
							}
						} else {
							if (val === 1 || val === 'ok' || val === true) {
								statusHtml = '<span style="color:green">&#10004; ' + _('OK') + '</span>';
							} else if (val === 0 || val === false || val === 'fail' || val === 'missing') {
								statusHtml = '<span style="color:red">&#10008; ' + _('Failed') + '</span>';
							} else if (val === 'warn') {
								statusHtml = '<span style="color:orange">&#9888; ' + _('Warning') + '</span>';
							} else {
								statusHtml = '<span style="color:gray">' + (val || '-') + '</span>';
							}
						}
						tbody.appendChild(E('tr', {}, [
							E('td', {}, check.label),
							E('td', { 'innerHTML': statusHtml })
						]));
					}
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Network check failed: ') + e.message), 'error');
				});
			}
		}, _('Run Network Check')));
		netSection.appendChild(netBtnBar);
		container.appendChild(netSection);

		container.appendChild(E('h3', {}, _('Recent Logs')));
		var logSection = E('div', { 'class': 'cbi-section' });
		var logArea = E('pre', {
			'id': 'log-area',
			'style': 'max-height:300px;overflow-y:auto;padding:1em;background:#1a1a1a;color:#0f0;font-size:0.85em;border-radius:4px'
		}, _('Click "View Logs" to load recent logs.'));

		var logBtnBar = E('div', { 'style': 'margin-bottom:1em;display:flex;gap:1em' });
		logBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				return fs.exec_direct('/usr/bin/logread', ['-e', 'upnp-bridge-relay']).then(function(logData) {
					logArea.textContent = logData || _('No logs found.');
				}).catch(function(e) {
					logArea.textContent = _('Failed to read logs: ') + e.message;
				});
			}
		}, _('View Logs')));
		logSection.appendChild(logBtnBar);
		logSection.appendChild(logArea);

		if (status.last_error) {
			logSection.appendChild(E('div', { 'style': 'margin-top:1em;padding:0.5em;background:#f2dede;border:1px solid #ebccd1;border-radius:4px' },
				E('p', {}, _('Last Error: ') + status.last_error)));
		}
		container.appendChild(logSection);

		container.appendChild(E('h3', {}, _('Missing Dependencies & Fix Commands')));
		var depSection = E('div', { 'class': 'cbi-section' });
		var missingDeps = [];
		if (!env.nft) missingDeps.push('nftables');
		if (!env.upnpc) missingDeps.push('miniupnpc');

		if (missingDeps.length > 0) {
			var pkgMgr = env.package_manager || 'opkg';
			var installCmd = pkgMgr === 'apk' ?
				'apk add ' + missingDeps.join(' ') :
				'opkg install ' + missingDeps.join(' ');

			depSection.appendChild(E('p', { 'style': 'color:red' },
				_('Missing dependencies: ') + missingDeps.join(', ')));
			depSection.appendChild(E('pre', {
				'style': 'padding:1em;background:#f5f5f5;border:1px solid #ddd;border-radius:4px'
			}, installCmd));
		} else {
			depSection.appendChild(E('p', { 'style': 'color:green' }, _('All dependencies are installed.')));
		}
		container.appendChild(depSection);

		container.appendChild(E('h3', {}, _('Rollback & Cleanup')));
		var rollbackSection = E('div', { 'class': 'cbi-section' });

		rollbackSection.appendChild(E('p', { 'style': 'color:orange;font-weight:bold' },
			_('Warning: Rollback operations will remove configurations created by this plugin. Proceed with caution.')));

		var rollbackBtnBar = E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:1em' });

		rollbackBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Are you sure you want to undo all initialization? This will remove all plugin-created configurations (interface, zone, OpenClash rules, nftables rules).')))
					return;
				return callRollback().then(function() {
					return callClear();
				}).then(function() {
					ui.addNotification(null, E('p', _('All plugin configurations and rules have been removed.')), 'info');
					window.location.reload();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Rollback failed: ') + e.message), 'error');
				});
			}
		}, _('Undo All Initialization')));

		rollbackBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Remove OpenClash rules created by this plugin?')))
					return;
				return callRemoveOpenclashRule().then(function() {
					ui.addNotification(null, E('p', _('OpenClash rules removed.')), 'info');
					window.location.reload();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed: ') + e.message), 'error');
				});
			}
		}, _('Remove OpenClash Rules')));

		rollbackBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Clear all dynamic nftables rules?')))
					return;
				return callClear().then(function() {
					ui.addNotification(null, E('p', _('Dynamic rules cleared.')), 'info');
					window.location.reload();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed: ') + e.message), 'error');
				});
			}
		}, _('Clear nftables Rules')));

		rollbackSection.appendChild(rollbackBtnBar);
		container.appendChild(rollbackSection);

		var cleanupAllBar = E('div', { 'class': 'cbi-section', 'style': 'margin-top:1em' });
		cleanupAllBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-remove',
			'style': 'background:#d9534f;color:white',
			'click': function() {
				if (!confirm(_('WARNING: This will remove ALL plugin-created configurations, rules, and restore backups. Are you sure?')))
					return;
				return callRollback().then(function() {
					return callClear();
				}).then(function() {
					ui.addNotification(null, E('p', _('All plugin configurations and rules have been cleaned up.')), 'info');
					window.location.reload();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Cleanup failed: ') + e.message), 'error');
				});
			}
		}, _('Cleanup All')));
		container.appendChild(cleanupAllBar);

		return container;
	}
});
