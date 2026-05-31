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

var css = `
	.ubr-dashboard { max-width: 100%; }
	.ubr-status-banner {
		display: flex; align-items: center; gap: 1.2em;
		padding: 1.5em; margin-bottom: 1.5em;
		border-radius: 8px;
		background: var(--background-color-a, #f5f5f5);
		border: 1px solid var(--border-color, #ddd);
	}
	.ubr-status-banner.running { border-left: 5px solid #5cb85c; }
	.ubr-status-banner.stopped { border-left: 5px solid #d9534f; }
	.ubr-status-icon { font-size: 2.5em; line-height: 1; }
	.ubr-status-icon.running { color: #5cb85c; }
	.ubr-status-icon.stopped { color: #d9534f; }
	.ubr-status-text h3 { margin: 0 0 0.2em 0; font-size: 1.3em; }
	.ubr-status-text p { margin: 0; color: var(--text-color-disabled, gray); font-size: 0.9em; }
	.ubr-stats-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1em; margin-bottom: 1.5em;
	}
	.ubr-stat-card {
		padding: 1em 1.2em; border-radius: 8px;
		background: var(--background-color-a, #f5f5f5);
		border: 1px solid var(--border-color, #ddd);
		text-align: center;
	}
	.ubr-stat-card .ubr-stat-value {
		font-size: 1.8em; font-weight: bold; line-height: 1.2;
		color: var(--main-color, #337ab7);
	}
	.ubr-stat-card .ubr-stat-value.green { color: #5cb85c; }
	.ubr-stat-card .ubr-stat-value.red { color: #d9534f; }
	.ubr-stat-card .ubr-stat-value.orange { color: #f0ad4e; }
	.ubr-stat-card .ubr-stat-label {
		font-size: 0.85em; color: var(--text-color-disabled, gray);
		margin-top: 0.3em;
	}
	.ubr-section {
		margin-bottom: 1.5em; padding: 1.2em;
		border-radius: 8px;
		background: var(--background-color-a, #f5f5f5);
		border: 1px solid var(--border-color, #ddd);
	}
	.ubr-section h4 {
		margin: 0 0 0.8em 0; padding-bottom: 0.5em;
		border-bottom: 1px solid var(--border-color, #ddd);
		font-size: 1.05em;
	}
	.ubr-info-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.6em 2em;
	}
	.ubr-info-row {
		display: flex; justify-content: space-between; align-items: center;
		padding: 0.4em 0;
	}
	.ubr-info-label { color: var(--text-color-disabled, gray); font-size: 0.9em; }
	.ubr-info-value { font-weight: 500; }
	.ubr-badge {
		display: inline-block; padding: 0.15em 0.6em; border-radius: 4px;
		font-size: 0.85em; font-weight: 500;
	}
	.ubr-badge.green { background: rgba(92,184,92,0.15); color: #5cb85c; }
	.ubr-badge.red { background: rgba(217,83,79,0.15); color: #d9534f; }
	.ubr-badge.orange { background: rgba(240,173,78,0.15); color: #f0ad4e; }
	.ubr-badge.gray { background: rgba(128,128,128,0.15); color: gray; }
	.ubr-btn-group { display: flex; flex-wrap: wrap; gap: 0.8em; }
`;

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
		var version = status.version || '-';

		var container = E('div', { 'class': 'cbi-map ubr-dashboard' });
		container.appendChild(E('style', {}, css));

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('UPnP Bridge Relay - Overview')));

		var banner = E('div', {
			'class': 'ubr-status-banner ' + (running ? 'running' : 'stopped')
		});
		banner.appendChild(E('div', {
			'class': 'ubr-status-icon ' + (running ? 'running' : 'stopped')
		}, running ? '\u25CF' : '\u25CB'));
		var bannerText = E('div', { 'class': 'ubr-status-text' });
		bannerText.appendChild(E('h3', {}, running ? _('Service Running') : _('Service Stopped')));
		bannerText.appendChild(E('p', {}, running ?
			_('UPnP Bridge Relay is active and syncing mappings.') :
			_('UPnP Bridge Relay is not running. Click Start to begin.')));
		banner.appendChild(bannerText);
		container.appendChild(banner);

		var statsGrid = E('div', { 'class': 'ubr-stats-grid' });

		statsGrid.appendChild(E('div', { 'class': 'ubr-stat-card' }, [
			E('div', { 'class': 'ubr-stat-value' }, String(readCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Read Mappings'))
		]));

		var acceptedClass = acceptedCount > 0 ? 'ubr-stat-value green' : 'ubr-stat-value';
		statsGrid.appendChild(E('div', { 'class': 'ubr-stat-card' }, [
			E('div', { 'class': acceptedClass }, String(acceptedCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Synced Mappings'))
		]));

		var rejectedClass = rejectedCount > 0 ? 'ubr-stat-value orange' : 'ubr-stat-value';
		statsGrid.appendChild(E('div', { 'class': 'ubr-stat-card' }, [
			E('div', { 'class': rejectedClass }, String(rejectedCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Rejected Mappings'))
		]));

		var failureClass = failureCount > 0 ? 'ubr-stat-value red' : 'ubr-stat-value';
		statsGrid.appendChild(E('div', { 'class': 'ubr-stat-card' }, [
			E('div', { 'class': failureClass }, String(failureCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Consecutive Failures'))
		]));

		container.appendChild(statsGrid);

		var infoSection = E('div', { 'class': 'ubr-section' });
		infoSection.appendChild(E('h4', {}, _('Service Information')));

		var infoGrid = E('div', { 'class': 'ubr-info-grid' });

		infoGrid.appendChild(E('div', { 'class': 'ubr-info-row' }, [
			E('span', { 'class': 'ubr-info-label' }, _('Plugin Version')),
			E('span', { 'class': 'ubr-info-value' }, version)
		]));

		infoGrid.appendChild(E('div', { 'class': 'ubr-info-row' }, [
			E('span', { 'class': 'ubr-info-label' }, _('GitHub')),
			E('a', {
				'href': 'https://github.com/hello-yunshu/upnp-bridge-relay',
				'target': '_blank',
				'rel': 'noopener',
				'style': 'color:var(--main-color,#337ab7);text-decoration:none'
			}, 'hello-yunshu/upnp-bridge-relay')
		]));

		infoGrid.appendChild(E('div', { 'class': 'ubr-info-row' }, [
			E('span', { 'class': 'ubr-info-label' }, _('Current Backend')),
			E('span', { 'class': 'ubr-info-value' }, backend)
		]));

		infoGrid.appendChild(E('div', { 'class': 'ubr-info-row' }, [
			E('span', { 'class': 'ubr-info-label' }, _('Last Sync Time')),
			E('span', { 'class': 'ubr-info-value' }, lastSync)
		]));

		var lastResultBadge;
		if (lastResult === 'success') {
			lastResultBadge = E('span', { 'class': 'ubr-badge green' }, lastResult);
		} else if (lastResult === '-') {
			lastResultBadge = E('span', { 'class': 'ubr-info-value' }, '-');
		} else {
			lastResultBadge = E('span', { 'class': 'ubr-badge red' }, lastResult);
		}
		infoGrid.appendChild(E('div', { 'class': 'ubr-info-row' }, [
			E('span', { 'class': 'ubr-info-label' }, _('Last Sync Result')),
			lastResultBadge
		]));

		var nftBadge;
		if (nftStatus === 'present') {
			nftBadge = E('span', { 'class': 'ubr-badge green' }, '\u2714 ' + _('Present'));
		} else if (nftStatus === '-') {
			nftBadge = E('span', { 'class': 'ubr-info-value' }, '-');
		} else {
			nftBadge = E('span', { 'class': 'ubr-badge orange' }, nftStatus);
		}
		infoGrid.appendChild(E('div', { 'class': 'ubr-info-row' }, [
			E('span', { 'class': 'ubr-info-label' }, _('nftables Table')),
			nftBadge
		]));

		var ocBadge;
		if (openclashStatus === 'running') {
			ocBadge = E('span', { 'class': 'ubr-badge green' }, '\u2714 ' + _('Running'));
		} else if (openclashStatus === 'installed') {
			ocBadge = E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + _('Installed (Stopped)'));
		} else if (openclashStatus === 'not_installed') {
			ocBadge = E('span', { 'class': 'ubr-badge gray' }, _('Not Installed'));
		} else if (openclashStatus === '-') {
			ocBadge = E('span', { 'class': 'ubr-info-value' }, '-');
		} else {
			ocBadge = E('span', { 'class': 'ubr-badge orange' }, openclashStatus);
		}
		infoGrid.appendChild(E('div', { 'class': 'ubr-info-row' }, [
			E('span', { 'class': 'ubr-info-label' }, _('OpenClash')),
			ocBadge
		]));

		infoSection.appendChild(infoGrid);
		container.appendChild(infoSection);

		var controlSection = E('div', { 'class': 'ubr-section' });
		controlSection.appendChild(E('h4', {}, _('Service Control')));

		var btnGroup = E('div', { 'class': 'ubr-btn-group' });

		if (!running) {
			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-apply',
				'click': function() {
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
				}
			}, '\u25B6 ' + _('Start')));
		}

		if (running) {
			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-reset',
				'click': function() {
					return callInitAction('stop').then(function() {
						ui.addNotification(null, E('p', _('Service stopped.')), 'info');
						window.location.reload();
					}).catch(function(e) {
						ui.addNotification(null, E('p', _('Failed to stop service: ') + e.message), 'error');
					});
				}
			}, '\u25A0 ' + _('Stop')));
		}

		btnGroup.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				return callInitAction('restart').then(function() {
					ui.addNotification(null, E('p', _('Service restarted.')), 'info');
					window.location.reload();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed to restart service: ') + e.message), 'error');
				});
			}
		}, '\u21BB ' + _('Restart')));

		if (running) {
			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-apply',
				'click': function() {
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
				}
			}, '\u21C4 ' + _('Sync Now')));

			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-reset',
				'click': function() {
					return callClear().then(function(result) {
						ui.addNotification(null, E('p', _('Dynamic rules cleared.')), 'info');
						window.location.reload();
					}).catch(function(e) {
						ui.addNotification(null, E('p', _('Failed to clear rules: ') + e.message), 'error');
					});
				}
			}, '\u2716 ' + _('Clear Rules')));
		}

		controlSection.appendChild(btnGroup);
		container.appendChild(controlSection);

		var footer = E('div', { 'style': 'margin-top:2em;padding:0.8em 0;text-align:center;color:var(--text-color-disabled,gray);font-size:0.85em;border-top:1px solid var(--border-color,#ddd)' });
		footer.innerHTML = 'UPnP Bridge Relay v' + version +
			' &middot; <a href="https://github.com/hello-yunshu/upnp-bridge-relay" target="_blank" rel="noopener" style="color:var(--main-color,#337ab7);text-decoration:none">GitHub</a>';
		container.appendChild(footer);

		return container;
	}
});
