'use strict';
'require view';
'require ui';
'require rpc';
'require uci';
'require upnp-bridge-relay/utils';

var callStatus = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'status',
	expect: { '': {} }
});

var callSyncNow = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'sync-now',
	expect: { '': {} }
});

var css = `
	.ubr-mappings { max-width: 100%; }
	.ubr-mappings .cbi-section {
		margin-bottom: 1.5em;
	}
	.ubr-btn-bar {
		display: flex; gap: 1em;
	}
`;

return view.extend({
	load: function() {
		return Promise.all([
			callStatus(),
			uci.load('upnp_bridge_relay')
		]).then(function(results) {
			return results[0];
		});
	},

	render: function(status) {
		var container = E('div', { 'class': 'cbi-map ubr-mappings' });
		container.appendChild(E('style', {}, css));

		container.appendChild(E('h2', { 'class': 'cbi-map-title' }, _('UPnP Bridge Relay - Mappings')));

		var btnBar = E('div', { 'class': 'cbi-section ubr-btn-bar' });
		btnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				var btn = this;
				utils.setBusy(btn, _('Loading...'));
				return callSyncNow().then(function(result) {
					var msg;
					var msgType = 'info';
					if (result && result.success === true) {
						var rc = result.read_count || 0;
						var ac = result.accepted_count || 0;
						var rj = result.rejected_count || 0;
						if (ac > 0) {
							msg = _('Sync completed: %d read, %d accepted, %d rejected.').format(rc, ac, rj);
						} else if (rj > 0) {
							msg = _('Sync completed: %d read, 0 accepted, %d rejected. Check rejected mappings for details.').format(rc, rj);
							msgType = 'warning';
						} else {
							msg = _('Sync completed: 0 mappings read from downstream router. Ensure the downstream router has UPnP mappings.');
							msgType = 'warning';
						}
					} else if (result && result.success === false) {
						msg = _('Sync failed: %s').format(result.error || 'unknown');
						msgType = 'error';
					} else {
						msg = _('Sync triggered.');
					}
					ui.addNotification(null, E('p', msg), msgType);
					utils.reloadSoon(2500);
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Sync failed: %s').format(e.message)), 'error');
					utils.resetBusy(btn);
				});
			}
		}, _('Sync Now')));
		btnBar.appendChild(E('button', {
			'class': 'cbi-button',
			'click': function() {
				window.location.reload();
			}
		}, _('Refresh')));
		container.appendChild(btnBar);

		var rawTable = E('table', { 'class': 'table', 'id': 'raw-mappings-table' }, [
			E('thead', {}, E('tr', {}, [
				E('th', {}, _('Protocol')),
				E('th', {}, _('External Port')),
				E('th', {}, _('Internal IP')),
				E('th', {}, _('Internal Port')),
				E('th', {}, _('Description')),
				E('th', {}, _('Status'))
			]))
		]);

		var rawMappings = (status && status.accepted) ? status.accepted.concat(status.rejected || []) : [];
		if (rawMappings && rawMappings.length > 0) {
			var acceptedPorts = {};
			if (status.accepted) {
				for (var i = 0; i < status.accepted.length; i++) {
					var key = status.accepted[i].protocol + ':' + status.accepted[i].external_port;
					acceptedPorts[key] = true;
				}
			}
			for (var i = 0; i < rawMappings.length; i++) {
				var mapping = rawMappings[i];
				var key = mapping.protocol + ':' + mapping.external_port;
				var statusLabel = acceptedPorts[key] ?
					'<span style="color:var(--success-color, #3aa657)">' + _('Accepted') + '</span>' :
					'<span style="color:var(--danger-color, #d94b4b)">' + _('Rejected') + '</span>';
				var row = E('tr', { 'class': 'tr' }, [
					E('td', {}, mapping.protocol || '-'),
					E('td', {}, String(mapping.external_port || '-')),
					E('td', {}, mapping.internal_ip || '-'),
					E('td', {}, String(mapping.internal_port || '-')),
					E('td', {}, mapping.description || '-'),
					E('td', { 'innerHTML': statusLabel })
				]);
				rawTable.appendChild(row);
			}
		} else {
			rawTable.appendChild(E('tr', {}, E('td', { 'colspan': '6', 'style': 'color:var(--subtext-color, #666)' }, _('No mappings found.'))));
		}
		var rawSection = E('div', { 'class': 'cbi-section' });
		rawSection.appendChild(E('h3', {}, _('Read UPnP Mappings (Raw)')));
		rawSection.appendChild(rawTable);
		container.appendChild(rawSection);

		var syncTable = E('table', { 'class': 'table', 'id': 'synced-mappings-table' }, [
			E('thead', {}, E('tr', {}, [
				E('th', {}, _('Protocol')),
				E('th', {}, _('Public Port')),
				E('th', {}, _('DNAT Target')),
				E('th', {}, _('Source Mapping')),
				E('th', {}, _('Status'))
			]))
		]);

		var accepted = (status && status.accepted) ? status.accepted : [];
		if (accepted.length > 0) {
			var downstreamWanIp = uci.get('upnp_bridge_relay', 'main', 'downstream_wan_ip') || '-';
			for (var i = 0; i < accepted.length; i++) {
				var mapping = accepted[i];
				var dnatTarget = mapping.dnat_target || (downstreamWanIp + ':' + mapping.external_port);
				var sourceMapping = (mapping.internal_ip || '-') + ':' + (mapping.internal_port || '-') + ' ' + (mapping.description || '');
				var row = E('tr', { 'class': 'tr' }, [
					E('td', {}, mapping.protocol || '-'),
					E('td', {}, String(mapping.external_port || '-')),
					E('td', {}, dnatTarget),
					E('td', {}, sourceMapping),
					E('td', { 'innerHTML': '<span style="color:var(--success-color, #3aa657)">' + _('Active') + '</span>' })
				]);
				syncTable.appendChild(row);
			}
		} else {
			syncTable.appendChild(E('tr', {}, E('td', { 'colspan': '5', 'style': 'color:var(--subtext-color, #666)' }, _('No synced mappings.'))));
		}
		var syncSection = E('div', { 'class': 'cbi-section' });
		syncSection.appendChild(E('h3', {}, _('Synced Mappings (DNAT)')));
		syncSection.appendChild(syncTable);
		container.appendChild(syncSection);

		var rejectTable = E('table', { 'class': 'table', 'id': 'rejected-mappings-table' }, [
			E('thead', {}, E('tr', {}, [
				E('th', {}, _('Protocol')),
				E('th', {}, _('External Port')),
				E('th', {}, _('Internal IP')),
				E('th', {}, _('Internal Port')),
				E('th', {}, _('Reject Reason'))
			]))
		]);

		var rejected = (status && status.rejected) ? status.rejected : [];
		if (rejected.length > 0) {
			for (var i = 0; i < rejected.length; i++) {
				var mapping = rejected[i];
				var row = E('tr', { 'class': 'tr' }, [
					E('td', {}, mapping.protocol || '-'),
					E('td', {}, String(mapping.external_port || '-')),
					E('td', {}, mapping.internal_ip || '-'),
					E('td', {}, String(mapping.internal_port || '-')),
					E('td', { 'innerHTML': '<span style="color:var(--danger-color, #d94b4b)">' + (mapping.reason || '-') + '</span>' })
				]);
				rejectTable.appendChild(row);
			}
		} else {
			rejectTable.appendChild(E('tr', {}, E('td', { 'colspan': '5', 'style': 'color:var(--success-color, #3aa657)' }, '\u2714 ' + _('No rejected mappings.'))));
		}
		var rejectSection = E('div', { 'class': 'cbi-section' });
		rejectSection.appendChild(E('h3', {}, _('Rejected Mappings')));
		rejectSection.appendChild(rejectTable);
		container.appendChild(rejectSection);

		return container;
	}
});
