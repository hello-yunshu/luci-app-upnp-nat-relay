'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require form';
'require upnp-bridge-relay/utils as utils';

var OPENCLASH_RULE_COMMENT = 'upnp_bridge_relay_openclash';

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

var callRestartOpenclash = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'restart-openclash',
	expect: { '': {} }
});

var callRemoveOpenclashRule = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'remove-openclash-rule',
	expect: { '': {} }
});

var callGenerateOpenclashRule = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'generate-openclash-rule',
	expect: { '': {} }
});

var callOpenclashRuleCache = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'openclash-rule-cache',
	expect: { '': {} }
});

var callSyncOpenclash = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'sync-openclash',
	expect: { '': {} }
});

var callRollback = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'rollback',
	expect: { '': {} }
});

function htmlEscape(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function buildFallbackRuleText(strategy, downstreamWanIp, allowedPorts, remark) {
	if (strategy === 'per_mapping') {
		return 'Strategy: Per-Mapping\n' +
			'Internal Address: ' + downstreamWanIp + '\n' +
			'Internal Ports: <dynamic, comma-separated per protocol>\n' +
			'Protocol: 1 rule for TCP, 1 rule for UDP\n' +
			'Action: RETURN\n' +
			'Remark: ' + remark + ' [TCP] / ' + remark + ' [UDP]\n\n' +
			'Example (3 TCP + 2 UDP mappings):\n' +
			'  Rule 1: ports=54321,54322,54323  proto=tcp  remark="' + remark + ' [TCP]"\n' +
			'  Rule 2: ports=54324,54325        proto=udp  remark="' + remark + ' [UDP]"';
	}

	return 'Strategy: Port Pool\n' +
		'Internal Address: ' + downstreamWanIp + '\n' +
		'Internal Ports: ' + allowedPorts + '\n' +
		'Protocol: TCP/UDP\n' +
		'Action: RETURN\n' +
		'Remark: ' + remark;
}

function buildSuggestedRuleHtml(strategy, downstreamWanIp, allowedPorts, remark, dryRun) {
	var downstreamWanIpText = downstreamWanIp === '-' ?
		'<span style="color:var(--warning-color, #d89b00)">&#9888; -</span>' :
		'<span style="color:var(--success-color, #3aa657)">' + htmlEscape(downstreamWanIp) + '</span>';
	var suggestion = dryRun && dryRun.openclash_suggestion ? dryRun.openclash_suggestion : null;
	var html = '<div id="ubr-oc-suggested-rule" class="cbi-section" style="font-family:monospace">';

	if (suggestion && suggestion.strategy === 'per_mapping' && Array.isArray(suggestion.rules) && suggestion.rules.length > 0) {
		html += '<b>' + _('Strategy:') + '</b> <span style="color:var(--main-color, #0069d9)">' + _('Per-Mapping') + '</span><br>';
		for (var i = 0; i < suggestion.rules.length; i++) {
			var rule = suggestion.rules[i] || {};
			var srcIp = rule.src_ip || rule.internal_address || downstreamWanIp;
			var srcPort = rule.src_port || rule.internal_ports || '-';
			var proto = rule.proto || rule.protocols || '-';
			html += '<br><b>' + _('Rule') + ' ' + (i + 1) + '</b><br>' +
				'<b>' + _('Source Address:') + '</b> ' + htmlEscape(srcIp) + '<br>' +
				'<b>' + _('Source Ports:') + '</b> <span style="color:var(--main-color, #0069d9)">' + htmlEscape(srcPort) + '</span><br>' +
				'<b>' + _('Protocol:') + '</b> ' + htmlEscape(proto) + '<br>' +
				'<b>' + _('Action:') + '</b> <span style="color:var(--success-color, #3aa657)">' + htmlEscape(rule.target || 'return') + '</span><br>' +
				'<b>' + _('Remark:') + '</b> ' + htmlEscape(rule.remark || '');
		}
		return html + '</div>';
	}

	if (suggestion && suggestion.strategy === 'port_pool') {
		var poolSrcIp = suggestion.src_ip || suggestion.internal_address || downstreamWanIp;
		var poolSrcPort = suggestion.src_port || suggestion.internal_ports || allowedPorts;
		var poolProto = suggestion.proto || suggestion.protocols || 'both';
		return html +
			'<b>' + _('Strategy:') + '</b> <span style="color:var(--main-color, #0069d9)">' + _('Port Pool') + '</span><br>' +
			'<b>' + _('Source Address:') + '</b> ' + htmlEscape(poolSrcIp) + '<br>' +
			'<b>' + _('Source Ports:') + '</b> <span style="color:var(--main-color, #0069d9)">' + htmlEscape(poolSrcPort) + '</span><br>' +
			'<b>' + _('Protocol:') + '</b> ' + htmlEscape(poolProto) + '<br>' +
			'<b>' + _('Action:') + '</b> <span style="color:var(--success-color, #3aa657)">' + htmlEscape(suggestion.target || 'return') + '</span><br>' +
			'<b>' + _('Remark:') + '</b> ' + htmlEscape(suggestion.remark || remark) +
			'</div>';
	}

	if (strategy === 'per_mapping') {
		return html +
			'<b>' + _('Strategy:') + '</b> <span style="color:var(--main-color, #0069d9)">' + _('Per-Mapping') + '</span><br>' +
			'<b>' + _('Source Address:') + '</b> ' + downstreamWanIpText + '<br>' +
			'<b>' + _('Source Ports:') + '</b> <span style="color:var(--main-color, #0069d9)">' + _('Dynamic (comma-separated, grouped by protocol)') + '</span><br>' +
			'<b>' + _('Protocol:') + '</b> ' + _('Per protocol (1 rule for TCP, 1 rule for UDP)') + '<br>' +
			'<b>' + _('Action:') + '</b> <span style="color:var(--success-color, #3aa657)">return</span><br>' +
			'<b>' + _('Remark:') + '</b> ' + htmlEscape(remark) + ' [TCP] / ' + htmlEscape(remark) + ' [UDP]' +
			'</div>';
	}

	return html +
		'<b>' + _('Strategy:') + '</b> <span style="color:var(--main-color, #0069d9)">' + _('Port Pool') + '</span><br>' +
		'<b>' + _('Source Address:') + '</b> ' + downstreamWanIpText + '<br>' +
		'<b>' + _('Source Ports:') + '</b> <span style="color:var(--main-color, #0069d9)">' + htmlEscape(allowedPorts) + '</span><br>' +
		'<b>' + _('Protocol:') + '</b> both<br>' +
		'<b>' + _('Action:') + '</b> <span style="color:var(--success-color, #3aa657)">return</span><br>' +
		'<b>' + _('Remark:') + '</b> ' + htmlEscape(remark) +
		'</div>';
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('upnp_bridge_relay'),
			uci.load('openclash').catch(function() {}),
			callStatus(),
			callCheckEnv(),
			callOpenclashRuleCache()
		]).then(function(results) {
			return {
				status: results[2],
				env: results[3],
				ruleCache: results[4]
			};
		});
	},

	render: function(data) {
		utils.loadSharedCSS();
		var m, s, o;
		var status = data.status || {};
		var env = data.env || {};
		var ruleCache = data.ruleCache || {};

		m = new form.Map('upnp_bridge_relay', _('OpenClash Compatibility'));

		s = m.section(form.TypedSection, 'service', _('OpenClash Status'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_oc_installed', _('OpenClash Installed'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (env.openclash_installed === 1 || env.openclash_installed === true) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Installed') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">&#10008; ' + _('Not Installed') + '</span>';
		};

		o = s.option(form.DummyValue, '_oc_running', _('OpenClash Running'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (env.openclash_running === 1 || env.openclash_running === true) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Running') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">&#10008; ' + _('Not Running') + '</span>';
		};

		o = s.option(form.DummyValue, '_oc_access_control', _('Source Access Control Detected'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			if (env.openclash_has_access_control === 1 || env.openclash_has_access_control === true) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Detected') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">&#10008; ' + _('Not Detected') + '</span>';
		};

		o = s.option(form.DummyValue, '_oc_existing_rule', _('Existing Matching Rule'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var found = false;
			var sections = uci.sections('openclash', 'lan_ac_traffic');
			if (sections) {
				for (var i = 0; i < sections.length; i++) {
					if ((sections[i].comment || '') === OPENCLASH_RULE_COMMENT) {
						found = true;
						break;
					}
				}
			}
			if (found) {
				return '<span style="color:var(--success-color, #3aa657)">&#10004; ' + _('Rule exists') + '</span>';
			}
			return '<span style="color:var(--warning-color, #d89b00)">&#10008; ' + _('No matching rule found') + '</span>';
		};

		o = s.option(form.DummyValue, '_oc_last_sync', _('Last OpenClash Sync'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var lastOcSync = status.last_oc_sync;
			if (!lastOcSync) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Not yet synced') + '</span>';
			}
			var syncInterval = uci.get('upnp_bridge_relay', 'main', 'openclash_sync_interval') || '0';
			var ts = parseInt(lastOcSync, 10);
			if (isNaN(ts) || ts === 0) {
				return '<span style="color:var(--subtext-color, #666)">' + _('Not yet synced') + '</span>';
			}
			var d = new Date(ts * 1000);
			var timeStr = d.toLocaleString();
			if (syncInterval !== '0') {
				var now = Math.floor(Date.now() / 1000);
				var elapsed = now - ts;
				var remaining = parseInt(syncInterval, 10) - elapsed;
				if (remaining > 0) {
					return '<span style="color:var(--success-color, #3aa657)">' + timeStr + '</span>' +
						' <span style="color:var(--subtext-color, #666)">(' + _('next in %ds').format(remaining) + ')</span>';
				} else {
					return '<span style="color:var(--success-color, #3aa657)">' + timeStr + '</span>' +
						' <span style="color:var(--main-color, #0069d9)">(' + _('due now') + ')</span>';
				}
			}
			return '<span style="color:var(--success-color, #3aa657)">' + timeStr + '</span>';
		};

		s = m.section(form.TypedSection, 'service', _('Suggested RETURN Rule'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_oc_suggested_rule', _('Suggested Rule'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var strategy = uci.get('upnp_bridge_relay', 'main', 'openclash_return_strategy') || 'per_mapping';
			var downstreamWanIp = uci.get('upnp_bridge_relay', 'main', 'downstream_wan_ip') || '-';
			var allowedPorts = uci.get('upnp_bridge_relay', 'main', 'allowed_external_ports') || '40000-65535';
			var remark = uci.get('upnp_bridge_relay', 'main', 'openclash_rule_remark') || 'UPnP Bridge Relay Auto RETURN';
			return buildSuggestedRuleHtml(strategy, downstreamWanIp, allowedPorts, remark, ruleCache);
		};

		s = m.section(form.TypedSection, 'service', _('OpenClash Configuration'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'openclash_mode', _('Auto Write Mode'),
			_('Control how OpenClash RETURN rules are handled.'));
		o.value('off', _('Off - Do not handle OpenClash'));
		o.value('prompt', _('Prompt - Show suggested rules only'));
		o.value('auto', _('Auto - Automatically write rules'));
		o.default = 'prompt';

		o = s.option(form.ListValue, 'openclash_return_strategy', _('RETURN Strategy'),
			_('Strategy for generating RETURN rules. Per-Mapping creates one rule per UPnP port mapping (precise). Port Pool creates one rule covering the entire port range (broad).'));
		o.value('per_mapping', _('Per-Mapping RETURN (recommended)'));
		o.value('port_pool', _('Port Pool RETURN'));

		o = s.option(form.Value, 'openclash_rule_remark', _('Rule Remark'),
			_('Remark text for the OpenClash RETURN rule.'));
		o.datatype = 'string';
		o.placeholder = 'UPnP Bridge Relay Auto RETURN';

		o = s.option(form.Flag, 'openclash_backup', _('Backup Before Write'),
			_('Create a backup of OpenClash configuration before writing rules.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'openclash_auto_restart', _('Auto Restart OpenClash After Rule Write'),
			_('Automatically restart OpenClash service after writing rules so changes take effect immediately. Without this, you need to restart OpenClash manually.'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'openclash_sync_interval', _('OpenClash Sync Interval (seconds)'),
			_('How often to sync OpenClash RETURN rules. Set to 0 to sync every main sync cycle (default). Set higher values (e.g., 300) to reduce OpenClash config writes and restarts when mappings change frequently.'));
		o.datatype = 'range(0,86400)';
		o.placeholder = '0';
		o.rmempty = false;

		o = s.option(form.DummyValue, '_oc_backup_status', _('Backup Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<span style="color:var(--subtext-color, #666)">' + _('Auto-created before each rule write') + '</span>';
		};

		s = m.section(form.TypedSection, 'service', _('OpenClash Actions'));
		s.anonymous = true;

		o = s.option(form.Button, '_sync_oc_now', _('Sync OpenClash Now'));
		o.inputtitle = _('Sync OpenClash');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callSyncOpenclash().then(function(result) {
				result = result || {};
				if (result.success === true) {
					var action = result.action || 'updated';
					var rulesCount = result.rules_count || 0;
					if (action === 'unchanged') {
						ui.addNotification(null, E('p', _('OpenClash rules are already up to date (%d rules).').format(rulesCount)), 'info');
					} else {
						ui.addNotification(null, E('p', _('OpenClash rules synced successfully (%d rules).').format(rulesCount)), 'info');
					}
				} else {
					var errorMsg = result.message || result.error || 'unknown';
					if (result.error === 'main_sync_running') {
						ui.addNotification(null, E('p', _('Main sync is currently running, please try again later.')), 'warning');
					} else if (result.error === 'openclash_operation_running') {
						ui.addNotification(null, E('p', _('Another OpenClash operation is currently running.')), 'warning');
					} else {
						ui.addNotification(null, E('p', _('Failed to sync OpenClash: ') + errorMsg), 'error');
					}
				}
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to sync OpenClash: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_generate_rule', _('Generate Rule'));
		o.inputtitle = _('Generate RETURN Rule');
		o.inputstyle = 'apply';
		o.onclick = function() {
			var strategy = uci.get('upnp_bridge_relay', 'main', 'openclash_return_strategy') || 'per_mapping';
			var downstreamWanIp = uci.get('upnp_bridge_relay', 'main', 'downstream_wan_ip') || '-';
			var allowedPorts = uci.get('upnp_bridge_relay', 'main', 'allowed_external_ports') || '40000-65535';
			var remark = uci.get('upnp_bridge_relay', 'main', 'openclash_rule_remark') || 'UPnP Bridge Relay Auto RETURN';
			var preview = document.getElementById('ubr-oc-suggested-rule');

			if (preview)
				preview.innerHTML = '<span style="color:var(--subtext-color, #666)">' + _('Generating...') + '</span>';

			return callGenerateOpenclashRule().then(function(result) {
				if (preview)
					preview.outerHTML = buildSuggestedRuleHtml(strategy, downstreamWanIp, allowedPorts, remark, result);
				ui.addNotification(null, E('p', _('Suggested RETURN rule refreshed.')), 'info');
			}).catch(function(e) {
				if (preview)
					preview.outerHTML = buildSuggestedRuleHtml(strategy, downstreamWanIp, allowedPorts, remark);
				ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap;padding:1em;background:var(--background-color-a);border:1px solid var(--border-color)' }, buildFallbackRuleText(strategy, downstreamWanIp, allowedPorts, remark)), 'warning');
			});
		};

		o = s.option(form.Button, '_write_oc', _('Write to OpenClash'));
		o.inputtitle = _('Write OpenClash Rule');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callSetupOpenclash().then(function(result) {
				var strategy = uci.get('upnp_bridge_relay', 'main', 'openclash_return_strategy') || 'per_mapping';
				var autoRestart = uci.get('upnp_bridge_relay', 'main', 'openclash_auto_restart');
				var msg;
				if (strategy === 'per_mapping') {
					if (result && result.action === 'already_exists') {
						msg = _('Per-mapping rules already exist in OpenClash.');
					} else if (result && result.action === 'updated') {
						if (autoRestart === '1' && result.restart && result.restart.restarted) {
							msg = _('Per-mapping rules written (%d rules) and OpenClash restarted.').format(result.rules_count || 0);
						} else if (autoRestart === '1' && result.restart && result.restart.error === 'not_running') {
							msg = _('Per-mapping rules written (%d rules). OpenClash is not running, so it was not restarted.').format(result.rules_count || 0);
						} else if (autoRestart === '1' && result.restart && result.restart.error === 'disabled_by_other_tool') {
							msg = _('Per-mapping rules written (%d rules). OpenClash is currently disabled, so it was not restarted.').format(result.rules_count || 0);
						} else {
							msg = _('Per-mapping rules written (%d rules). You need to restart OpenClash for changes to take effect.').format(result.rules_count || 0);
						}
					} else if (result && result.action === 'unchanged') {
						msg = _('Per-mapping rules are already up to date (%d rules).').format(result.rules_count || 0);
					} else if (!result || result.success !== true) {
						msg = _('Failed to write per-mapping rules: ') + (result.error || 'unknown');
					} else {
						msg = _('Per-mapping rules written. You need to restart OpenClash for changes to take effect.');
					}
				} else {
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
				}
				ui.addNotification(null, E('p', msg), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to write OpenClash rule: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_remove_oc', _('Remove Plugin Rule'));
		o.inputtitle = _('Remove Plugin Rule');
		o.inputstyle = 'reset';
		o.onclick = function() {
			return callRemoveOpenclashRule().then(function(result) {
				result = result || {};
				if (result.success !== true) {
					ui.addNotification(null, E('p', _('Operation failed: ') + (result.error || 'unknown')), 'error');
					return;
				}
				ui.addNotification(null, E('p', _('Plugin rule removed from OpenClash.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to remove rule: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_restart_oc', _('Restart OpenClash'));
		o.inputtitle = _('Restart OpenClash');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callRestartOpenclash().then(function(result) {
				var msg;
				if (result && result.restarted) {
					msg = _('OpenClash restarted successfully.');
					ui.addNotification(null, E('p', msg), 'info');
				} else if (result && result.error === 'core_not_running_after_restart') {
					msg = _('OpenClash restart command completed, but the core process was not detected after 30 seconds.');
					ui.addNotification(null, E('p', msg), 'warning');
				} else if (result && result.error === 'init_script_not_found') {
					msg = _('OpenClash init script was not found.');
					ui.addNotification(null, E('p', msg), 'error');
				} else if (result && result.error === 'init_restart_failed') {
					msg = _('OpenClash init restart failed.');
					ui.addNotification(null, E('p', msg), 'error');
				} else {
					msg = _('OpenClash restart failed: ') + ((result && result.error) || 'unknown');
					ui.addNotification(null, E('p', msg), 'error');
				}
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Failed to restart OpenClash: ') + e.message), 'error');
			});
		};

		o = s.option(form.Button, '_backup_oc', _('Backup OpenClash Config'));
		o.inputtitle = _('Backup');
		o.inputstyle = 'apply';
		o.onclick = function() {
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
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Restore failed: ') + e.message), 'error');
			});
		};

		return utils.renderWithFooter(m.render(), {
			project: 'UPnP Bridge Relay',
			repoUrl: 'https://github.com/hello-yunshu/upnp-bridge-relay'
		});
	}
});
