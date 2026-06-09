'use strict';
'require view';
'require ui';
'require rpc';
'require upnp-bridge-relay/utils as utils';

var callStatus = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'status',
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

var callClearLog = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'clear-log',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			callStatus(),
			callReadLog().catch(function() { return { success: false, logs: '' }; })
		]).then(function(results) {
			return {
				status: results[0],
				logData: results[1]
			};
		});
	},

	render: function(data) {
		utils.loadSharedCSS();
		var status = data.status || {};
		var logData = data.logData || {};

		var container = E('div', { 'class': 'cbi-map ubr-dashboard' });

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('Logs & Maintenance')));

		var logSection = E('div', { 'class': 'cbi-section ubr-section' });
		logSection.appendChild(E('h3', {}, _('Recent Logs')));

		var setLogArea = function(text, state) {
			var logArea = document.getElementById('log-area');
			if (!logArea) return;

			logArea.classList.remove('is-empty', 'is-loading', 'is-error');
			if (state)
				logArea.classList.add(state);

			logArea.value = text;
			if (!state)
				logArea.scrollTop = logArea.scrollHeight;
		};

		var logBtnBar = E('div', { 'class': 'ubr-btn-group ubr-mb-1' });

		logBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				btn.disabled = true;
				btn.textContent = _('Loading...');
				setLogArea(_('Loading...'), 'is-loading');
				return callReadLog().then(function(result) {
					if (!result || result.success !== true) {
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
					btn.textContent = '\u21BB ' + _('Refresh');
				});
			}
		}, '\u21BB ' + _('Refresh')));

		logBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Clear system log buffer? This will clear ALL system logs, not just plugin logs.')))
					return;
				var btn = this;
				btn.disabled = true;
				btn.textContent = _('Clearing...');
				return callClearLog().then(function(result) {
					if (result && result.success) {
						setLogArea(_('Log buffer cleared.'), 'is-empty');
					} else {
						ui.addNotification(null, E('p', _('Failed to clear logs: ') + ((result && result.error) || 'unknown')), 'error');
					}
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Failed to clear logs: ') + e.message), 'error');
				}).finally(function() {
					btn.disabled = false;
					btn.textContent = '\u2716 ' + _('Clear Logs');
				});
			}
		}, '\u2716 ' + _('Clear Logs')));

		logSection.appendChild(logBtnBar);

		var initialLogText;
		var initialLogState;
		if (!logData || logData.success !== true) {
			initialLogText = logData.error === 'logread_not_found' ?
				_('System log reader is not available on this device.') :
				_('Failed to read logs: ') + (logData.error || '');
			initialLogState = 'is-error';
		} else {
			var logs = (logData && logData.logs) ? logData.logs : '';
			initialLogText = logs || _('No logs found.');
			initialLogState = logs ? null : 'is-empty';
		}

		var logArea = E('textarea', {
			'class': 'cbi-input-textarea ubr-log-area' + (initialLogState ? ' ' + initialLogState : ''),
			'id': 'log-area',
			'rows': 20,
			'readonly': 'readonly'
		});
		logArea.value = initialLogText;
		logSection.appendChild(logArea);

		if (!initialLogState) {
			requestAnimationFrame(function() {
				var el = document.getElementById('log-area');
				if (el) el.scrollTop = el.scrollHeight;
			});
		}

		if (status.last_error) {
			logSection.appendChild(E('div', { 'class': 'alert-message danger ubr-mt-1' },
				E('p', {}, '\u2718 ' + _('Last Error: ') + status.last_error)));
		}
		container.appendChild(logSection);

		var rollbackSection = E('div', { 'class': 'cbi-section ubr-danger-zone' });
		rollbackSection.appendChild(E('h3', {}, _('Rollback & Cleanup')));

		rollbackSection.appendChild(E('div', { 'class': 'alert-message warning ubr-mb-1' },
			E('p', {}, _('Warning: Rollback operations will remove configurations created by this plugin. Proceed with caution.'))));

		var rollbackBtnBar = E('div', { 'class': 'ubr-btn-group' });

		rollbackBtnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-reset',
			'click': function() {
				if (!confirm(_('Are you sure you want to undo all initialization? This will remove all plugin-created configurations (interface, zone, OpenClash rules, nftables rules).')))
					return;
				var btn = this;
				btn.disabled = true;
				return callRollback().then(function(result) {
					result = result || {};
					if (result.success !== true) {
						ui.addNotification(null, E('p', _('Rollback failed: ') + (result.error || 'unknown')), 'error');
						return;
					}
					return callClear();
				}).then(function(result) {
					if (!result) return;
					result = result || {};
					if (result.success !== true) {
						ui.addNotification(null, E('p', _('Clear failed: ') + (result.error || 'unknown')), 'error');
						return;
					}
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
				return callClear().then(function(result) {
					result = result || {};
					if (result.success !== true) {
						ui.addNotification(null, E('p', _('Operation failed: ') + (result.error || 'unknown')), 'error');
						return;
					}
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

		utils.appendFooter(container, {
			project: 'UPnP Bridge Relay',
			repoUrl: 'https://github.com/hello-yunshu/upnp-bridge-relay'
		});

		return container;
	}
});
