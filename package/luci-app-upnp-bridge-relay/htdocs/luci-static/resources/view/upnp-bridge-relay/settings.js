'use strict';
'require view';
'require ui';
'require rpc';
'require dom';
'require form';
'require uci';
'require upnp-bridge-relay/utils as utils';

var callStatus = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'status',
	expect: { '': {} }
});

var callServiceRestart = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'restart',
	expect: { '': {} }
});

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

		o = s.option(form.Flag, 'openclash_auto_restart', _('Auto Restart OpenClash After Rule Write'),
			_('Automatically restart OpenClash service after writing rules so changes take effect immediately. Without this, you need to restart OpenClash manually.'));
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

		return utils.renderWithFooter(m.render(), {
			project: 'UPnP Bridge Relay',
			repoUrl: 'https://github.com/hello-yunshu/upnp-bridge-relay'
		});
	},

	handleSave: function(ev) {
		var tasks = [];

		document.getElementById('maincontent')
			.querySelectorAll('.cbi-map').forEach(function(map) {
				tasks.push(dom.callClassMethod(map, 'save'));
			});

		return Promise.all(tasks);
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			return utils.safeApply();
		}).then(function() {
			return uci.load('upnp_bridge_relay');
		}).then(function() {
			if (uci.get('upnp_bridge_relay', 'main', 'enabled') !== '1') {
				ui.addNotification(null, E('p', _('Configuration saved and applied.')), 'info');
				utils.reloadSoon(600);
				return;
			}

			ui.addNotification(null, E('p', _('Configuration saved. Restarting service and waiting for first sync...')), 'info');
			return callServiceRestart().then(utils.requireSuccess).then(function() {
				return utils.waitForServiceReady(callStatus);
			}).then(function(status) {
				if (status && status.last_result === 'starting')
					ui.addNotification(null, E('p', _('Service restart completed, but the first sync is still starting. Refreshing current status.')), 'warning');
				else
					ui.addNotification(null, E('p', _('Configuration applied and service is ready.')), 'info');
				utils.reloadSoon(300);
			});
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Failed to apply configuration: ') + e.message), 'error');
		});
	}
});
