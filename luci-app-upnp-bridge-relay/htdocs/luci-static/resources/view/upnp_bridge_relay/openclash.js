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

var callCheckEnv = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'check-env',
	expect: { '': {} }
});

var callSetupOpenclash = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'setup-openclash',
	expect: { '': {} }
});

var callRemoveOpenclashRule = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'remove-openclash-rule',
	expect: { '': {} }
});

var callRollback = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'rollback',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('upnp_bridge_relay'),
			uci.load('openclash').catch(function() {}),
			callStatus(),
			callCheckEnv()
		]).then(function(results) {
			return {
				status: results[2],
				env: results[3]
			};
		});
	},

	render: function(data) {
		var m, s, o;
		var status = data.status || {};
		var env = data.env || {};

		m = new form.Map('upnp_bridge_relay', _('UPnP Bridge Relay - OpenClash Compatibility'));

		s = m.section(form.TypedSection, 'service', _('OpenClash Status'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_oc_installed', _('OpenClash Installed'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (env.openclash_installed === 1 || env.openclash_installed === true) {
				return '<span style="color:green">&#10004; Installed</span>';
			}
			return '<span style="color:gray">&#10008; Not Installed</span>';
		};

		o = s.option(form.DummyValue, '_oc_running', _('OpenClash Running'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (env.openclash_running === 1 || env.openclash_running === true) {
				return '<span style="color:green">&#10004; Running</span>';
			}
			return '<span style="color:orange">&#10008; Not Running</span>';
		};

		o = s.option(form.DummyValue, '_oc_access_control', _('Source Access Control Detected'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (env.openclash_has_access_control === 1 || env.openclash_has_access_control === true) {
				return '<span style="color:green">&#10004; Detected</span>';
			}
			return '<span style="color:orange">&#10008; Not Detected</span>';
		};

		o = s.option(form.DummyValue, '_oc_existing_rule', _('Existing Matching Rule'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var remark = uci.get('upnp_bridge_relay', 'main', 'openclash_rule_remark') || 'UPnP Bridge Relay Auto RETURN';
			var found = false;
			var sections = uci.sections('openclash', 'access_control');
			if (sections) {
				for (var i = 0; i < sections.length; i++) {
					if (sections[i].remark === remark) {
						found = true;
						break;
					}
				}
			}
			if (found) {
				return '<span style="color:green">&#10004; Rule exists</span>';
			}
			return '<span style="color:orange">&#10008; No matching rule found</span>';
		};

		s = m.section(form.TypedSection, 'service', _('Suggested RETURN Rule'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_oc_suggested_rule', _('Suggested Rule'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var downstreamWanIp = uci.get('upnp_bridge_relay', 'main', 'downstream_wan_ip') || '-';
			var allowedPorts = uci.get('upnp_bridge_relay', 'main', 'allowed_external_ports') || '40000-65535';
			var remark = uci.get('upnp_bridge_relay', 'main', 'openclash_rule_remark') || 'UPnP Bridge Relay Auto RETURN';

			return '<div style="padding:1em;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-family:monospace">' +
				'<b>Internal Address:</b> ' + downstreamWanIp + '<br>' +
				'<b>Internal Ports:</b> ' + allowedPorts + '<br>' +
				'<b>Protocol:</b> TCP/UDP<br>' +
				'<b>Action:</b> RETURN<br>' +
				'<b>Remark:</b> ' + remark +
				'</div>';
		};

		s = m.section(form.TypedSection, 'service', _('OpenClash Configuration'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'openclash_mode', _('Auto Write Mode'),
			_('Control how OpenClash RETURN rules are handled.'));
		o.value('off', _('Off - Do not handle OpenClash'));
		o.value('prompt', _('Prompt - Show suggested rules only'));
		o.value('auto', _('Auto - Automatically write rules'));

		o = s.option(form.ListValue, 'openclash_return_strategy', _('RETURN Strategy'),
		_('Strategy for generating RETURN rules.'));
	o.value('port_pool', _('Port Pool RETURN (recommended)'));

		o = s.option(form.Value, 'openclash_rule_remark', _('Rule Remark'),
			_('Remark text for the OpenClash RETURN rule.'));
		o.datatype = 'string';
		o.placeholder = 'UPnP Bridge Relay Auto RETURN';

		o = s.option(form.Flag, 'openclash_backup', _('Backup Before Write'),
			_('Create a backup of OpenClash configuration before writing rules.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'openclash_auto_restart', _('Auto Restart OpenClash'),
			_('Automatically restart OpenClash service after writing rules so changes take effect immediately. Without this, you need to restart OpenClash manually.'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.DummyValue, '_oc_backup_status', _('Backup Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<span style="color:gray">Check via Diagnostics page</span>';
		};

		s = m.section(form.TypedSection, 'service', _('OpenClash Actions'));
		s.anonymous = true;

		o = s.option(form.Button, '_generate_rule', _('Generate Rule'));
		o.inputtitle = _('Generate RETURN Rule');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var downstreamWanIp = uci.get('upnp_bridge_relay', 'main', 'downstream_wan_ip') || '-';
			var allowedPorts = uci.get('upnp_bridge_relay', 'main', 'allowed_external_ports') || '40000-65535';
			var remark = uci.get('upnp_bridge_relay', 'main', 'openclash_rule_remark') || 'UPnP Bridge Relay Auto RETURN';

			var ruleText = 'Internal Address: ' + downstreamWanIp + '\n' +
				'Internal Ports: ' + allowedPorts + '\n' +
				'Protocol: TCP/UDP\n' +
				'Action: RETURN\n' +
				'Remark: ' + remark;

			ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap;padding:1em;background:#f5f5f5;border:1px solid #ddd' }, ruleText), 'info');
		};

		o = s.option(form.Button, '_write_oc', _('Write to OpenClash'));
		o.inputtitle = _('Write OpenClash Rule');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callSetupOpenclash().then(function(result) {
				var autoRestart = uci.get('upnp_bridge_relay', 'main', 'openclash_auto_restart');
				var msg;
				if (autoRestart === '1') {
					if (result && result.restart && result.restart.restarted) {
						msg = _('OpenClash rule written and service restarted. Changes are now active.');
					} else if (result && result.restart && result.restart.error === 'not_running') {
						msg = _('OpenClash rule written. OpenClash is not running, so it was not restarted. The rule will take effect when OpenClash starts.');
					} else if (result && result.restart && result.restart.error === 'disabled_by_other_tool') {
						msg = _('OpenClash rule written. OpenClash is currently disabled (possibly by another tool like CloudflareSpeedTest), so it was not restarted to avoid interference.');
					} else {
						msg = _('OpenClash rule written, but restart may have failed. Please check OpenClash status manually.');
					}
				} else {
					msg = _('OpenClash rule written. You need to restart OpenClash for changes to take effect.');
				}
				ui.addNotification(null, E('p', msg), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to write OpenClash rule: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_remove_oc', _('Remove Plugin Rule'));
		o.inputtitle = _('Remove Plugin Rule');
		o.inputstyle = 'reset';
		o.onclick = function() {
			return callRemoveOpenclashRule().then(function(result) {
				ui.addNotification(null, E('p', _('Plugin rule removed from OpenClash.')), 'info');
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to remove rule: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_backup_oc', _('Backup OpenClash Config'));
		o.inputtitle = _('Backup');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var remark = uci.get('upnp_bridge_relay', 'main', 'openclash_rule_remark') || 'UPnP Bridge Relay Auto RETURN';
			var backupPath = '/etc/config/openclash.bak.upnp_bridge_relay';
			ui.addNotification(null, E('p', _('Backup is created automatically before writing rules. To manually create a backup now, run on the router:') + '<br><code>cp /etc/config/openclash ' + backupPath + '</code>'), 'info');
		};

		o = s.option(form.Button, '_restore_oc', _('Restore Backup'));
		o.inputtitle = _('Restore');
		o.inputstyle = 'reset';
		o.onclick = function() {
			return callRemoveOpenclashRule().then(function(result) {
				if (result && result.method === 'backup_restored') {
					ui.addNotification(null, E('p', _('OpenClash configuration restored from backup.')), 'info');
				} else if (result && result.removed === 0) {
					ui.addNotification(null, E('p', _('No backup found and no matching rules to remove.')), 'warning');
				} else {
					ui.addNotification(null, E('p', _('Plugin rules removed from OpenClash via UCI.')), 'info');
				}
				window.location.reload();
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Restore failed: ') + e.message), 'error');
			});
		};

		return m.render();
	}
});
