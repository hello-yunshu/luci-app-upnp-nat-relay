'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function() {
		return uci.load('upnp_bridge_relay');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('upnp_bridge_relay', _('UPnP Bridge Relay - Settings'));

		s = m.section(form.TypedSection, 'service', _('Service & Sync'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable Automatic Sync'),
			_('Run the background service and periodically synchronize accepted UPnP mappings.'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'interval', _('Sync Interval (seconds)'),
			_('How often the background service checks the downstream router.'));
		o.datatype = 'range(10,86400)';
		o.placeholder = '60';
		o.rmempty = false;

		o = s.option(form.ListValue, 'backend', _('UPnP Backend'),
			_('Command used to read UPnP mappings from the downstream router.'));
		o.value('upnpc', 'upnpc');
		o.value('custom', _('Custom'));
		o.default = 'upnpc';
		o.rmempty = false;

		o = s.option(form.Flag, 'dry_run', _('Dry Run Mode'),
			_('Read and filter mappings without creating DNAT rules.'));
		o.default = '0';

		o = s.option(form.Flag, 'clear_on_stop', _('Clear Rules on Stop'),
			_('Remove dynamic DNAT rules when the service stops.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'failure_grace_count', _('Failure Grace Count'),
			_('Clear rules after this many consecutive sync failures. Set to 0 to never clear because of failures.'));
		o.datatype = 'range(0,100)';
		o.placeholder = '3';
		o.rmempty = false;

		s = m.section(form.TypedSection, 'service', _('Automation'));
		s.anonymous = true;

		o = s.option(form.Flag, 'auto_config_network', _('Auto Configure Network'),
			_('Allow automatic setup flows to create or repair the read interface before testing.'));
		o.default = '0';

		o = s.option(form.Flag, 'auto_config_firewall_zone', _('Auto Configure Firewall Zone'),
			_('Allow automatic setup flows to create or repair the independent firewall zone before testing.'));
		o.default = '0';

		o = s.option(form.Flag, 'openclash_auto_restart', _('Auto Restart OpenClash'),
			_('Restart OpenClash automatically after writing rules.'));
		o.default = '0';

		s = m.section(form.TypedSection, 'service', _('Logging'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'log_level', _('Log Level'),
			_('Controls the verbosity of system log output.'));
		o.value('debug', 'debug');
		o.value('info', 'info');
		o.value('warn', 'warn');
		o.value('error', 'error');
		o.default = 'info';
		o.rmempty = false;

		return m.render();
	}
});
