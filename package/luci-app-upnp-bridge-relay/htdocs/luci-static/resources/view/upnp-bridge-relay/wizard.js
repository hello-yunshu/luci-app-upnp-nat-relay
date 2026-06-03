'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';
'require network';
'require upnp-bridge-relay/utils as utils';

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

var callDryRun = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'dry-run',
	expect: { '': {} }
});

var callSetupInterface = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'setup-interface',
	expect: { '': {} }
});

var callFixZone = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'fix-zone',
	expect: { '': {} }
});

var callSetupOpenclash = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'setup-openclash',
	expect: { '': {} }
});

var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: ['name', 'action'],
	expect: { result: false }
});

function initAction(action) {
	return callInitAction('upnp_bridge_relay', action);
}

var css = `
	.ubr-wizard-progress {
		display: flex; align-items: center; gap: 0; margin-bottom: 1.5em;
	}
	.ubr-wizard-dot {
		display: flex; align-items: center; justify-content: center;
		width: 28px; height: 28px; border-radius: 50%;
		font-size: 0.8em; font-weight: bold; color: #fff;
		background: var(--border-color); transition: all 0.2s;
	}
	.ubr-wizard-dot.done { background: var(--success-color, #3aa657); }
	.ubr-wizard-dot.active { background: var(--main-color, #0069d9); box-shadow: 0 0 0 3px color-mix(in srgb, var(--main-color, #0069d9) 30%, transparent); }
	.ubr-wizard-line {
		flex: 1; height: 3px; background: var(--border-color);
	}
	.ubr-wizard-line.done { background: var(--success-color, #3aa657); }
		.ubr-wizard-step-card {
			padding: 1.2em;
		}
	.ubr-wizard-nav {
		display: flex; gap: 1em; margin-top: 1.2em;
		padding-top: 1em; border-top: 1px solid var(--border-color);
	}
		.ubr-mode-bar {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 0.8em;
			margin-bottom: 1.5em;
			padding: 0.8em;
			overflow: visible;
		}
		.ubr-mode-btn {
			padding: 0.85em 1em;
			text-align: center;
			cursor: pointer;
			border: 1px solid var(--border-color);
			border-radius: 6px;
			background: transparent;
			color: inherit;
			font: inherit;
			font-size: 0.95em;
			line-height: 1.4;
			transition: all 0.2s;
		}
		.ubr-mode-btn:hover {
			border-color: var(--main-color, #0069d9);
			background: color-mix(in srgb, var(--main-color, #0069d9) 8%, transparent);
		}
		.ubr-mode-btn.active {
			border-color: var(--main-color, #0069d9);
			background: color-mix(in srgb, var(--main-color, #0069d9) 16%, transparent);
			color: inherit;
			font-weight: bold;
			box-shadow:
				0 0 0 1px var(--main-color, #0069d9),
				inset 0 -3px 0 var(--main-color, #0069d9);
		}
	`;

return view.extend({
	step: 1,
	totalSteps: 10,
	wizardMode: 'safe',
	wizardData: {
		bind_ifname: '',
		bind_ip: '',
		downstream_lan_gateway: '',
		downstream_lan_subnet: '',
		downstream_wan_ip: '',
		upstream_wan_if: '',
		allowed_external_ports: '40000-65535',
		openclash_mode: 'prompt',
		enabled: '1'
	},
	pingResult: null,
	upnpcResult: null,
	uciChanges: [],

	load: function() {
		return Promise.all([
			uci.load('upnp_bridge_relay'),
			network.getDevices()
		]).then(function(results) {
			return results;
		});
	},

	render: function(data) {
		var self = this;
		var container = E('div', { 'class': 'cbi-map' });
		container.appendChild(E('style', {}, css));

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('UPnP Bridge Relay - Setup Wizard')));

		var modeBar = E('div', { 'class': 'cbi-section ubr-mode-bar' });
		var safeBtn = E('button', {
			'class': 'ubr-mode-btn' + (self.wizardMode === 'safe' ? ' active' : ''),
			'click': function() {
				self.wizardMode = 'safe';
				safeBtn.classList.add('active');
				autoBtn.classList.remove('active');
				self.renderStep(container);
			}
		}, _('Safe Mode (Detect Only)'));
		var autoBtn = E('button', {
			'class': 'ubr-mode-btn' + (self.wizardMode === 'auto' ? ' active' : ''),
			'click': function() {
				self.wizardMode = 'auto';
				autoBtn.classList.add('active');
				safeBtn.classList.remove('active');
				self.renderStep(container);
			}
		}, _('Auto Mode (Apply Changes)'));
		modeBar.appendChild(safeBtn);
		modeBar.appendChild(autoBtn);
		container.appendChild(modeBar);

		var stepContainer = E('div', { 'id': 'wizard-step' });
		container.appendChild(stepContainer);

		this.renderStep(container);

		utils.appendFooter(container, {
			project: 'UPnP Bridge Relay',
			repoUrl: 'https://github.com/hello-yunshu/upnp-bridge-relay'
		});

		return container;
	},

	createField: function(label, inputEl, description) {
		var row = E('div', { 'class': 'cbi-value' });
		row.appendChild(E('label', { 'class': 'cbi-value-title' }, label));
		var fieldDiv = E('div', { 'class': 'cbi-value-field' });
		fieldDiv.appendChild(inputEl);
		if (description) {
			fieldDiv.appendChild(E('div', { 'class': 'cbi-value-description' }, description));
		}
		row.appendChild(fieldDiv);
		return row;
	},

	createDetectButton: function(self, ipInput) {
		var detectBtn = E('button', {
			'class': 'cbi-button cbi-button-apply',
			'style': 'margin-left:0.5em',
			'click': function() {
				var btn = this;
				self.collectStepData();
				btn.disabled = true;
				btn.textContent = _('Detecting...');
				self.applyTempUci().then(function() {
					return callCheckNetwork();
				}).then(function(result) {
					if (result && result.bind_ip) {
						ipInput.value = result.bind_ip;
						self.wizardData.bind_ip = result.bind_ip;
					} else {
						ui.addNotification(null, E('p', _('Could not auto-detect IP.')), 'warning');
					}
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Auto-detect failed: ') + (e.message || e)), 'error');
				}).finally(function() {
					btn.disabled = false;
					btn.textContent = _('Auto Detect');
				});
			}
		}, _('Auto Detect'));
		return detectBtn;
	},

	renderStep: function(container) {
		var stepContainer = container.querySelector('#wizard-step');
		if (!stepContainer) return;

		while (stepContainer.firstChild)
			stepContainer.removeChild(stepContainer.firstChild);

			var self = this;
			var s = E('div', { 'class': 'cbi-section ubr-wizard-step-card' });

		var progressBar = E('div', { 'class': 'ubr-wizard-progress' });
		for (var i = 1; i <= this.totalSteps; i++) {
			var dotClass = 'ubr-wizard-dot';
			if (i < self.step) dotClass += ' done';
			else if (i === self.step) dotClass += ' active';
			progressBar.appendChild(E('span', { 'class': dotClass }, String(i)));
			if (i < this.totalSteps) {
				var lineClass = 'ubr-wizard-line';
				if (i < self.step) lineClass += ' done';
				progressBar.appendChild(E('span', { 'class': lineClass }));
			}
		}
		s.appendChild(progressBar);

		var title = E('h3', {}, _('Step %d of %d').format(self.step, self.totalSteps));
		s.appendChild(title);

		if (self.step === 1) {
			s.appendChild(E('p', {}, _('Select the interface connected to the downstream router LAN side.')));
			s.appendChild(E('p', { 'style': 'color:var(--warning-color, #d89b00)' },
				_('This interface is only for reading UPnP mappings. Do not set it as default gateway.')));

			var ifSelect = E('select', { 'class': 'cbi-input-select', 'id': 'wiz-ifname' });
			network.getDevices().then(function(devices) {
				for (var i = 0; i < devices.length; i++) {
					var dev = devices[i];
					var name = dev.getName ? dev.getName() : dev.name;
					if (name) {
						var opt = E('option', { 'value': name }, name);
						if (name === self.wizardData.bind_ifname)
							opt.selected = true;
						ifSelect.appendChild(opt);
					}
				}
			});

			s.appendChild(self.createField(
				_('Interface: '),
				ifSelect,
				_('The network interface connected to the downstream router LAN side, used only for reading UPnP mappings.')
			));

		} else if (self.step === 2) {
			s.appendChild(E('p', {}, _('Enter or auto-detect the IP address on the selected interface.')));

			var ipInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-bind-ip',
				'value': self.wizardData.bind_ip,
				'placeholder': _('e.g. 192.168.3.50')
			});
			var ipFieldWrap = E('div', { 'style': 'display:flex;align-items:center' });
			ipFieldWrap.appendChild(ipInput);
			ipFieldWrap.appendChild(self.createDetectButton(self, ipInput));

			s.appendChild(self.createField(
				_('Bind IP: '),
				ipFieldWrap,
				_('IP address on the read interface. Must be on the same subnet as the downstream router LAN.')
			));

		} else if (self.step === 3) {
			s.appendChild(E('p', {}, _('Enter the downstream router LAN gateway IP address.')));

			var gwInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-lan-gw',
				'value': self.wizardData.downstream_lan_gateway,
				'placeholder': _('e.g. 192.168.3.1')
			});
			s.appendChild(self.createField(
				_('Downstream LAN Gateway: '),
				gwInput,
				_('The LAN-side gateway IP address of the downstream router.')
			));

			var subnetInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-lan-subnet',
				'value': self.wizardData.downstream_lan_subnet,
				'placeholder': _('e.g. 192.168.3.0/24')
			});
			s.appendChild(self.createField(
				_('Downstream LAN Subnet: '),
				subnetInput,
				_('Downstream router LAN subnet in CIDR format, used for source filtering.')
			));

		} else if (self.step === 4) {
			s.appendChild(E('p', {}, _('Testing ping to downstream LAN gateway...')));

			if (self.wizardMode === 'auto') {
				s.appendChild(E('p', { 'style': 'color:var(--subtext-color, #666)' },
					_('Auto mode: interface and firewall will be configured before testing.')));
			} else {
				s.appendChild(E('p', { 'style': 'color:var(--subtext-color, #666)' },
					_('Safe mode: testing with current network state. If the interface is not configured yet, tests may fail.')));
			}

			var pingResultDiv = E('div', { 'id': 'wiz-ping-result', 'style': 'margin-top:1em' });
			pingResultDiv.innerHTML = '<span style="color:var(--subtext-color, #666)">' + _('Testing...') + '</span>';
			s.appendChild(pingResultDiv);

			self.applyTempUci().then(function() {
				if (self.wizardMode === 'auto') {
					return callSetupInterface().then(function() {
						return callFixZone();
					});
				}
			}).then(function() {
				return callCheckNetwork();
			}).then(function(result) {
				self.pingResult = result;
				if (result && result.error) {
					pingResultDiv.innerHTML = '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Network check error: ') + result.error + '</span>';
					return;
				}
				if (result && result.gateway_reachable === 1) {
					pingResultDiv.innerHTML = '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Ping to gateway successful') + '</span>';
				} else {
					var detail = '';
					if (result && result.iface_exists === 0) {
						detail += '<br><span style="color:var(--warning-color, #d89b00)">' + _('Interface does not exist. Check the interface name.') + '</span>';
					} else if (result && result.bind_ip_configured === 0) {
						detail += '<br><span style="color:var(--warning-color, #d89b00)">' + _('Bind IP is not configured on the interface. Use Auto mode or configure the interface manually.') + '</span>';
					} else {
						detail += '<br><span style="color:var(--warning-color, #d89b00)">' + _('Check that the interface is connected and the firewall zone allows output.') + '</span>';
					}
					pingResultDiv.innerHTML = '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Ping to gateway failed') + '</span>' +
					'<p>' + detail + '</p>';
				}
			}).catch(function(e) {
				pingResultDiv.innerHTML = '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Network check failed') + '</span>' +
				'<p style="color:var(--warning-color, #d89b00)">' + _('Error: ') + (e.message || e || _('Unknown error')) + '</p>';
			});

		} else if (self.step === 5) {
			s.appendChild(E('p', {}, _('Testing UPnP IGD discovery via upnpc...')));

			var upnpcResultDiv = E('div', { 'id': 'wiz-upnpc-result', 'style': 'margin-top:1em' });
			upnpcResultDiv.innerHTML = '<span style="color:var(--subtext-color, #666)">' + _('Testing...') + '</span>';
			s.appendChild(upnpcResultDiv);

			self.applyTempUci().then(function() {
				if (self.wizardMode === 'auto') {
					return callSetupInterface().then(function() {
						return callFixZone();
					});
				}
			}).then(function() {
				return callCheckNetwork();
			}).then(function(result) {
				self.upnpcResult = result;
				if (result && result.error) {
					upnpcResultDiv.innerHTML = '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('UPnP check error: ') + result.error + '</span>';
					return;
				}
				if (result && result.upnpc_readable === 1) {
					var count = result.upnpc_mapping_count || 0;
					upnpcResultDiv.innerHTML = '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('UPnP IGD discovered, %d mapping(s) found').format(count) + '</span>';
				} else {
					var detail = '';
					if (result && result.bind_ip_configured === 0) {
						detail += '<br><span style="color:var(--warning-color, #d89b00)">' + _('Bind IP is not configured on the interface. UPnP discovery requires a valid bind IP.') + '</span>';
					} else {
						detail += '<br><span style="color:var(--warning-color, #d89b00)">' + _('Ensure the downstream router has UPnP enabled and the bind IP is on its LAN side.') + '</span>';
					}
					upnpcResultDiv.innerHTML = '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('UPnP IGD discovery failed') + '</span>' +
						'<p>' + detail + '</p>';
				}
			}).catch(function(e) {
				upnpcResultDiv.innerHTML = '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('UPnP check failed') + '</span>' +
				'<p style="color:var(--warning-color, #d89b00)">' + _('Error: ') + (e.message || e || _('Unknown error')) + '</p>';
			});

		} else if (self.step === 6) {
			s.appendChild(E('p', {}, _('Enter the downstream router WAN IP address (used as DNAT target).')));

			var wanIpInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-wan-ip',
				'value': self.wizardData.downstream_wan_ip,
				'placeholder': _('e.g. 192.168.2.2')
			});
			s.appendChild(self.createField(
				_('Downstream WAN IP: '),
				wanIpInput,
				_('Downstream router WAN IP address, used as the DNAT rule target.')
			));

		} else if (self.step === 7) {
			s.appendChild(E('p', {}, _('Select the upstream WAN interface for DNAT rules.')));

			var wanSelect = E('select', { 'class': 'cbi-input-select', 'id': 'wiz-wan-if' });
			network.getDevices().then(function(devices) {
				for (var i = 0; i < devices.length; i++) {
					var dev = devices[i];
					var name = dev.getName ? dev.getName() : dev.name;
					if (name) {
						var opt = E('option', { 'value': name }, name);
						if (name === self.wizardData.upstream_wan_if)
							opt.selected = true;
						wanSelect.appendChild(opt);
					}
				}
			});

			s.appendChild(self.createField(
				_('Upstream WAN Interface: '),
				wanSelect,
				_('The upstream WAN interface where DNAT rules will be created.')
			));

		} else if (self.step === 8) {
			s.appendChild(E('p', {}, _('Set the allowed external port range for synchronization.')));
			s.appendChild(E('p', { 'style': 'color:var(--warning-color, #d89b00)' },
				_('It is NOT recommended to use 1-65535 as the allowed range.')));

			var portInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-port-range',
				'value': self.wizardData.allowed_external_ports,
				'placeholder': _('e.g. 40000-65535')
			});
			s.appendChild(self.createField(
				_('Allowed External Ports: '),
				portInput,
				_('Port range allowed for synchronization. Using 1-65535 is NOT recommended as it effectively creates a DMZ.')
			));

		} else if (self.step === 9) {
			s.appendChild(E('p', {}, _('Configure OpenClash RETURN rule for bypassing transparent proxy on forwarded ports.')));

			var ocSelect = E('select', { 'class': 'cbi-input-select', 'id': 'wiz-oc-mode' });
			var modes = [
				{ value: 'off', text: _('Off (Do not handle OpenClash)') },
				{ value: 'prompt', text: _('Prompt (Show suggested rules only)') },
				{ value: 'auto', text: _('Auto (Automatically write rules)') }
			];
			for (var i = 0; i < modes.length; i++) {
				var opt = E('option', { 'value': modes[i].value }, modes[i].text);
				if (modes[i].value === self.wizardData.openclash_mode)
					opt.selected = true;
				ocSelect.appendChild(opt);
			}
			s.appendChild(self.createField(
				_('OpenClash Mode: '),
				ocSelect,
				_('Control how OpenClash transparent proxy affects forwarded ports. "Off" ignores OpenClash, "Prompt" shows suggested rules, "Auto" writes rules automatically.')
			));

			if (self.wizardMode === 'auto') {
				s.appendChild(E('div', { 'class': 'alert-message warning' },
					E('p', {}, _('Auto mode will write RETURN rules to OpenClash configuration. A backup will be created before any changes.'))));
			}

		} else if (self.step === 10) {
			s.appendChild(E('p', {}, _('Review your configuration and enable the service.')));

			var summary = E('div', { 'class': 'cbi-section' });
			summary.innerHTML = '<table style="width:100%">' +
				'<tr><td><b>' + _('Interface') + '</b></td><td>' + (self.wizardData.bind_ifname || '-') + '</td></tr>' +
				'<tr><td><b>' + _('Bind IP') + '</b></td><td>' + (self.wizardData.bind_ip || '-') + '</td></tr>' +
				'<tr><td><b>' + _('Downstream LAN Gateway') + '</b></td><td>' + (self.wizardData.downstream_lan_gateway || '-') + '</td></tr>' +
				'<tr><td><b>' + _('Downstream LAN Subnet') + '</b></td><td>' + (self.wizardData.downstream_lan_subnet || '-') + '</td></tr>' +
				'<tr><td><b>' + _('Downstream WAN IP') + '</b></td><td>' + (self.wizardData.downstream_wan_ip || '-') + '</td></tr>' +
				'<tr><td><b>' + _('Upstream WAN Interface') + '</b></td><td>' + (self.wizardData.upstream_wan_if || '-') + '</td></tr>' +
				'<tr><td><b>' + _('Allowed Ports') + '</b></td><td>' + (self.wizardData.allowed_external_ports || '-') + '</td></tr>' +
				'<tr><td><b>' + _('OpenClash Mode') + '</b></td><td>' + (self.wizardData.openclash_mode || '-') + '</td></tr>' +
				'</table>';
			s.appendChild(summary);

			if (self.wizardMode === 'auto') {
				var uciPreview = E('div', { 'class': 'alert-message warning' });
				uciPreview.innerHTML = '<h4>' + _('UCI Changes Preview') + '</h4>' +
					'<pre style="white-space:pre-wrap;font-size:0.9em">' +
					'uci set upnp_bridge_relay.main.bind_ifname=' + (self.wizardData.bind_ifname || '') + '\n' +
					'uci set upnp_bridge_relay.main.bind_ip=' + (self.wizardData.bind_ip || '') + '\n' +
					'uci set upnp_bridge_relay.main.downstream_lan_gateway=' + (self.wizardData.downstream_lan_gateway || '') + '\n' +
					'uci set upnp_bridge_relay.main.downstream_lan_subnet=' + (self.wizardData.downstream_lan_subnet || '') + '\n' +
					'uci set upnp_bridge_relay.main.downstream_wan_ip=' + (self.wizardData.downstream_wan_ip || '') + '\n' +
					'uci set upnp_bridge_relay.main.upstream_wan_if=' + (self.wizardData.upstream_wan_if || '') + '\n' +
					'uci set upnp_bridge_relay.main.allowed_external_ports=' + (self.wizardData.allowed_external_ports || '') + '\n' +
					'uci set upnp_bridge_relay.main.openclash_mode=' + (self.wizardData.openclash_mode || '') + '\n' +
					'uci set upnp_bridge_relay.main.enabled=1\n' +
					'uci commit upnp_bridge_relay\n' +
					'</pre>';
				s.appendChild(uciPreview);
			}

			var enableSelect = E('select', { 'class': 'cbi-input-select', 'id': 'wiz-enable' });
			var optYes = E('option', { 'value': '1' }, _('Yes'));
			var optNo = E('option', { 'value': '0' }, _('No'));
			optYes.selected = true;
			enableSelect.appendChild(optYes);
			enableSelect.appendChild(optNo);
			s.appendChild(self.createField(
				_('Enable Service: '),
				enableSelect,
				_('Enable the UPnP Bridge Relay service after saving configuration.')
			));
		}

		var navBar = E('div', { 'class': 'ubr-wizard-nav' });

		if (self.step > 1) {
			navBar.appendChild(E('button', {
				'class': 'cbi-button',
				'click': function() {
					self.collectStepData();
					self.step--;
					self.renderStep(container);
				}
			}, _('Previous')));
		}

		if (self.step < self.totalSteps) {
			navBar.appendChild(E('button', {
				'class': 'cbi-button cbi-button-apply',
				'click': function() {
					self.collectStepData();
					if (!self.validateCurrentStep()) return;
					self.step++;
					self.renderStep(container);
				}
			}, _('Next')));
		}

		if (self.step === self.totalSteps) {
			var applyLabel = self.wizardMode === 'auto' ? _('Apply Configuration') : _('Save Configuration');
			navBar.appendChild(E('button', {
				'class': 'cbi-button cbi-button-apply',
				'click': function() {
					self.collectStepData();
					if (!self.validateAllSteps()) return;
					self.applyWizard();
				}
			}, applyLabel));
		}

		s.appendChild(navBar);
		stepContainer.appendChild(s);
	},

	validateCurrentStep: function() {
		var self = this;

		if (self.step === 1) {
			if (!self.wizardData.bind_ifname) {
				ui.addNotification(null, E('p', _('Please select an interface.')), 'warning');
				return false;
			}
		} else if (self.step === 2) {
			if (!self.wizardData.bind_ip) {
				ui.addNotification(null, E('p', _('Bind IP is required.')), 'warning');
				return false;
			}
			if (!self.validateIp(self.wizardData.bind_ip)) {
				ui.addNotification(null, E('p', _('Invalid IP address format. Please enter a valid IPv4 address (e.g. 192.168.3.50).')), 'warning');
				return false;
			}
		} else if (self.step === 3) {
			if (!self.wizardData.downstream_lan_gateway) {
				ui.addNotification(null, E('p', _('Downstream LAN Gateway is required.')), 'warning');
				return false;
			}
			if (!self.validateIp(self.wizardData.downstream_lan_gateway)) {
				ui.addNotification(null, E('p', _('Invalid gateway IP address format.')), 'warning');
				return false;
			}
			if (!self.wizardData.downstream_lan_subnet) {
				ui.addNotification(null, E('p', _('Downstream LAN Subnet is required.')), 'warning');
				return false;
			}
			if (!self.validateSubnet(self.wizardData.downstream_lan_subnet)) {
				ui.addNotification(null, E('p', _('Invalid subnet format. Please use CIDR notation (e.g. 192.168.3.0/24).')), 'warning');
				return false;
			}
		} else if (self.step === 6) {
			if (!self.wizardData.downstream_wan_ip) {
				ui.addNotification(null, E('p', _('Downstream WAN IP is required.')), 'warning');
				return false;
			}
			if (!self.validateIp(self.wizardData.downstream_wan_ip)) {
				ui.addNotification(null, E('p', _('Invalid WAN IP address format.')), 'warning');
				return false;
			}
		} else if (self.step === 7) {
			if (!self.wizardData.upstream_wan_if) {
				ui.addNotification(null, E('p', _('Please select an upstream WAN interface.')), 'warning');
				return false;
			}
		} else if (self.step === 8) {
			if (!self.wizardData.allowed_external_ports) {
				ui.addNotification(null, E('p', _('Allowed external ports is required.')), 'warning');
				return false;
			}
			if (!self.validatePortRange(self.wizardData.allowed_external_ports)) {
				ui.addNotification(null, E('p', _('Invalid port range format. Use format like 40000-65535.')), 'warning');
				return false;
			}
		}

		return true;
	},

	validateAllSteps: function() {
		var self = this;
		var requiredFields = [
			{ key: 'bind_ifname', label: _('Interface') },
			{ key: 'bind_ip', label: _('Bind IP') },
			{ key: 'downstream_lan_gateway', label: _('Downstream LAN Gateway') },
			{ key: 'downstream_lan_subnet', label: _('Downstream LAN Subnet') },
			{ key: 'downstream_wan_ip', label: _('Downstream WAN IP') },
			{ key: 'upstream_wan_if', label: _('Upstream WAN Interface') },
			{ key: 'allowed_external_ports', label: _('Allowed External Ports') }
		];

		for (var i = 0; i < requiredFields.length; i++) {
			if (!self.wizardData[requiredFields[i].key]) {
				ui.addNotification(null, E('p', _('%s is required.').format(requiredFields[i].label)), 'warning');
				return false;
			}
		}

		if (!self.validateIp(self.wizardData.bind_ip)) {
			ui.addNotification(null, E('p', _('Invalid Bind IP address format.')), 'warning');
			return false;
		}
		if (!self.validateIp(self.wizardData.downstream_lan_gateway)) {
			ui.addNotification(null, E('p', _('Invalid gateway IP address format.')), 'warning');
			return false;
		}
		if (!self.validateSubnet(self.wizardData.downstream_lan_subnet)) {
			ui.addNotification(null, E('p', _('Invalid subnet format.')), 'warning');
			return false;
		}
		if (!self.validateIp(self.wizardData.downstream_wan_ip)) {
			ui.addNotification(null, E('p', _('Invalid WAN IP address format.')), 'warning');
			return false;
		}
		if (!self.validatePortRange(self.wizardData.allowed_external_ports)) {
			ui.addNotification(null, E('p', _('Invalid port range format.')), 'warning');
			return false;
		}

		return true;
	},

	collectStepData: function() {
		var self = this;
		var el;

		if (self.step === 1) {
			el = document.getElementById('wiz-ifname');
			if (el) self.wizardData.bind_ifname = el.value;
		} else if (self.step === 2) {
			el = document.getElementById('wiz-bind-ip');
			if (el) self.wizardData.bind_ip = el.value;
		} else if (self.step === 3) {
			el = document.getElementById('wiz-lan-gw');
			if (el) self.wizardData.downstream_lan_gateway = el.value;
			el = document.getElementById('wiz-lan-subnet');
			if (el) self.wizardData.downstream_lan_subnet = el.value;
		} else if (self.step === 6) {
			el = document.getElementById('wiz-wan-ip');
			if (el) self.wizardData.downstream_wan_ip = el.value;
		} else if (self.step === 7) {
			el = document.getElementById('wiz-wan-if');
			if (el) self.wizardData.upstream_wan_if = el.value;
		} else if (self.step === 8) {
			el = document.getElementById('wiz-port-range');
			if (el) self.wizardData.allowed_external_ports = el.value;
		} else if (self.step === 9) {
			el = document.getElementById('wiz-oc-mode');
			if (el) self.wizardData.openclash_mode = el.value;
		} else if (self.step === 10) {
			el = document.getElementById('wiz-enable');
			if (el) self.wizardData.enabled = el.value;
		}
	},

	saveToUci: function() {
		var self = this;
		if (self.wizardData.bind_ifname)
			uci.set('upnp_bridge_relay', 'main', 'bind_ifname', self.wizardData.bind_ifname);
		if (self.wizardData.bind_ip)
			uci.set('upnp_bridge_relay', 'main', 'bind_ip', self.wizardData.bind_ip);
		if (self.wizardData.downstream_lan_gateway)
			uci.set('upnp_bridge_relay', 'main', 'downstream_lan_gateway', self.wizardData.downstream_lan_gateway);
		if (self.wizardData.downstream_lan_subnet)
			uci.set('upnp_bridge_relay', 'main', 'downstream_lan_subnet', self.wizardData.downstream_lan_subnet);
		if (self.wizardData.downstream_wan_ip)
			uci.set('upnp_bridge_relay', 'main', 'downstream_wan_ip', self.wizardData.downstream_wan_ip);
		if (self.wizardData.upstream_wan_if)
			uci.set('upnp_bridge_relay', 'main', 'upstream_wan_if', self.wizardData.upstream_wan_if);
		return uci.save().then(function() {
			return utils.safeApply();
		});
	},

	applyTempUci: function() {
		var self = this;
		if (self.wizardData.bind_ifname)
			uci.set('upnp_bridge_relay', 'main', 'bind_ifname', self.wizardData.bind_ifname);
		if (self.wizardData.bind_ip)
			uci.set('upnp_bridge_relay', 'main', 'bind_ip', self.wizardData.bind_ip);
		if (self.wizardData.downstream_lan_gateway)
			uci.set('upnp_bridge_relay', 'main', 'downstream_lan_gateway', self.wizardData.downstream_lan_gateway);
		if (self.wizardData.downstream_lan_subnet)
			uci.set('upnp_bridge_relay', 'main', 'downstream_lan_subnet', self.wizardData.downstream_lan_subnet);
		if (self.wizardData.downstream_wan_ip)
			uci.set('upnp_bridge_relay', 'main', 'downstream_wan_ip', self.wizardData.downstream_wan_ip);
		if (self.wizardData.upstream_wan_if)
			uci.set('upnp_bridge_relay', 'main', 'upstream_wan_if', self.wizardData.upstream_wan_if);
		return uci.save().then(function() {
			return utils.safeApply();
		});
	},

	validateIp: function(value) {
		if (!value) return false;
		return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) &&
			value.split('.').every(function(octet) { return parseInt(octet, 10) <= 255; });
	},

	validateSubnet: function(value) {
		if (!value) return false;
		var parts = value.split('/');
		if (parts.length !== 2) return false;
		if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(parts[0])) return false;
		if (!parts[0].split('.').every(function(octet) { return parseInt(octet, 10) <= 255; })) return false;
		var mask = parseInt(parts[1], 10);
		return mask >= 0 && mask <= 32;
	},

	validatePortRange: function(value) {
		if (!value) return false;
		return /^\d+-\d+$/.test(value) && parseInt(value.split('-')[0], 10) <= parseInt(value.split('-')[1], 10);
	},

	applyWizard: function() {
		var self = this;

		uci.set('upnp_bridge_relay', 'main', 'bind_ifname', self.wizardData.bind_ifname);
		uci.set('upnp_bridge_relay', 'main', 'bind_ip', self.wizardData.bind_ip);
		uci.set('upnp_bridge_relay', 'main', 'downstream_lan_gateway', self.wizardData.downstream_lan_gateway);
		uci.set('upnp_bridge_relay', 'main', 'downstream_lan_subnet', self.wizardData.downstream_lan_subnet);
		uci.set('upnp_bridge_relay', 'main', 'downstream_wan_ip', self.wizardData.downstream_wan_ip);
		uci.set('upnp_bridge_relay', 'main', 'upstream_wan_if', self.wizardData.upstream_wan_if);
		uci.set('upnp_bridge_relay', 'main', 'allowed_external_ports', self.wizardData.allowed_external_ports);
		uci.set('upnp_bridge_relay', 'main', 'openclash_mode', self.wizardData.openclash_mode);
		uci.set('upnp_bridge_relay', 'main', 'enabled', self.wizardData.enabled);

		uci.save()
			.then(function() {
				return utils.safeApply();
			})
			.then(function() {
				if (self.wizardMode === 'auto') {
					return callSetupInterface().then(function() {
						return callFixZone();
					}).then(function() {
						if (self.wizardData.openclash_mode === 'auto') {
							return callSetupOpenclash();
						}
					}).then(function() {
						if (self.wizardData.enabled === '1') {
							return initAction('enable').then(function() {
								return initAction('start');
							});
						}
					});
				}
			})
			.then(function() {
				ui.addNotification(null, E('p', _('Configuration saved successfully.')), 'info');
				if (self.wizardMode === 'auto') {
					ui.addNotification(null, E('p', _('Auto configuration applied.')), 'info');
				}
			})
			.catch(function(e) {
				ui.addNotification(null, E('p', _('Configuration failed: ') + e.message), 'error');
			});
	}
});
