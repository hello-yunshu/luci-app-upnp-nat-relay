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

function safeApply() {
	return uci.apply().catch(function(e) {
		var message = e && e.message ? e.message : String(e);
		if (e === 5 || /\bubus code 5\b/.test(message) || /No data|未收到数据/.test(message))
			return;
		throw e;
	});
}

var callSyncNow = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'sync-now',
	expect: { '': {} }
});

var callRefreshEnv = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'refresh-env',
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

function makeNftBadge(status) {
	if (status === 'present') {
		return E('span', { 'class': 'ubr-badge green' }, '\u2714 ' + _('Present'));
	} else if (status === '-' || status === 'not_present') {
		return E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + _('Missing'));
	} else {
		return E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + status);
	}
}

function makeOcBadge(status) {
	if (status === 'running') {
		return E('span', { 'class': 'ubr-badge green' }, '\u2714 ' + _('Running'));
	} else if (status === 'installed') {
		return E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + _('Installed (Stopped)'));
	} else if (status === 'not_installed') {
		return E('span', { 'class': 'ubr-badge orange' }, '\u2718 ' + _('Not Installed'));
	} else if (status === '-') {
		return E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + '-');
	} else {
		return E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + status);
	}
}

function buildDepSection(missingDeps, pkgManager) {
	var section = E('div', { 'class': 'cbi-section ubr-section' });
	section.appendChild(E('h4', {}, '\u2757 ' + _('Missing Dependencies & Fix Commands')));
	if (missingDeps.length > 0) {
		var installCmd = pkgManager === 'apk' ?
			'apk add --allow-untrusted ' + missingDeps.join(' ') :
			'opkg install ' + missingDeps.join(' ');
		section.appendChild(E('p', { 'style': 'color:var(--warning-color, #d89b00);margin-bottom:0.5em' },
			'\u2718 ' + _('Missing dependencies: ') + missingDeps.join(', ')));
		section.appendChild(E('div', { 'class': 'ubr-cmd-box' }, installCmd));
	} else {
		section.appendChild(E('p', { 'style': 'color:var(--success-color, #3aa657)' },
			'\u2714 ' + _('All dependencies are installed.')));
	}
	return section;
}

var css = `
		.ubr-dashboard { max-width: 100%; }
		.ubr-status-banner {
			display: flex; align-items: center; gap: 1.2em;
			padding: 1.5em; margin-bottom: 1.5em;
		}
	.ubr-status-banner.running { border-left: 5px solid var(--success-color, #3aa657); }
	.ubr-status-banner.stopped { border-left: 5px solid var(--warning-color, #d89b00); }
	.ubr-status-icon { font-size: 2.5em; line-height: 1; }
	.ubr-status-icon.running { color: var(--success-color, #3aa657); }
	.ubr-status-icon.stopped { color: var(--warning-color, #d89b00); }
	.ubr-status-text h3 { margin: 0 0 0.2em 0; font-size: 1.3em; }
	.ubr-status-text h3.running { color: var(--success-color, #3aa657); }
	.ubr-status-text h3.stopped { color: var(--warning-color, #d89b00); }
	.ubr-status-text p { margin: 0; color: var(--subtext-color, #666); font-size: 0.9em; }
	.ubr-stats-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1em; margin-bottom: 1.5em;
	}
		.ubr-stat-card {
			padding: 1em 1.2em; border-radius: 8px;
			text-align: center;
		}
	.ubr-stat-card .ubr-stat-value {
		font-size: 1.8em; font-weight: bold; line-height: 1.2;
		color: var(--main-color, #0069d9);
	}
	.ubr-stat-card .ubr-stat-value.green { color: var(--success-color, #3aa657); }
	.ubr-stat-card .ubr-stat-value.red { color: var(--danger-color, #d94b4b); }
	.ubr-stat-card .ubr-stat-value.orange { color: var(--warning-color, #d89b00); }
	.ubr-stat-card .ubr-stat-label {
		font-size: 0.85em; color: var(--subtext-color, #666);
		margin-top: 0.3em;
	}
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
		.ubr-btn-group { display: flex; flex-wrap: wrap; gap: 0.8em; }
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
			callStatus(),
			uci.load('upnp_bridge_relay')
		]).then(function(results) {
			return results[0];
		});
	},

	render: function(status) {
		status = status || {};
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
				'class': 'cbi-section ubr-status-banner ' + (running ? 'running' : 'stopped')
			});
		banner.appendChild(E('div', {
			'class': 'ubr-status-icon ' + (running ? 'running' : 'stopped')
		}, running ? '\u25CF' : '\u25CB'));
		var bannerText = E('div', { 'class': 'ubr-status-text' });
		bannerText.appendChild(E('h3', { 'class': running ? 'running' : 'stopped' },
			running ? _('Service Running') : _('Service Stopped')));
		bannerText.appendChild(E('p', {}, running ?
			_('UPnP Bridge Relay is active and syncing mappings.') :
			_('UPnP Bridge Relay is not running. Click Start to begin.')));
		banner.appendChild(bannerText);
		container.appendChild(banner);

		var statsGrid = E('div', { 'class': 'ubr-stats-grid' });

		statsGrid.appendChild(E('div', { 'class': 'cbi-section ubr-stat-card' }, [
			E('div', { 'class': 'ubr-stat-value' }, String(readCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Read Mappings'))
		]));

		var acceptedClass = acceptedCount > 0 ? 'ubr-stat-value green' : 'ubr-stat-value';
		statsGrid.appendChild(E('div', { 'class': 'cbi-section ubr-stat-card' }, [
			E('div', { 'class': acceptedClass }, String(acceptedCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Synced Mappings'))
		]));

		var rejectedClass = rejectedCount > 0 ? 'ubr-stat-value orange' : 'ubr-stat-value';
		statsGrid.appendChild(E('div', { 'class': 'cbi-section ubr-stat-card' }, [
			E('div', { 'class': rejectedClass }, String(rejectedCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Rejected Mappings'))
		]));

		var failureClass = failureCount > 0 ? 'ubr-stat-value red' : 'ubr-stat-value';
		statsGrid.appendChild(E('div', { 'class': 'cbi-section ubr-stat-card' }, [
			E('div', { 'class': failureClass }, String(failureCount)),
			E('div', { 'class': 'ubr-stat-label' }, _('Consecutive Failures'))
		]));

		container.appendChild(statsGrid);

			var controlSection = E('div', { 'class': 'cbi-section ubr-section' });
		controlSection.appendChild(E('h4', {}, _('Service Control')));

		var btnGroup = E('div', { 'class': 'ubr-btn-group' });

		if (!running) {
			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-apply',
				'click': function() {
					var btn = this;
					setBusy(btn, _('Loading...'));
					var enabled = uci.get('upnp_bridge_relay', 'main', 'enabled');
					var chain = L.resolve();
					if (enabled !== '1') {
						uci.set('upnp_bridge_relay', 'main', 'enabled', '1');
						chain = chain.then(function() { return uci.save(); })
							.then(function() { return safeApply(); });
					}
					return chain.then(function() {
						return callInitAction('start');
					}).then(function() {
						ui.addNotification(null, E('p', _('Service started.')), 'info');
						reloadSoon();
					}).catch(function(e) {
						ui.addNotification(null, E('p', _('Failed to start service: ') + e.message), 'error');
						resetBusy(btn);
					});
				}
			}, '\u25B6 ' + _('Start')));
		}

		if (running) {
			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-reset',
				'click': function() {
					var btn = this;
					setBusy(btn, _('Loading...'));
					return callInitAction('stop').then(function() {
						ui.addNotification(null, E('p', _('Service stopped.')), 'info');
						reloadSoon();
					}).catch(function(e) {
						ui.addNotification(null, E('p', _('Failed to stop service: ') + e.message), 'error');
						resetBusy(btn);
					});
				}
			}, '\u25A0 ' + _('Stop')));
		}

		btnGroup.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				setBusy(btn, _('Loading...'));
				return callInitAction('restart').then(function() {
					ui.addNotification(null, E('p', _('Service restarted.')), 'info');
					reloadSoon();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed to restart service: ') + e.message), 'error');
					resetBusy(btn);
				});
			}
		}, '\u21BB ' + _('Restart')));

		if (running) {
			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-apply',
				'click': function() {
					var btn = this;
					setBusy(btn, _('Loading...'));
					return callSyncNow().then(function(result) {
						var msg;
						var msgType = 'info';
						if (result && result.success === true) {
							var rc = result.read_count || 0;
							var ac = result.accepted_count || 0;
							var rj = result.rejected_count || 0;
							if (ac > 0) {
								msg = _('Sync completed: %d read, %d accepted, %d rejected.').format(rc, ac, rj);
							} else if (rj > 0) {
								msg = _('Sync completed: %d read, 0 accepted, %d rejected. Check Mappings page for details.').format(rc, rj);
								msgType = 'warning';
							} else {
								msg = _('Sync completed: 0 mappings read from downstream router. Ensure the downstream router has UPnP mappings.');
								msgType = 'warning';
							}
						} else if (result && result.success === false) {
							msg = _('Sync failed: %s').format(result.error || 'unknown');
							msgType = 'error';
						} else {
							msg = _('Sync triggered.');
						}
						ui.addNotification(null, E('p', msg), msgType);
						reloadSoon(2500);
					}).catch(function(e) {
						ui.addNotification(null, E('p', _('Sync failed: %s').format(e.message)), 'error');
						resetBusy(btn);
					});
				}
			}, '\u21C4 ' + _('Sync Now')));

			btnGroup.appendChild(E('button', {
				'class': 'cbi-button cbi-button-reset',
				'click': function() {
					var btn = this;
					setBusy(btn, _('Loading...'));
					return callClear().then(function(result) {
						ui.addNotification(null, E('p', _('Dynamic rules cleared.')), 'info');
						reloadSoon();
					}).catch(function(e) {
						ui.addNotification(null, E('p', _('Failed to clear rules: ') + e.message), 'error');
						resetBusy(btn);
					});
				}
			}, '\u2716 ' + _('Clear Rules')));
		}

		controlSection.appendChild(btnGroup);
		container.appendChild(controlSection);

			var infoSection = E('div', { 'class': 'cbi-section ubr-section' });
		infoSection.appendChild(E('h4', {}, _('Service Information')));

		var infoTable = E('table', { 'class': 'table' });

		var versionTd = E('td', { 'class': 'td' }, version);
		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('Plugin Version')),
			versionTd
		]));

		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('GitHub')),
			E('td', { 'class': 'td' }, E('a', {
				'href': 'https://github.com/hello-yunshu/upnp-bridge-relay',
				'target': '_blank',
				'rel': 'noopener',
				'style': 'color:var(--main-color, #0069d9);text-decoration:none'
			}, 'hello-yunshu/upnp-bridge-relay'))
		]));

		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('Current Backend')),
			E('td', { 'class': 'td' }, backend)
		]));

		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('Last Sync Time')),
			E('td', { 'class': 'td' }, lastSync)
		]));

		var lastResultBadge;
		if (lastResult === 'success' || lastResult.indexOf('success') === 0) {
			lastResultBadge = E('span', { 'class': 'ubr-badge green' }, '\u2714 ' + lastResult);
		} else if (lastResult === '-') {
			lastResultBadge = E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + '-');
		} else if (lastResult === 'partial') {
			lastResultBadge = E('span', { 'class': 'ubr-badge orange' }, '\u26A0 ' + lastResult);
		} else {
			lastResultBadge = E('span', { 'class': 'ubr-badge red' }, '\u2718 ' + lastResult);
		}
		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('Last Sync Result')),
			E('td', { 'class': 'td' }, lastResultBadge)
		]));

		var nftBadge = makeNftBadge(nftStatus);
		var nftTd = E('td', { 'class': 'td' }, nftBadge);
		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('nftables Table')),
			nftTd
		]));

		var ocBadge = makeOcBadge(openclashStatus);
		var ocTd = E('td', { 'class': 'td' }, ocBadge);
		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('OpenClash')),
			ocTd
		]));

		var envUpdatedAt = status.updated_at || '';
		var envTimeTd = E('td', { 'class': 'td' }, envUpdatedAt || '-');
		infoTable.appendChild(E('tr', { 'class': 'tr' }, [
			E('th', { 'class': 'th' }, _('Last Env Check')),
			envTimeTd
		]));

		infoSection.appendChild(infoTable);
		container.appendChild(infoSection);

		var envSection = E('div', { 'class': 'cbi-section ubr-section' });
		envSection.appendChild(E('h4', {}, '\u2699 ' + _('Environment Detection')));

		var envTable = E('table', { 'class': 'table' });

		var envItems = [
			{ label: _('OpenWrt Version'), key: 'openwrt_version', statusKey: 'package_manager', statusFn: function(v) { return v === 'unknown' ? 'orange' : 'green'; } },
			{ label: _('Package Manager'), key: 'package_manager', statusKey: 'package_manager', statusFn: function(v) { return v === 'unknown' ? 'orange' : 'green'; } },
			{ label: _('Firewall'), key: 'firewall', statusKey: 'firewall', statusFn: function(v) { return v !== 'fw4' ? 'orange' : 'green'; } },
			{ label: _('nft'), key: 'nft', statusKey: 'nft', statusFn: function(v) { return v ? 'green' : 'orange'; }, bool: true },
			{ label: _('upnpc'), key: 'upnpc', statusKey: 'upnpc', statusFn: function(v) { return v ? 'green' : 'orange'; }, bool: true },
			{ label: _('LuCI'), key: 'luci', statusKey: 'luci', statusFn: function(v) { return v ? 'green' : 'orange'; }, bool: true },
			{ label: _('OpenClash'), key: 'openclash_installed', statusKey: null, oc: true }
		];

		var envTds = [];
		for (var i = 0; i < envItems.length; i++) {
			var item = envItems[i];
			var val, badgeVal, badgeStatus;
			if (item.oc) {
				var ocInstalled = status.openclash_installed;
				var ocRunning = status.openclash_running;
				if (ocInstalled) {
					badgeVal = ocRunning ? '\u2714 ' + _('Running') : '\u26A0 ' + _('Installed (Stopped)');
				} else {
					badgeVal = '\u2718 ' + _('Not Installed');
				}
				badgeStatus = (ocInstalled && ocRunning) ? 'green' : 'orange';
			} else if (item.bool) {
				var bval = status[item.key];
				badgeVal = bval ? '\u2714 ' + _('Installed') : '\u2718 ' + _('Missing');
				badgeStatus = item.statusFn(bval);
			} else {
				var sval = status[item.key] || '-';
				badgeVal = sval;
				badgeStatus = item.statusFn(status[item.statusKey]);
			}
			var td = E('td', { 'class': 'td' }, E('span', { 'class': 'ubr-badge ' + badgeStatus }, badgeVal));
			envTds.push({ td: td, item: item });
			envTable.appendChild(E('tr', { 'class': 'tr' }, [
				E('th', { 'class': 'th' }, item.label),
				td
			]));
		}
		envSection.appendChild(envTable);

		var envBtnBar = E('div', { 'class': 'ubr-btn-group', 'style': 'margin-top:1em' });
		envBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				setBusy(btn, _('Checking...'));
				return callRefreshEnv().then(function(result) {
					result = result || {};
					for (var j = 0; j < envTds.length; j++) {
						var entry = envTds[j];
						var it = entry.item;
						var newBadgeVal, newBadgeStatus;
						if (it.oc) {
							var oi = result.openclash_installed;
							var or2 = result.openclash_running;
							if (oi) {
								newBadgeVal = or2 ? '\u2714 ' + _('Running') : '\u26A0 ' + _('Installed (Stopped)');
							} else {
								newBadgeVal = '\u2718 ' + _('Not Installed');
							}
							newBadgeStatus = (oi && or2) ? 'green' : 'orange';
						} else if (it.bool) {
							var nbv = result[it.key];
							newBadgeVal = nbv ? '\u2714 ' + _('Installed') : '\u2718 ' + _('Missing');
							newBadgeStatus = it.statusFn(nbv);
						} else {
							newBadgeVal = result[it.key] || '-';
							newBadgeStatus = it.statusFn(result[it.statusKey]);
						}
						while (entry.td.firstChild) entry.td.removeChild(entry.td.firstChild);
						entry.td.appendChild(E('span', { 'class': 'ubr-badge ' + newBadgeStatus }, newBadgeVal));
					}

					while (nftTd.firstChild) nftTd.removeChild(nftTd.firstChild);
					nftTd.appendChild(makeNftBadge(result.nft_table_status || '-'));
					while (ocTd.firstChild) ocTd.removeChild(ocTd.firstChild);
					ocTd.appendChild(makeOcBadge(result.openclash_status || '-'));
					versionTd.textContent = result.version || '-';
					envTimeTd.textContent = result.updated_at || '-';

					var newMissing = [];
					if (!result.nft) newMissing.push('nftables');
					if (!result.upnpc) newMissing.push('miniupnpc');
					var depSectionParent = depSection.parentNode;
					if (depSectionParent) {
						var newDepSection = buildDepSection(newMissing, result.package_manager || 'opkg');
						depSectionParent.replaceChild(newDepSection, depSection);
						depSection = newDepSection;
					}

					resetBusy(btn);
					ui.addNotification(null, E('p', _('Environment detection refreshed.')), 'info');
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed to refresh environment: ') + e.message), 'error');
					resetBusy(btn);
				});
			}
		}, '\u21BB ' + _('Refresh Env')));
		envSection.appendChild(envBtnBar);
		container.appendChild(envSection);

		var missingDeps = [];
		if (!status.nft) missingDeps.push('nftables');
		if (!status.upnpc) missingDeps.push('miniupnpc');
		var depSection = buildDepSection(missingDeps, status.package_manager || 'opkg');
		container.appendChild(depSection);

		var footer = E('div', { 'style': 'margin-top:2em;padding:0.8em 0;text-align:center;color:var(--subtext-color, #666);font-size:0.85em;border-top:1px solid var(--border-color)' });
		footer.innerHTML = 'UPnP Bridge Relay v' + version +
			' &middot; <a href="https://github.com/hello-yunshu/upnp-bridge-relay" target="_blank" rel="noopener" style="color:var(--main-color, #0069d9);text-decoration:none">GitHub</a>';
		container.appendChild(footer);

		return container;
	}
});
