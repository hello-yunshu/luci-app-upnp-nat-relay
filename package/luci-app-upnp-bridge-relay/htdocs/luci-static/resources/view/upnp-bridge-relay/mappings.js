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

var callSyncNow = rpc.declare({
	object: 'upnp_bridge_relay',
	method: 'sync-now',
	expect: { '': {} }
});

var css = `
	.ubr-mappings { max-width: 100%; }
	.ubr-mappings h3 {
		margin: 1.2em 0 0.5em 0;
		font-size: 1.05em;
		padding-left: 0.6em;
		border-left: 3px solid var(--main-color);
	}
	.ubr-mappings .cbi-section {
		margin-bottom: 1.5em; padding: 1.2em;
		border-radius: 8px;
		background: var(--background-color-a);
		border: 1px solid var(--border-color);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--main-text-color) 6%, transparent);
	}
	.ubr-btn-bar {
		margin-bottom: 1.5em; padding: 1.2em;
		border-radius: 8px;
		background: var(--background-color-a);
		border: 1px solid var(--border-color);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--main-text-color) 6%, transparent);
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

		var btnBar = E('div', { 'class': 'ubr-btn-bar' });
		btnBar.appendChild(E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				return callSyncNow().then(function() {
					ui.addNotification(null, E('p', _('Sync triggered.')), 'info');
					window.location.reload();
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('Sync failed: ') + e.message), 'error');
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

		container.appendChild(E('h3', {}, _('Read UPnP Mappings (Raw)')));
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
					'<span style="color:var(--success-color)">' + _('Accepted') + '</span>' :
					'<span style="color:var(--danger-color)">' + _('Rejected') + '</span>';
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
			rawTable.appendChild(E('tr', {}, E('td', { 'colspan': '6' }, _('No mappings found.'))));
		}
		container.appendChild(E('div', { 'class': 'cbi-section' }, rawTable));

		container.appendChild(E('h3', {}, _('Synced Mappings (DNAT)')));
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
					E('td', { 'innerHTML': '<span style="color:var(--success-color)">' + _('Active') + '</span>' })
				]);
				syncTable.appendChild(row);
			}
		} else {
			syncTable.appendChild(E('tr', {}, E('td', { 'colspan': '5' }, _('No synced mappings.'))));
		}
		container.appendChild(E('div', { 'class': 'cbi-section' }, syncTable));

		container.appendChild(E('h3', {}, _('Rejected Mappings')));
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
					E('td', { 'innerHTML': '<span style="color:var(--danger-color)">' + (mapping.reason || '-') + '</span>' })
				]);
				rejectTable.appendChild(row);
			}
		} else {
			rejectTable.appendChild(E('tr', {}, E('td', { 'colspan': '5' }, _('No rejected mappings.'))));
		}
		container.appendChild(E('div', { 'class': 'cbi-section' }, rejectTable));

		return container;
	}
});
