'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';

var callCheckNetwork = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'check-network',
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
			uci.load('network'),
			uci.load('firewall'),
			callCheckNetwork()
		]).then(function(results) {
			return results[3];
		});
	},

	render: function(netCheck) {
		var m, s, o;

		m = new form.Map('upnp_bridge_relay', _('UPnP Bridge Relay - Network & Firewall'));

		s = m.section(form.TypedSection, 'service', _('Network Interface'));
		s.anonymous = true;
		s.tab('status', _('Status'));
		s.tab('config', _('Configuration'));

		s.taboption('config', form.Value, 'bind_ifname', _('Read Interface'),
			_('The interface connected to the downstream router LAN side.'));

		s.taboption('config', form.Value, 'bind_ip', _('Interface IP'),
			_('IP address on the read interface.'));

		s.taboption('config', form.Value, 'downstream_lan_gateway', _('Downstream LAN Gateway'),
			_('Downstream router LAN gateway IP.'));

		s.taboption('config', form.Value, 'downstream_lan_subnet', _('Downstream LAN Subnet'),
			_('Downstream router LAN subnet (CIDR).'));

		s.taboption('config', form.Value, 'downstream_wan_ip', _('Downstream WAN IP'),
			_('Downstream router WAN IP (DNAT target).'));

		s.taboption('config', form.Value, 'upstream_wan_if', _('Upstream WAN Interface'),
			_('The WAN interface for DNAT rules.'));

		o = s.taboption('status', form.DummyValue, '_if_status', _('Interface Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (netCheck && netCheck.iface_exists === 1) {
				return '<span style="color:green">&#10004; ' + _('Interface exists') + '</span>';
			}
			return '<span style="color:red">&#10008; ' + _('Interface not found') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_ip_status', _('IP Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (netCheck && netCheck.bind_ip_configured === 1) {
				return '<span style="color:green">&#10004; ' + _('IP configured') + '</span>';
			}
			return '<span style="color:red">&#10008; ' + _('IP not configured') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_default_route', _('Default Route Risk'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (netCheck && netCheck.default_route_on_bind === 1) {
				return '<span style="color:red;font-weight:bold">&#9888; ' + _('Default route points to read interface!') + '</span>' +
					'<p style="color:orange">' + _('The read interface should NOT be a default gateway.') + '</p>';
			}
			return '<span style="color:green">&#10004; ' + _('No default route risk') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_gateway_set', _('Gateway Setting'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var gw = uci.get('network', 'upnp_bridge_lan', 'gateway');
			if (gw) {
				return '<span style="color:red">&#9888; ' + _('Gateway is set: %s').format(gw) + '</span>' +
					'<p style="color:orange">' + _('The read interface should not have a gateway configured.') + '</p>';
			}
			return '<span style="color:green">&#10004; ' + _('No gateway set') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_dns_set', _('DNS Setting'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var dns = uci.get('network', 'upnp_bridge_lan', 'dns');
			if (dns) {
				return '<span style="color:orange">&#9888; ' + _('DNS is set: %s').format(dns) + '</span>';
			}
			return '<span style="color:green">&#10004; ' + _('No DNS set') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_forwarding', _('Extra Forwarding'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (netCheck && netCheck.bad_forwarding === 1) {
				return '<span style="color:orange">&#9888; ' + _('Unnecessary forwarding detected') + '</span>';
			}
			return '<span style="color:green">&#10004; ' + _('No extra forwarding') + '</span>';
		};

		o = s.taboption('status', form.DummyValue, '_hint', _('Hint'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div style="padding:0.5em;background:#fff3cd;border:1px solid #ffc107;border-radius:4px">' +
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
			return callCheckNetwork().then(function(result) {
				ui.addNotification(null, E('p', _('Network detection completed.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Detection failed: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_setup_interface', _('Configure Interface'));
		o.inputtitle = _('Auto Configure');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callSetupInterface().then(function(result) {
				ui.addNotification(null, E('p', _('Interface configured. Check the status tab for details.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Interface configuration failed: ') + e.message), 'error');
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
			return zoneName;
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_input', _('Input Policy'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var zoneName = uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge';
			var zones = uci.sections('firewall', 'zone');
			for (var i = 0; i < zones.length; i++) {
				if (zones[i].name === zoneName) {
					var input = zones[i].input || '-';
					if (input === 'ACCEPT') {
						return '<span style="color:green">' + input + '</span>';
					}
					return '<span style="color:red">' + input + ' ' + _('(should be ACCEPT)') + '</span>';
				}
			}
			return '<span style="color:orange">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_output', _('Output Policy'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var zoneName = uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge';
			var zones = uci.sections('firewall', 'zone');
			for (var i = 0; i < zones.length; i++) {
				if (zones[i].name === zoneName) {
					var output = zones[i].output || '-';
					if (output === 'ACCEPT') {
						return '<span style="color:green">' + output + '</span>';
					}
					return '<span style="color:red">' + output + ' ' + _('(should be ACCEPT)') + '</span>';
				}
			}
			return '<span style="color:orange">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_forward', _('Forward Policy'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var zoneName = uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge';
			var zones = uci.sections('firewall', 'zone');
			for (var i = 0; i < zones.length; i++) {
				if (zones[i].name === zoneName) {
					var forward = zones[i].forward || '-';
					if (forward === 'REJECT') {
						return '<span style="color:green">' + forward + '</span>';
					}
					return '<span style="color:red">' + forward + ' ' + _('(should be REJECT)') + '</span>';
				}
			}
			return '<span style="color:orange">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_maq', _('Masquerading'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var zoneName = uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge';
			var zones = uci.sections('firewall', 'zone');
			for (var i = 0; i < zones.length; i++) {
				if (zones[i].name === zoneName) {
					var masq = zones[i].masq || '0';
					if (masq === '0') {
						return '<span style="color:green">' + _('Disabled') + '</span>';
					}
					return '<span style="color:red">' + _('Enabled (should be Disabled)') + '</span>';
				}
			}
			return '<span style="color:orange">' + _('Zone not found') + '</span>';
		};

		o = s.taboption('zone_status', form.DummyValue, '_zone_recommendation', _('Recommendation'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div style="padding:0.5em;background:#d9edf7;border:1px solid #bce8f1;border-radius:4px">' +
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
			return callFixZone().then(function(result) {
				ui.addNotification(null, E('p', _('Zone settings fixed.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Zone fix failed: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_create_zone', _('Create Independent Zone'));
		o.inputtitle = _('Create Zone');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var zoneName = uci.get('upnp_bridge_relay', 'main', 'firewall_zone_name') || 'upnp_bridge';

			var zones = uci.sections('firewall', 'zone');
			for (var i = 0; i < zones.length; i++) {
				if (zones[i].name === zoneName) {
					ui.addNotification(null, E('p', _('Zone "%s" already exists. Use "Fix Zone Settings" instead.').format(zoneName)), 'warning');
					return;
				}
			}

			return callFixZone().then(function(result) {
				ui.addNotification(null, E('p', _('Zone created successfully.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Zone creation failed: ') + e.message), 'error');
			});
		};

		return m.render();
	}
});
