# UPnP Bridge Relay

**English** | [中文](README.md)

OpenWrt LuCI plugin for bridging downstream router UPnP mappings through upstream NAT, with nftables DNAT and OpenClash RETURN support.

## What It Does

In a dual-router (multi-NAT) setup, the downstream router can create UPnP port mappings for its LAN devices, but the upstream OpenWrt router does not know about these mappings. This plugin:

1. Reads real UPnP mappings from the downstream router's LAN side
2. Applies security filtering
3. Creates corresponding DNAT rules on the upstream OpenWrt
4. Optionally configures OpenClash RETURN rules to bypass transparent proxy
5. Automatically removes DNAT when downstream UPnP mappings disappear

This replaces the need for wide-range DMZ or manual port forwarding on the upstream router.

## Quick Start

### Compile

**Method 1: OpenWrt SDK (recommended)**

```sh
cd /path/to/openwrt-sdk

echo "src-git upnp_bridge_relay https://github.com/yunshu/upnp-bridge-relay.git" >> feeds.conf.default
./scripts/feeds update upnp_bridge_relay
./scripts/feeds install upnp-bridge-relay luci-app-upnp-bridge-relay

make menuconfig
make package/upnp-bridge-relay/compile V=s
make package/luci-app-upnp-bridge-relay/compile V=s
```

**Method 2: Download pre-built from [Releases](https://github.com/yunshu/upnp-bridge-relay/releases)**

CI automatically builds `.ipk` packages on every push to main.

### Install

```sh
# OpenWrt 24.10 / 23.05 (opkg)
opkg install upnp-bridge-relay_*.ipk
opkg install luci-app-upnp-bridge-relay_*.ipk

# OpenWrt 25.12+ (apk)
apk add --allow-untrusted ./upnp-bridge-relay-*.apk
apk add --allow-untrusted ./luci-app-upnp-bridge-relay-*.apk
```

### Use

1. **LuCI Web UI**: Services → UPnP Bridge Relay → Setup Wizard, follow the step-by-step guide
2. **CLI**:

```sh
# Check environment
upnp-bridge-relay --check-env

# Dry run (read only, no rules written)
upnp-bridge-relay --dry-run

# Full sync (create DNAT rules)
upnp-bridge-relay --sync

# View status
upnp-bridge-relay --status
```

## When to Use

- You have an upstream OpenWrt router and a downstream router (any brand)
- The downstream router has UPnP enabled for its LAN devices
- You want external access to reach devices behind the downstream router
- You want to expose only the ports that actually have UPnP mappings, not a wide port range

## When NOT to Use

- You only have a single router (no dual-NAT scenario)
- Your upstream router is not OpenWrt
- Your upstream OpenWrt uses fw3/iptables (fw4/nftables is required)
- You do not have a public IP on the upstream WAN (CGNAT cannot be bypassed)
- You want to expose low-privileged ports (22, 80, 443, etc.)

## Compatibility Matrix

| Tier | OpenWrt Version | Firewall | Package Manager | Status |
|------|----------------|----------|-----------------|--------|
| Tier 1 | 25.12.x | fw4 / nftables | apk | Recommended |
| Tier 2 | 24.10.x | fw4 / nftables | opkg | Supported |
| Experimental | 23.05.x | fw4 / nftables | opkg | Best-effort |
| Unsupported | Any | fw3 / iptables | Any | Not supported |

## Network Topology

```
Internet
  |
  +-- Upstream OpenWrt Router
  |     - WAN: public internet exit
  |     - LAN: connected to downstream router WAN
  |     - Extra interface: connected to downstream router LAN (for UPnP reading)
  |     - Runs firewall / NAT / OpenClash
  |
  +-- Downstream Router
  |     - WAN: connected to upstream OpenWrt LAN
  |     - LAN: UPnP enabled
  |     - e.g. Xiaomi, ASUS, OpenWrt, iKuai, etc.
  |
  +-- Downstream LAN Clients
        - NAS
        - Game consoles
        - PCs
        - Download devices
```

Example addresses:

```
Upstream OpenWrt LAN:       192.168.2.1/24
Downstream router WAN:      192.168.2.2

Downstream router LAN:      192.168.3.1/24
Upstream extra interface:   192.168.3.50/24  (for UPnP reading only)
```

Key forwarding principle: DNAT targets the **downstream router WAN IP** (192.168.2.2), not the downstream LAN client IP. The downstream router's own NAT/UPnP rules handle the second hop.

## How to Connect the Downstream Router

The upstream OpenWrt needs an **extra interface** connected to the downstream router's LAN side. This interface is **only for reading UPnP**, not for internet access.

**Important rules:**

- Do NOT set a default gateway on this interface
- Do NOT bridge this interface with the main LAN
- Do NOT configure this interface as a WAN exit

Example setup:

```
Interface name:  upnp_bridge_lan
Device:          eth2
Protocol:        static
IP address:      192.168.3.50
Netmask:         255.255.255.0
Gateway:         (leave empty)
DNS:             (leave empty)
```

The plugin can auto-create this interface via the Setup Wizard, or you can configure it manually.

## Dependencies

| Package | Purpose |
|---------|---------|
| miniupnpc | Provides `upnpc` command to read downstream UPnP IGD mappings |
| nftables | Creates and manages the plugin's own nftables DNAT table |
| uci | Reads/writes OpenWrt UCI configuration |
| ubus | LuCI status and action RPC interface |
| rpcd | LuCI backend RPC daemon |
| luci-base | LuCI web interface framework |

Install dependencies manually if needed:

OpenWrt 25.12+:

```sh
apk update
apk add miniupnpc nftables luci-base rpcd uci
```

OpenWrt 24.10 / 23.05:

```sh
opkg update
opkg install miniupnpc nftables luci-base rpcd uci
```

## LuCI Usage

After installation, navigate to **Services → UPnP Bridge Relay** in LuCI. The interface provides 7 sub-pages:

### 1. Overview

Service status, last sync result, mapping counts, and action buttons (start, stop, sync now, clear rules).

### 2. Setup Wizard

Step-by-step guide to configure the plugin:
- Select the interface connected to the downstream LAN
- Fill in or auto-detect the interface IP
- Test ping and UPnP connectivity
- Configure the downstream router WAN IP
- Set allowed port ranges
- Configure OpenClash RETURN
- Enable the service

### 3. Network & Firewall

View and configure the reading interface and firewall zone. Detects misconfigurations such as default routes on the reading interface or incorrect zone settings.

### 4. Security Filter

Configure allowed port ranges, denied port list, allowed protocols, and allowed internal subnets. Default: allow ports 40000-65535, deny well-known sensitive ports.

### 5. Mappings

Three tables showing:
- Raw UPnP mappings read from the downstream router
- Currently synced DNAT rules on the upstream router
- Rejected mappings with rejection reasons

### 6. OpenClash

OpenClash compatibility management:
- Detect if OpenClash is installed and running
- Show suggested RETURN rules
- Apply or remove RETURN rules
- Backup and restore OpenClash configuration

### 7. Diagnostics

Environment check, network connectivity test, recent logs, dependency status, and suggested fix commands.

## Interface & Zone Recommended Configuration

The reading interface should be in its own firewall zone with the following settings:

| Setting | Value | Reason |
|---------|-------|--------|
| input | ACCEPT | Allow OpenWrt to reach downstream LAN |
| output | ACCEPT | Allow responses from downstream LAN |
| forward | REJECT | Prevent this interface from participating in normal forwarding |
| masquerade | OFF | No NAT needed on this interface |
| mtu_fix | OFF | Not a WAN exit |

If the zone output is REJECT, you will get "Operation not permitted" when running `ping` or `upnpc` from the upstream router. The plugin can fix this automatically via the **Fix Zone** button.

## OpenClash Compatibility

When OpenClash is running on the upstream router, its transparent proxy rules may intercept DNAT-forwarded traffic. The plugin can add RETURN rules to OpenClash's access control to bypass this.

Three modes are available:

| Mode | Behavior |
|------|----------|
| **off** | Do not handle OpenClash at all |
| **prompt** (default) | Show the suggested RETURN rule but do not write it automatically |
| **auto** | Automatically write the RETURN rule to OpenClash configuration |

The default RETURN strategy is **port pool**: a single rule covering the downstream router WAN IP + allowed port range (e.g. `192.168.2.2 / 40000-65535 / TCP+UDP / RETURN`). This is stable and does not need frequent updates.

If automatic writing fails (unrecognized OpenClash config structure), the plugin will display manual configuration instructions with copyable text.

## Security Considerations

**This plugin exposes downstream UPnP mappings to the public internet.** Please take the following precautions:

- **Limit the port range**: Do not use `1-65535` as the allowed range. The default `40000-65535` is recommended.
- **Do not allow low-privileged ports**: Ports 0-1023 and well-known ports (22, 80, 443, 3389, etc.) are denied by default. Do not remove them from the deny list.
- **Do not set the reading interface as the default route**: This would route all traffic through the downstream router.
- **Do not bridge the reading interface into the main LAN**: This would create network loops or routing confusion.
- **Review rejected mappings**: Check the Mappings page for rejected entries and their reasons.
- **Verify your WAN IP type**: If your upstream WAN has a private/CGNAT IP, external access will not work even if DNAT rules are correct.

## Troubleshooting

### 1. No UPnP IGD Device Found

**Symptom**: `upnpc -m <bind_ip> -l` returns no devices.

**Solution**: Confirm that:
- The bind IP is on the downstream router's LAN subnet
- The downstream router has UPnP enabled
- The reading interface is connected to the downstream LAN

```sh
upnpc -m <bind_ip> -l
```

### 2. Bind IP Does Not Exist

**Symptom**: The configured bind_ip is not found on any local interface.

**Solution**: Check that the reading interface is up and has the correct IP:

```sh
ip addr
```

### 3. "Operation not permitted" When Pinging Downstream Gateway

**Symptom**: `ping 192.168.3.1` returns "Operation not permitted".

**Solution**: The reading interface's firewall zone likely has `output` set to REJECT. Change it to ACCEPT:

```sh
uci set firewall.@zone[N].output=ACCEPT
uci commit firewall
fw4 reload
```

Or use the **Fix Zone** button in the LuCI Network & Firewall page.

### 4. Downstream Router WAN IP Unreachable

**Symptom**: Cannot ping the downstream router's WAN IP (e.g. 192.168.2.2).

**Solution**: Check the physical connection between the upstream LAN and the downstream WAN. Verify that the downstream router's WAN interface is up.

### 5. Port Synced but Not Accessible from the Internet

**Check the following**:

1. Does the upstream WAN have a public IP? (Check for CGNAT: 100.64.0.0/10)
2. Do the nftables DNAT rules exist? (`nft list table inet upnp_bridge_relay`)
3. Is OpenClash intercepting the forwarded traffic?
4. Has an OpenClash RETURN rule been configured?
5. Does the downstream UPnP mapping still exist?
6. Does the downstream router's firewall allow the mapping?

## Project Boundaries

This plugin does **NOT**:

- Make a network without a public IP reachable from the internet
- Bypass ISP CGNAT
- Make UPnP itself secure
- Guarantee compatibility with all router brands
- Recommend opening low-privileged ports
- Recommend bridging the reading interface into the main LAN
- Guarantee automatic recognition of all OpenClash version config structures

## Command Line Reference

```sh
# Environment and dependency check
upnp-bridge-relay --check-env

# Network connectivity check
upnp-bridge-relay --check-network

# Dry run: read and filter mappings without writing nftables
upnp-bridge-relay --dry-run

# Full sync: read, filter, and create DNAT rules
upnp-bridge-relay --sync

# Clear all plugin nftables rules
upnp-bridge-relay --clear

# Show current status
upnp-bridge-relay --status

# Dump current UPnP mappings from downstream router
upnp-bridge-relay --dump-mappings

# Auto-create the reading network interface
upnp-bridge-relay --setup-interface

# Fix or create the firewall zone
upnp-bridge-relay --fix-zone

# Apply OpenClash RETURN rule
upnp-bridge-relay --setup-openclash

# Remove plugin's OpenClash RETURN rule
upnp-bridge-relay --remove-openclash-rule

# Rollback all plugin-created configurations
upnp-bridge-relay --rollback
```

## License

GPLv3 License. See [LICENSE](LICENSE) for details.
