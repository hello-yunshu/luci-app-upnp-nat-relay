'use strict';
'require view';
'require ui';
'require uci';

var css = `
	.ubr-settings .cbi-section {
		margin-bottom: 1.5em;
	}
	.ubr-settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.8em 1.5em;
		align-items: end;
	}
	.ubr-settings-grid .ubr-field {
		display: flex;
		flex-direction: column;
		gap: 0.3em;
	}
	.ubr-settings-grid .ubr-field label {
		font-size: 0.9em;
		color: var(--subtext-color, #666);
	}
	.ubr-settings-grid .ubr-field input,
	.ubr-settings-grid .ubr-field select {
		width: 100%;
		box-sizing: border-box;
	}
	.ubr-settings-grid .ubr-field-checkbox {
		flex-direction: row;
		align-items: center;
		gap: 0.5em;
		padding-top: 1.2em;
	}
	.ubr-settings-grid .ubr-field-checkbox label {
		font-size: 0.9em;
		color: var(--main-color, #0069d9);
		cursor: pointer;
	}
	.ubr-settings-grid .ubr-field-checkbox input {
		width: auto;
	}
	.ubr-hint {
		margin-top: 0.5em;
		font-size: 0.85em;
		color: var(--subtext-color, #666);
	}
	.ubr-hint-warning {
		color: var(--warning-color, #d4880f);
	}
`;

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

return view.extend({
	load: function() {
		return uci.load('upnp_bridge_relay');
	},

	render: function() {
		var container = E('div', { 'class': 'cbi-map ubr-settings' });
		container.appendChild(E('style', {}, css));

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('UPnP Bridge Relay - Settings')));

		var syncSection = E('div', { 'class': 'cbi-section' });
		syncSection.appendChild(E('h3', {}, _('Sync Behavior')));

		var syncGrid = E('div', { 'class': 'ubr-settings-grid' });

		var intervalVal = uci.get('upnp_bridge_relay', 'main', 'interval') || '60';
		syncGrid.appendChild(E('div', { 'class': 'ubr-field' }, [
			E('label', {}, _('Sync Interval (seconds)')),
			E('input', {
				'type': 'number',
				'min': '10',
				'max': '86400',
				'value': intervalVal,
				'data-option': 'interval'
			})
		]));

		var backendVal = uci.get('upnp_bridge_relay', 'main', 'backend') || 'upnpc';
		var backendSelect = E('select', { 'data-option': 'backend' });
		var backendOptUpnpc = E('option', { 'value': 'upnpc' }, 'upnpc');
		var backendOptCustom = E('option', { 'value': 'custom' }, 'custom');
		if (backendVal === 'upnpc') backendOptUpnpc.selected = true;
		else backendOptCustom.selected = true;
		backendSelect.appendChild(backendOptUpnpc);
		backendSelect.appendChild(backendOptCustom);
		syncGrid.appendChild(E('div', { 'class': 'ubr-field' }, [
			E('label', {}, _('UPnP Backend')),
			backendSelect
		]));

		var graceVal = uci.get('upnp_bridge_relay', 'main', 'failure_grace_count') || '3';
		syncGrid.appendChild(E('div', { 'class': 'ubr-field' }, [
			E('label', {}, _('Failure Grace Count')),
			E('input', {
				'type': 'number',
				'min': '0',
				'max': '100',
				'value': graceVal,
				'data-option': 'failure_grace_count'
			})
		]));

		var dryRunVal = uci.get('upnp_bridge_relay', 'main', 'dry_run') === '1';
		syncGrid.appendChild(E('div', { 'class': 'ubr-field ubr-field-checkbox' }, [
			E('input', {
				'type': 'checkbox',
				'checked': dryRunVal ? 'checked' : undefined,
				'data-option': 'dry_run'
			}),
			E('label', {}, _('Dry Run Mode'))
		]));

		var clearOnStopVal = uci.get('upnp_bridge_relay', 'main', 'clear_on_stop') !== '0';
		syncGrid.appendChild(E('div', { 'class': 'ubr-field ubr-field-checkbox' }, [
			E('input', {
				'type': 'checkbox',
				'checked': clearOnStopVal ? 'checked' : undefined,
				'data-option': 'clear_on_stop'
			}),
			E('label', {}, _('Clear Rules on Stop'))
		]));

		syncSection.appendChild(syncGrid);
		syncSection.appendChild(E('p', { 'class': 'ubr-hint' },
			_('Dry run mode reads UPnP mappings but does not create DNAT rules. Useful for verifying configuration before applying.')));
		syncSection.appendChild(E('p', { 'class': 'ubr-hint' },
			_('Failure grace count: the service will stop after this many consecutive sync failures. Set to 0 to never stop.')));

		container.appendChild(syncSection);

		var logSection = E('div', { 'class': 'cbi-section' });
		logSection.appendChild(E('h3', {}, _('Logging')));

		var logGrid = E('div', { 'class': 'ubr-settings-grid' });

		var logLevelVal = uci.get('upnp_bridge_relay', 'main', 'log_level') || 'info';
		var logLevelSelect = E('select', { 'data-option': 'log_level' });
		var logLevels = ['debug', 'info', 'warn', 'error'];
		for (var li = 0; li < logLevels.length; li++) {
			var logOpt = E('option', { 'value': logLevels[li] }, logLevels[li]);
			if (logLevels[li] === logLevelVal) logOpt.selected = true;
			logLevelSelect.appendChild(logOpt);
		}
		logGrid.appendChild(E('div', { 'class': 'ubr-field' }, [
			E('label', {}, _('Log Level')),
			logLevelSelect
		]));

		logSection.appendChild(logGrid);
		logSection.appendChild(E('p', { 'class': 'ubr-hint' },
			_('Log level controls the verbosity of system log output. Debug produces the most detail.')));

		container.appendChild(logSection);

		var saveBar = E('div', { 'style': 'display:flex;gap:0.8em;margin-top:1em' });
		saveBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				setBusy(btn, _('Saving...'));

				var allGrids = container.querySelectorAll('.ubr-settings-grid');
				for (var g = 0; g < allGrids.length; g++) {
					var inputs = allGrids[g].querySelectorAll('[data-option]');
					for (var i = 0; i < inputs.length; i++) {
						var opt = inputs[i].getAttribute('data-option');
						var val;
						if (inputs[i].type === 'checkbox') {
							val = inputs[i].checked ? '1' : '0';
						} else {
							val = inputs[i].value;
						}
						uci.set('upnp_bridge_relay', 'main', opt, val);
					}
				}

				return uci.save()
					.then(function() { return safeApply(); })
					.then(function() {
						ui.addNotification(null, E('p', _('Settings saved and applied.')), 'info');
						window.setTimeout(function() {
							window.location.reload();
						}, 1500);
					})
					.catch(function(e) {
						ui.addNotification(null, E('p', _('Failed to save settings: %s').format(e.message)), 'error');
						resetBusy(btn);
					});
			}
		}, _('Save & Apply')));
		saveBar.appendChild(E('button', {
			'class': 'cbi-button',
			'click': function() {
				window.location.reload();
			}
		}, _('Reset')));
		container.appendChild(saveBar);

		return container;
	}
});
