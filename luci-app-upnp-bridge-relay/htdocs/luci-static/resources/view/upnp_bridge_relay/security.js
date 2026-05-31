'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';

return view.extend({
	load: function() {
		return uci.load('upnp_bridge_relay');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('upnp_bridge_relay', _('UPnP Bridge Relay - Security Filter'));

		s = m.section(form.TypedSection, 'service', _('Port Range & Protocol'));
		s.anonymous = true;

		o = s.option(form.Value, 'allowed_external_ports', _('Allowed External Port Range'),
			_('Port range allowed for synchronization (e.g. 40000-65535).'));
		o.datatype = 'string';
		o.placeholder = '40000-65535';
		o.rmempty = false;

		o = s.option(form.MultiValue, 'protocols', _('Allowed Protocols'),
			_('Select which protocols to allow for synchronization.'));
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.delimiter = ' ';

		s = m.section(form.TypedSection, 'service', _('Deny Rules'));
		s.anonymous = true;

		o = s.option(form.DynamicList, '_deny_ports', _('Denied Ports'),
			_('List of specific ports to deny even if within the allowed range.'));
		o.datatype = 'port';

		var denyPorts = uci.get('upnp_bridge_relay', 'default', 'port');
		if (denyPorts) {
			if (typeof denyPorts === 'string') {
				o.cfgvalue = function() {
					return [denyPorts];
				};
			} else if (Array.isArray(denyPorts)) {
				o.cfgvalue = function() {
					return denyPorts;
				};
			}
		}
		o.write = function(section_id, value) {
			if (Array.isArray(value)) {
				uci.set('upnp_bridge_relay', 'default', 'port', value);
			} else {
				uci.set('upnp_bridge_relay', 'default', 'port', value ? [value] : []);
			}
		};

		o = s.option(form.Flag, '_deny_low_ports', _('Deny Low Ports (0-1023)'),
			_('Deny all privileged ports (0-1023). It is NOT recommended to sync these ports.'));
		o.uciconfig = 'upnp_bridge_relay';
		o.ucisection = 'main';
		o.ucioption = 'deny_low_ports';
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.TypedSection, 'service', _('Source Filtering'));
		s.anonymous = true;

		o = s.option(form.Flag, '_restrict_subnet', _('Restrict to Downstream LAN Subnet'),
			_('Only allow mappings with internal IPs in the downstream LAN subnet.'));
		o.uciconfig = 'upnp_bridge_relay';
		o.ucisection = 'main';
		o.ucioption = 'restrict_to_subnet';
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, '_deny_empty_desc', _('Deny Empty Description Mappings'),
			_('Reject mappings without a description. These may be suspicious.'));
		o.uciconfig = 'upnp_bridge_relay';
		o.ucisection = 'main';
		o.ucioption = 'deny_empty_description';
		o.default = '0';

		o = s.option(form.Flag, '_log_rejected', _('Log Rejected Mappings'),
			_('Write rejected mappings to the system log.'));
		o.uciconfig = 'upnp_bridge_relay';
		o.ucisection = 'main';
		o.ucioption = 'log_rejected';
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.TypedSection, 'service', _('Security Warnings'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_warn1', _('Low Port Warning'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div class="alert-message danger">' +
				_('It is NOT recommended to synchronize ports 0-1023. These are privileged ports and should not be exposed via UPnP.') +
				'</div>';
		};

		o = s.option(form.DummyValue, '_warn2', _('Sensitive Port Warning'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div class="alert-message danger">' +
				_('It is NOT recommended to synchronize sensitive ports such as 80, 443, 22, 53, 445, 3389. ' +
					'These are commonly used for web servers, SSH, DNS, file sharing, and remote desktop.') +
				'</div>';
		};

		o = s.option(form.DummyValue, '_warn3', _('Wide Range Warning'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div class="alert-message danger">' +
				_('It is NOT recommended to use 1-65535 as the allowed port range. ' +
					'This would effectively create a DMZ, which defeats the purpose of this plugin.') +
				'</div>';
		};

		return m.render();
	}
});
