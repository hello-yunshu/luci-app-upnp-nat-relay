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

var callReadLog = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'read-log',
	expect: { '': {} }
});

var css = `
		.ubr-dashboard { max-width: 100%; }
		.ubr-section {
			margin-bottom: 1.5em;
		}
	.ubr-section h4 {
		margin: 0 0 0.8em 0; padding: 0 0 0.5em 0.6em;
		border-bottom: 1px solid var(--border-color);
		border-left: 3px solid var(--main-color, #0069d9);
		font-size: 1.05em;
	}
	.ubr-badge {
		display: inline-block; padding: 0.15em 0.6em; border-radius: 4px;
		font-size: 0.85em; font-weight: 500;
	}
	.ubr-badge.green { background: color-mix(in srgb, var(--success-color, #3aa657) 15%, transparent); color: var(--success-color, #3aa657); }
	.ubr-badge.red { background: color-mix(in srgb, var(--danger-color, #d94b4b) 15%, transparent); color: var(--danger-color, #d94b4b); }
	.ubr-badge.orange { background: color-mix(in srgb, var(--warning-color, #d89b00) 15%, transparent); color: var(--warning-color, #d89b00); }
	.ubr-badge.gray { background: color-mix(in srgb, var(--warning-color, #d89b00) 15%, transparent); color: var(--warning-color, #d89b00); }
	.ubr-check-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.8em;
	}
		.ubr-check-card {
			padding: 0.8em 1em; border-radius: 6px;
			background: var(--background-color-low, color-mix(in srgb, var(--background-color-high, var(--background-color-a)) 85%, var(--main-color, #0069d9)));
			border: 1px solid var(--border-color);
			display: flex; justify-content: space-between; align-items: center;
		}
	.ubr-check-label { font-size: 0.9em; }
		.ubr-log-area {
			min-height: 16em; max-height: 26em; overflow: auto; padding: 1em;
			background: var(--background-color-low);
			color: inherit;
			font-size: 0.85em; line-height: 1.45; border-radius: 6px;
			border: 1px solid var(--border-color);
			font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
			white-space: pre;
			tab-size: 4;
		}
	.ubr-log-area.is-empty,
	.ubr-log-area.is-loading { color: var(--subtext-color); font-style: italic; }
	.ubr-log-area.is-error { color: var(--danger-color); }
		.ubr-btn-group { display: flex; flex-wrap: wrap; gap: 0.8em; }
		.ubr-danger-zone {
			margin-bottom: 1.5em;
			border-left: 5px solid var(--danger-color, #d94b4b);
		}
	.ubr-danger-zone h4 {
		margin: 0 0 0.8em 0; padding-bottom: 0.5em;
		border-bottom: 1px solid var(--border-color);
		font-size: 1.05em; color: var(--danger-color, #d94b4b);
	}
			.ubr-cmd-box {
				padding: 0.8em 1em; border-radius: 6px;
				background: var(--background-color-low, color-mix(in srgb, var(--background-color-high, var(--background-color-a)) 85%, var(--main-color, #0069d9)));
				border: 1px solid var(--border-color);
				font-family: monospace; font-size: 0.9em;
			}
	`;

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

		var container = E('div', { 'class': 'cbi-map ubr-dashboard' });
		container.appendChild(E('style', {}, css));

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('UPnP Bridge Relay - Diagnostics & Rollback')));

			var envSection = E('div', { 'class': 'cbi-section ubr-section' });
		envSection.appendChild(E('h4', {}, '\u2699 ' + _('Environment Detection')));

		var envTable = E('table', { 'class': 'table' });

		var envItems = [
			{ label: _('OpenWrt Version'), value: env.openwrt_version || '-', status: env.package_manager === 'unknown' ? 'orange' : 'green' },
			{ label: _('Package Manager'), value: env.package_manager || '-', status: env.package_manager === 'unknown' ? 'orange' : 'green' },
			{ label: _('Firewall'), value: env.firewall || '-', status: env.firewall !== 'fw4' ? 'orange' : 'green' },
			{ label: _('nft'), value: env.nft ? '\u2714 ' + _('Installed') : '\u2718 ' + _('Missing'), status: env.nft ? 'green' : 'orange' },
			{ label: _('upnpc'), value: env.upnpc ? '\u2714 ' + _('Installed') : '\u2718 ' + _('Missing'), status: env.upnpc ? 'green' : 'orange' },
			{ label: _('LuCI'), value: env.luci ? '\u2714 ' + _('Installed') : '\u2718 ' + _('Missing'), status: env.luci ? 'green' : 'orange' },
			{
				label: _('OpenClash'),
				value: env.openclash_installed ? (env.openclash_running ? '\u2714 ' + _('Running') : '\u26A0 ' + _('Installed (Stopped)')) : '\u2718 ' + _('Not Installed'),
				status: env.openclash_installed && env.openclash_running ? 'green' : 'orange'
			}
		];

		for (var i = 0; i < envItems.length; i++) {
			var item = envItems[i];
			var badgeClass = 'ubr-badge ' + item.status;
			envTable.appendChild(E('tr', { 'class': 'tr' }, [
				E('th', { 'class': 'th' }, item.label),
				E('td', { 'class': 'td' }, E('span', { 'class': badgeClass }, item.value))
			]));
		}
		envSection.appendChild(envTable);

		var envBtnBar = E('div', { 'class': 'ubr-btn-group', 'style': 'margin-top:1em' });
		envBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				btn.disabled = true;
				btn.textContent = _('Checking...');
				return callCheckEnv().then(function(result) {
					ui.addNotification(null, E('p', _('Environment detection completed. Refresh page to see updated results.')), 'info');
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Detection failed: ') + e.message), 'error');
				}).finally(function() {
					btn.disabled = false;
					btn.textContent = _('Run Environment Check');
				});
			}
		}, '\u21BB ' + _('Run Environment Check')));
		envSection.appendChild(envBtnBar);
		container.appendChild(envSection);

			var netSection = E('div', { 'class': 'cbi-section ubr-section' });
		netSection.appendChild(E('h4', {}, '\u27A4 ' + _('Network Detection')));

		var netGrid = E('div', { 'class': 'ubr-check-grid', 'id': 'network-check-grid' });
		netGrid.appendChild(E('div', {
			'class': 'ubr-check-card',
			'style': 'grid-column: 1 / -1'
		}, E('span', { 'style': 'color:var(--subtext-color, #666)' }, _('Click "Run Network Check" to detect network status.'))));
		netSection.appendChild(netGrid);

		var netBtnBar = E('div', { 'class': 'ubr-btn-group', 'style': 'margin-top:1em' });
		netBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				btn.disabled = true;
				btn.textContent = _('Checking...');
				return callCheckNetwork().then(function(result) {
					var grid = document.getElementById('network-check-grid');
					if (!grid) return;
					grid.innerHTML = '';

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
						var badgeClass, badgeText;

						if (isRisk) {
							if (val === 1 || val === true) {
								badgeClass = 'ubr-badge orange';
								badgeText = '\u26A0 ' + _('Warning');
							} else if (val === 0 || val === false) {
								badgeClass = 'ubr-badge green';
								badgeText = '\u2714 ' + _('OK');
							} else {
								badgeClass = 'ubr-badge orange';
								badgeText = '\u26A0 ' + (val || '-');
							}
						} else {
							if (val === 1 || val === 'ok' || val === true) {
								badgeClass = 'ubr-badge green';
								badgeText = '\u2714 ' + _('OK');
							} else if (val === 0 || val === false || val === 'fail' || val === 'missing') {
								badgeClass = 'ubr-badge red';
								badgeText = '\u2718 ' + _('Failed');
							} else if (val === 'warn') {
								badgeClass = 'ubr-badge orange';
								badgeText = '\u26A0 ' + _('Warning');
							} else {
								badgeClass = 'ubr-badge orange';
								badgeText = '\u26A0 ' + (val || '-');
							}
						}

						var card = E('div', { 'class': 'ubr-check-card' }, [
							E('span', { 'class': 'ubr-check-label' }, check.label),
							E('span', { 'class': badgeClass }, badgeText)
						]);
						grid.appendChild(card);
					}
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Network check failed: ') + e.message), 'error');
				}).finally(function() {
					btn.disabled = false;
					btn.textContent = '\u21BB ' + _('Run Network Check');
				});
			}
		}, '\u21BB ' + _('Run Network Check')));
		netSection.appendChild(netBtnBar);
		container.appendChild(netSection);

		var logSection = E('div', { 'class': 'cbi-section ubr-section' });
		logSection.appendChild(E('h4', {}, '\u2261 ' + _('Recent Logs')));

		var setLogArea = function(text, state) {
			var logArea = document.getElementById('log-area');
			if (!logArea) return;

			logArea.classList.remove('is-empty', 'is-loading', 'is-error');
			if (state)
				logArea.classList.add(state);

			logArea.textContent = text;
			if (!state)
				logArea.scrollTop = logArea.scrollHeight;
		};

		var logBtnBar = E('div', { 'class': 'ubr-btn-group', 'style': 'margin-bottom:1em' });
		logBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				btn.disabled = true;
				btn.textContent = _('Loading...');
				setLogArea(_('Loading...'), 'is-loading');
				return callReadLog().then(function(result) {
					if (result && result.success === false) {
						var msg = result.error === 'logread_not_found' ?
							_('System log reader is not available on this device.') :
							_('Failed to read logs: ') + (result.error || '');
						setLogArea(msg, 'is-error');
						return;
					}

					var logs = (result && result.logs) ? result.logs : '';
					setLogArea(logs || _('No logs found.'), logs ? null : 'is-empty');
				}).catch(function(e) {
					setLogArea(_('Failed to read logs: ') + (e.message || e), 'is-error');
				}).finally(function() {
					btn.disabled = false;
					btn.textContent = '\u2261 ' + _('View Logs');
				});
			}
		}, '\u2261 ' + _('View Logs')));
		logSection.appendChild(logBtnBar);

		var logArea = E('pre', { 'class': 'ubr-log-area is-empty', 'id': 'log-area' },
			_('Click "View Logs" to load recent logs.'));
		logSection.appendChild(logArea);

		if (status.last_error) {
			logSection.appendChild(E('div', { 'class': 'alert-message danger', 'style': 'margin-top:1em' },
				E('p', {}, '\u2718 ' + _('Last Error: ') + status.last_error)));
		}
		container.appendChild(logSection);

			var depSection = E('div', { 'class': 'cbi-section ubr-section' });
		depSection.appendChild(E('h4', {}, '\u2757 ' + _('Missing Dependencies & Fix Commands')));
		var missingDeps = [];
		if (!env.nft) missingDeps.push('nftables');
		if (!env.upnpc) missingDeps.push('miniupnpc');

		if (missingDeps.length > 0) {
			var pkgMgr = env.package_manager || 'opkg';
			var installCmd = pkgMgr === 'apk' ?
				'apk add --allow-untrusted ' + missingDeps.join(' ') :
				'opkg install ' + missingDeps.join(' ');

			depSection.appendChild(E('p', { 'style': 'color:var(--warning-color, #d89b00);margin-bottom:0.5em' },
				'\u2718 ' + _('Missing dependencies: ') + missingDeps.join(', ')));
			depSection.appendChild(E('div', { 'class': 'ubr-cmd-box' }, installCmd));
		} else {
			depSection.appendChild(E('p', { 'style': 'color:var(--success-color, #3aa657)' },
				'\u2714 ' + _('All dependencies are installed.')));
		}
		container.appendChild(depSection);

			var rollbackSection = E('div', { 'class': 'cbi-section ubr-danger-zone' });
		rollbackSection.appendChild(E('h4', {}, '\u26A0 ' + _('Rollback & Cleanup')));

		rollbackSection.appendChild(E('div', { 'class': 'alert-message warning', 'style': 'margin-bottom:1em' },
			E('p', {}, _('Warning: Rollback operations will remove configurations created by this plugin. Proceed with caution.'))));

		var rollbackBtnBar = E('div', { 'class': 'ubr-btn-group' });

		rollbackBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Are you sure you want to undo all initialization? This will remove all plugin-created configurations (interface, zone, OpenClash rules, nftables rules).')))
					return;
				var btn = this;
				btn.disabled = true;
				return callRollback().then(function() {
					return callClear();
				}).then(function() {
					ui.addNotification(null, E('p', _('All plugin configurations and rules have been removed.')), 'info');
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Rollback failed: ') + e.message), 'error');
				}).finally(function() {
					btn.disabled = false;
				});
			}
		}, '\u21A9 ' + _('Undo All Initialization')));

		rollbackBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Remove OpenClash rules created by this plugin?')))
					return;
				var btn = this;
				btn.disabled = true;
				return callRemoveOpenclashRule().then(function() {
					ui.addNotification(null, E('p', _('OpenClash rules removed.')), 'info');
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed: ') + e.message), 'error');
				}).finally(function() {
					btn.disabled = false;
				});
			}
		}, '\u2716 ' + _('Remove OpenClash Rules')));

		rollbackBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Clear all dynamic nftables rules?')))
					return;
				var btn = this;
				btn.disabled = true;
				return callClear().then(function() {
					ui.addNotification(null, E('p', _('Dynamic rules cleared.')), 'info');
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed: ') + e.message), 'error');
				}).finally(function() {
					btn.disabled = false;
				});
			}
		}, '\u2716 ' + _('Clear nftables Rules')));

		rollbackSection.appendChild(rollbackBtnBar);
		container.appendChild(rollbackSection);

		return container;
	}
});
