'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';
'require network';

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

function callInitAction(action) {
	return rpc.declare({
		object: 'luci',
		method: 'setInitAction',
		params: ['name', 'action'],
		expect: { result: false }
	})('upnp_bridge_relay', action);
}

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

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('UPnP Bridge Relay - Setup Wizard')));

		var modeBar = E('div', { 'class': 'cbi-section', 'style': 'margin-bottom:1em' });
		modeBar.appendChild(E('p', {}, _('Wizard Mode:')));
		var safeBtn = E('button', {
			'class': 'cbi-button cbi-button-apply',
			'style': 'margin-right:1em',
			'click': function() {
				self.wizardMode = 'safe';
				safeBtn.classList.add('cbi-button-apply');
				autoBtn.classList.remove('cbi-button-apply');
				autoBtn.classList.add('cbi-button');
				self.renderStep(container);
			}
		}, _('Safe Mode (Detect Only)'));
		var autoBtn = E('button', {
			'class': 'cbi-button',
			'click': function() {
				self.wizardMode = 'auto';
				autoBtn.classList.add('cbi-button-apply');
				safeBtn.classList.remove('cbi-button-apply');
				safeBtn.classList.add('cbi-button');
				self.renderStep(container);
			}
		}, _('Auto Mode (Apply Changes)'));
		modeBar.appendChild(safeBtn);
		modeBar.appendChild(autoBtn);
		container.appendChild(modeBar);

		var stepContainer = E('div', { 'id': 'wizard-step' });
		container.appendChild(stepContainer);

		this.renderStep(container);

		return container;
	},

	renderStep: function(container) {
		var stepContainer = container.querySelector('#wizard-step');
		if (!stepContainer) return;

		while (stepContainer.firstChild)
			stepContainer.removeChild(stepContainer.firstChild);

		var self = this;
		var s = E('div', { 'class': 'cbi-section' });

		var progressBar = E('div', { 'style': 'margin-bottom:1em;display:flex;gap:4px' });
		for (var i = 1; i <= this.totalSteps; i++) {
			var dot = E('span', {
				'style': 'display:inline-block;width:30px;height:8px;border-radius:4px;background:' +
					(i < self.step ? '#5cb85c' : i === self.step ? '#337ab7' : '#ddd')
			});
			progressBar.appendChild(dot);
		}
		s.appendChild(progressBar);

		var title = E('h3', {}, _('Step %d of %d').format(self.step, self.totalSteps));
		s.appendChild(title);

		if (self.step === 1) {
			s.appendChild(E('p', {}, _('Select the interface connected to the downstream router LAN side.')));
			s.appendChild(E('p', { 'style': 'color:orange' },
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

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Interface: ')));
			s.appendChild(ifSelect);

		} else if (self.step === 2) {
			s.appendChild(E('p', {}, _('Enter or auto-detect the IP address on the selected interface.')));

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Bind IP: ')));
			var ipInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-bind-ip',
				'value': self.wizardData.bind_ip,
				'placeholder': 'e.g. 192.168.3.50'
			});
			s.appendChild(ipInput);

			var detectBtn = E('button', {
				'class': 'cbi-button cbi-button-apply',
				'style': 'margin-left:1em',
				'click': function() {
					self.collectStepData();
					self.applyTempUci().then(function() {
						return callCheckNetwork();
					}).then(function(result) {
						if (result && result.bind_ip) {
							ipInput.value = result.bind_ip;
							self.wizardData.bind_ip = result.bind_ip;
						} else {
							ui.addNotification(null, E('p', _('Could not auto-detect IP.')), 'warning');
						}
					});
				}
			}, _('Auto Detect'));
			s.appendChild(detectBtn);

		} else if (self.step === 3) {
			s.appendChild(E('p', {}, _('Enter the downstream router LAN gateway IP address.')));

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Downstream LAN Gateway: ')));
			s.appendChild(E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-lan-gw',
				'value': self.wizardData.downstream_lan_gateway,
				'placeholder': 'e.g. 192.168.3.1'
			}));

			s.appendChild(E('label', { 'class': 'cbi-value-title', 'style': 'display:block;margin-top:0.5em' }, _('Downstream LAN Subnet: ')));
			s.appendChild(E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-lan-subnet',
				'value': self.wizardData.downstream_lan_subnet,
				'placeholder': 'e.g. 192.168.3.0/24'
			}));

		} else if (self.step === 4) {
			s.appendChild(E('p', {}, _('Testing ping to downstream LAN gateway...')));

			var pingResultDiv = E('div', { 'id': 'wiz-ping-result', 'style': 'margin-top:1em' });
			s.appendChild(pingResultDiv);

			self.applyTempUci().then(function() {
				return callCheckNetwork();
			}).then(function(result) {
				self.pingResult = result;
				if (result && result.gateway_reachable === 1) {
					pingResultDiv.innerHTML = '<span style="color:green">&#10004; ' + _('Ping to gateway successful') + '</span>';
				} else {
					pingResultDiv.innerHTML = '<span style="color:red">&#10008; ' + _('Ping to gateway failed') + '</span>' +
						'<p style="color:orange">' + _('Check that the interface is connected and the firewall zone allows output.') + '</p>';
				}
			}).catch(function() {
				pingResultDiv.innerHTML = '<span style="color:red">' + _('Network check failed') + '</span>';
			});

		} else if (self.step === 5) {
			s.appendChild(E('p', {}, _('Testing UPnP IGD discovery via upnpc...')));

			var upnpcResultDiv = E('div', { 'id': 'wiz-upnpc-result', 'style': 'margin-top:1em' });
			s.appendChild(upnpcResultDiv);

			self.applyTempUci().then(function() {
				return callCheckNetwork();
			}).then(function(result) {
				self.upnpcResult = result;
				if (result && result.upnpc_readable === 1) {
					var count = result.upnpc_mapping_count || 0;
					upnpcResultDiv.innerHTML = '<span style="color:green">&#10004; ' + _('UPnP IGD discovered, %d mapping(s) found').format(count) + '</span>';
				} else {
					upnpcResultDiv.innerHTML = '<span style="color:red">&#10008; ' + _('UPnP IGD discovery failed') + '</span>' +
						'<p style="color:orange">' + _('Ensure the downstream router has UPnP enabled and the bind IP is on its LAN side.') + '</p>';
				}
			}).catch(function() {
				upnpcResultDiv.innerHTML = '<span style="color:red">' + _('UPnP check failed') + '</span>';
			});

		} else if (self.step === 6) {
			s.appendChild(E('p', {}, _('Enter the downstream router WAN IP address (used as DNAT target).')));

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Downstream WAN IP: ')));
			s.appendChild(E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-wan-ip',
				'value': self.wizardData.downstream_wan_ip,
				'placeholder': 'e.g. 192.168.2.2'
			}));

		} else if (self.step === 7) {
			s.appendChild(E('p', {}, _('Select the upstream WAN interface for DNAT rules.')));

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Upstream WAN Interface: ')));
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

			s.appendChild(wanSelect);

		} else if (self.step === 8) {
			s.appendChild(E('p', {}, _('Set the allowed external port range for synchronization.')));
			s.appendChild(E('p', { 'style': 'color:orange' },
				_('It is NOT recommended to use 1-65535 as the allowed range.')));

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Allowed External Ports: ')));
			s.appendChild(E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'wiz-port-range',
				'value': self.wizardData.allowed_external_ports,
				'placeholder': 'e.g. 40000-65535'
			}));

		} else if (self.step === 9) {
			s.appendChild(E('p', {}, _('Configure OpenClash RETURN rule for bypassing transparent proxy on forwarded ports.')));

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('OpenClash Mode: ')));
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
			s.appendChild(ocSelect);

			if (self.wizardMode === 'auto') {
				s.appendChild(E('div', { 'style': 'margin-top:1em;padding:0.5em;background:#fff3cd;border:1px solid #ffc107;border-radius:4px' },
					E('p', {}, _('Auto mode will write RETURN rules to OpenClash configuration. A backup will be created before any changes.'))));
			}

		} else if (self.step === 10) {
			s.appendChild(E('p', {}, _('Review your configuration and enable the service.')));

			var summary = E('div', { 'style': 'margin:1em 0;padding:1em;background:#f5f5f5;border:1px solid #ddd;border-radius:4px' });
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
				var uciPreview = E('div', { 'style': 'margin:1em 0;padding:1em;background:#fff3cd;border:1px solid #ffc107;border-radius:4px' });
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

			s.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Enable Service: ')));
			var enableSelect = E('select', { 'class': 'cbi-input-select', 'id': 'wiz-enable' });
			var optYes = E('option', { 'value': '1' }, _('Yes'));
			var optNo = E('option', { 'value': '0' }, _('No'));
			optYes.selected = true;
			enableSelect.appendChild(optYes);
			enableSelect.appendChild(optNo);
			s.appendChild(enableSelect);
		}

		var navBar = E('div', { 'style': 'margin-top:1em;display:flex;gap:1em' });

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
					if (self.step === 2 && !self.validateIp(self.wizardData.bind_ip)) {
						ui.addNotification(null, E('p', _('Invalid IP address format. Please enter a valid IPv4 address (e.g. 192.168.3.50).')), 'warning');
						return;
					}
					if (self.step === 3 && !self.validateIp(self.wizardData.downstream_lan_gateway)) {
						ui.addNotification(null, E('p', _('Invalid gateway IP address format.')), 'warning');
						return;
					}
					if (self.step === 6 && !self.validateIp(self.wizardData.downstream_wan_ip)) {
						ui.addNotification(null, E('p', _('Invalid WAN IP address format.')), 'warning');
						return;
					}
					if (self.step === 8 && !self.validatePortRange(self.wizardData.allowed_external_ports)) {
						ui.addNotification(null, E('p', _('Invalid port range format. Use format like 40000-65535.')), 'warning');
						return;
					}
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
					self.applyWizard();
				}
			}, applyLabel));
		}

		s.appendChild(navBar);
		stepContainer.appendChild(s);
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
			return uci.apply();
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
			return uci.apply();
		});
	},

	validateIp: function(value) {
		if (!value) return true;
		return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) &&
			value.split('.').every(function(octet) { return parseInt(octet, 10) <= 255; });
	},

	validatePortRange: function(value) {
		if (!value) return true;
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
				return uci.apply();
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
							return callInitAction('enable').then(function() {
								return callInitAction('start');
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
