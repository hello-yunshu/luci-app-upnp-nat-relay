'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';
'require upnp-bridge-relay/utils';

var callCheckNetwork = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'check-network',
	expect: { '': {} }
});

var callNetworkCache = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'network-cache',
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

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('upnp_bridge_relay'),
			callNetworkCache().catch(function() {
				return null;
			})
		]).then(function(results) {
			return {
				network: results[1]
			};
		});
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('upnp_bridge_relay', _('UPnP Bridge Relay - Network & Firewall'));

		s = m.section(form.TypedSection, 'service', _('Network Interface'));
		s.anonymous = true;
		s.tab('status', _('Status'));
		s.tab('config', _('Configuration'));

		o = s.taboption('config', form.Value, 'bind_ifname', _('Read Interface'),
			_('The interface connected to the downstream router LAN side.'));
		o.rmempty = false;

		o = s.taboption('config', form.Value, 'bind_ip', _('Interface IP'),
			_('IP address on the read interface.'));
		o.rmempty = false;
		o.datatype = 'ip4addr';

		o = s.taboption('config', form.Value, 'downstream_lan_gateway', _('Downstream LAN Gateway'),
			_('Downstream router LAN gateway IP.'));
		o.rmempty = false;
		o.datatype = 'ip4addr';

		o = s.taboption('config', form.Value, 'downstream_lan_subnet', _('Downstream LAN Subnet'),
			_('Downstream router LAN subnet (CIDR).'));
		o.rmempty = false;
		o.datatype = 'cidr4';

		o = s.taboption('config', form.Value, 'downstream_wan_ip', _('Downstream WAN IP'),
			_('Downstream router WAN IP (DNAT target).'));
		o.rmempty = false;
		o.datatype = 'ip4addr';

		o = s.taboption('config', form.Value, 'upstream_wan_if', _('Upstream WAN Interface'),
			_('The WAN interface for DNAT rules.'));
		o.rmempty = false;

		var netCheckData = data ? data.network : null;
		var hasNetCheckData = function() {
			if (!netCheckData || netCheckData.cached !== 1)
				return false;
			return (netCheckData.bind_ifname || '') === (uci.get('upnp_bridge_relay', 'main', 'bind_ifname') || '') &&
				(netCheckData.bind_ip || '') === (uci.get('upnp_bridge_relay', 'main', 'bind_ip') || '') &&
				(netCheckData.downstream_lan_gateway || '') === (uci.get('upnp_bridge_relay', 'main', 'downstream_lan_gateway') || '') &&
				(netCheckData.downstream_wan_ip || '') === (uci.get('upnp_bridge_relay', 'main', 'downstream_wan_ip') || '') &&
				(netCheckData.upstream_wan_if || '') === (uci.get('upnp_bridge_relay', 'main', 'upstream_wan_if') || '') &&
				(netCheckData.zone_name || '') === (uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge');
		};

		o = s.taboption('status', form.DummyValue, '_if_status', _('Interface Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (hasNetCheckData() && netCheckData.iface_exists === 1) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Interface exists') + '</span>';
			}
			if (hasNetCheckData()) {
				return '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Interface not found') + '</span>';
			}
			return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_ip_status', _('IP Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (hasNetCheckData() && netCheckData.bind_ip_configured === 1) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('IP configured') + '</span>';
			}
			if (hasNetCheckData()) {
				return '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('IP not configured') + '</span>';
			}
			return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_gateway_reachable', _('Downstream LAN Gateway'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.gateway_reachable === 1 || netCheckData.gateway_reachable === 'ok' || netCheckData.gateway_reachable === true) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Reachable') + '</span>';
			}
			return '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Unreachable') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_upnpc_readable', _('UPnP IGD Read'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.upnpc_readable === 1 || netCheckData.upnpc_readable === 'ok' || netCheckData.upnpc_readable === true) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Readable') + '</span>';
			}
			return '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Failed') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_wan_ip_reachable', _('Downstream WAN IP'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.wan_ip_reachable === 1 || netCheckData.wan_ip_reachable === 'ok' || netCheckData.wan_ip_reachable === true) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Reachable') + '</span>';
			}
			return '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Unreachable') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_upstream_wan', _('Upstream WAN Interface'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.upstream_wan_exists === 1 || netCheckData.upstream_wan_exists === 'ok' || netCheckData.upstream_wan_exists === true) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Exists') + '</span>';
			}
			return '<span style="color:var(--danger-color, #d94b4b)">&#10008; ' + _('Not found') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_default_route', _('Default Route Risk'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.default_route_on_bind === 1) {
				return '<span style="color:var(--danger-color, #d94b4b);font-weight:bold">&#9888; ' + _('Default route points to read interface!') + '</span>' +
					'<p style="color:var(--warning-color, #d89b00)">' + _('The read interface should NOT be a default gateway.') + '</p>';
			}
			return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('No default route risk') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_gateway_set', _('Gateway Setting'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.gateway_set === 1) {
				return '<span style="color:var(--danger-color, #d94b4b)">&#9888; ' + _('Gateway is set: %s').format(netCheckData.gateway_value || '-') + '</span>' +
					'<p style="color:var(--warning-color, #d89b00)">' + _('The read interface should not have a gateway configured.') + '</p>';
			}
			return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('No gateway set') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_dns_set', _('DNS Setting'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.dns_set === 1) {
				return '<span style="color:var(--warning-color, #d89b00)">&#9888; ' + _('DNS is set: %s').format(netCheckData.dns_value || '-') + '</span>';
			}
			return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('No DNS set') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_forwarding', _('Extra Forwarding'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.bad_forwarding === 1) {
				return '<span style="color:var(--warning-color, #d89b00)">&#9888; ' + _('Unnecessary forwarding detected') + '</span>';
			}
			return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('No extra forwarding') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_hint', _('Hint'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div class="alert-message warning">' +
				_('The read interface is only for reading UPnP mappings from the downstream router. ' +
					'It should NOT have a default gateway, DNS, or be bridged with the main LAN.') +
				'</div>';
		};

		s = m.section(form.TypedSection, 'service', _('Network Actions'));
		s.anonymous = true;

		o = s.option(form.Button, '_check_network', _('Detect Network'));
		o.inputtitle = _('Detect');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var btn = this;
			if (btn.node) {
				btn.node.disabled = true;
				btn.node.textContent = _('Detecting...');
			}
			return callCheckNetwork().then(function(result) {
				netCheckData = result;
				ui.addNotification(null, E('p', _('Network detection completed. Click the Status tab to view results.')), 'info');
				utils.reloadSoon();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Detection failed: ') + e.message), 'error');
			}).finally(function() {
				if (btn.node) {
					btn.node.disabled = false;
					btn.node.textContent = _('Detect');
				}
			});
		};

		o = s.option(form.Button, '_setup_interface', _('Configure Interface'));
		o.inputtitle = _('Auto Configure');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var btn = this;
			if (btn.node) {
				btn.node.disabled = true;
				btn.node.textContent = _('Configuring...');
			}
			return callSetupInterface().then(function(result) {
				return callCheckNetwork().catch(function() {
					return result;
				});
			}).then(function(result) {
				ui.addNotification(null, E('p', _('Interface configured. Click the Status tab to view details.')), 'info');
				utils.reloadSoon();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Interface configuration failed: ') + e.message), 'error');
			}).finally(function() {
				if (btn.node) {
					btn.node.disabled = false;
					btn.node.textContent = _('Auto Configure');
				}
			});
		};

		s = m.section(form.TypedSection, 'service', _('Firewall Zone'));
		s.anonymous = true;
		s.tab('zone_status', _('Zone Status'));
		s.tab('zone_config', _('Zone Configuration'));

		o = s.taboption('zone_status', form.DummyValue, '_zone_name', _('Current Zone'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var zoneName = uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge';
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.zone_exists === 1) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + (netCheckData.zone_name || zoneName) + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">&#10008; ' + zoneName + ' (' + _('Zone not found') + ')</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_input', _('Input Policy'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.zone_exists === 1) {
				var input = netCheckData.zone_input || '-';
				if (input === 'ACCEPT') {
					return '<span style="color:var(--success-color, #3aa657)">' + input + '</span>';
				}
				return '<span style="color:var(--danger-color, #d94b4b)">' + input + ' ' + _('(should be ACCEPT)') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_output', _('Output Policy'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.zone_exists === 1) {
				var output = netCheckData.zone_output || '-';
				if (output === 'ACCEPT') {
					return '<span style="color:var(--success-color, #3aa657)">' + output + '</span>';
				}
				return '<span style="color:var(--danger-color, #d94b4b)">' + output + ' ' + _('(should be ACCEPT)') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_forward', _('Forward Policy'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.zone_exists === 1) {
				var forward = netCheckData.zone_forward || '-';
				if (forward === 'REJECT') {
					return '<span style="color:var(--success-color, #3aa657)">' + forward + '</span>';
				}
				return '<span style="color:var(--danger-color, #d94b4b)">' + forward + ' ' + _('(should be REJECT)') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_maq', _('Masquerading'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (!hasNetCheckData()) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Click "Detect" to check status.') + '</span>';
			}
			if (netCheckData.zone_exists === 1) {
				var masq = netCheckData.zone_masq || '0';
				if (masq === '0') {
					return '<span style="color:var(--success-color, #3aa657)">' + _('Disabled') + '</span>';
				}
				return '<span style="color:var(--danger-color, #d94b4b)">' + _('Enabled (should be Disabled)') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_recommendation', _('Recommendation'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div class="alert-message info">' +
				'<b>' + _('Recommended zone settings:') + '</b><br>' +
				'input: ACCEPT, output: ACCEPT, forward: REJECT, masq: 0<br>' +
				_('This allows the router to access the downstream LAN for UPnP reading while preventing unwanted forwarding.') +
				'</div>';
		};

		s.taboption('zone_config', form.Value, 'firewall_zone_name', _('Zone Name'),
			_('Name of the firewall zone for the read interface.'));

		s = m.section(form.TypedSection, 'service', _('Zone Actions'));
		s.anonymous = true;

		o = s.option(form.Button, '_fix_zone', _('Fix Zone'));
		o.inputtitle = _('Fix Zone Settings');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var btn = this;
			if (btn.node) {
				btn.node.disabled = true;
				btn.node.textContent = _('Applying...');
			}
			return callFixZone().then(function(result) {
				return callCheckNetwork().catch(function() {
					return result;
				});
			}).then(function(result) {
				ui.addNotification(null, E('p', _('Zone settings fixed.')), 'info');
				utils.reloadSoon();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Zone fix failed: ') + e.message), 'error');
			}).finally(function() {
				if (btn.node) {
					btn.node.disabled = false;
					btn.node.textContent = _('Fix Zone Settings');
				}
			});
		};

		o = s.option(form.Button, '_create_zone', _('Create Independent Zone'));
		o.inputtitle = _('Create Zone');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var zoneName = uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge';
			if (hasNetCheckData() && netCheckData.zone_exists === 1) {
				ui.addNotification(null, E('p', _('Zone "%s" already exists. Use "Fix Zone Settings" instead.').format(zoneName)), 'warning');
				return;
			}

			var btn = this;
			if (btn.node) {
				btn.node.disabled = true;
				btn.node.textContent = _('Creating...');
			}
			return callFixZone().then(function(result) {
				return callCheckNetwork().catch(function() {
					return result;
				});
			}).then(function(result) {
				ui.addNotification(null, E('p', _('Zone created successfully.')), 'info');
				utils.reloadSoon();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Zone creation failed: ') + e.message), 'error');
			}).finally(function() {
				if (btn.node) {
					btn.node.disabled = false;
					btn.node.textContent = _('Create Zone');
				}
			});
		};

		return m.render();
	}
});
