include $(TOPDIR)/rules.mk

LUCI_TITLE:=UPnP Bridge Relay - Bridge downstream UPnP mappings through upstream NAT
LUCI_DEPENDS:=+luci-base +miniupnpc +nftables
LUCI_PKGARCH:=all

PKG_VERSION:=1.1.1
PKG_RELEASE:=1
PKG_MAINTAINER:=yunshu
PKG_LICENSE:=GPL-3.0

define Package/luci-app-upnp-bridge-relay/conffiles
/etc/config/upnp_bridge_relay
endef

define Package/luci-app-upnp-bridge-relay/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || { \
	[ -x /etc/init.d/upnp_bridge_relay ] && /etc/init.d/upnp_bridge_relay enable 2>/dev/null; \
	rm -f /tmp/luci-indexcache.*; \
	rm -rf /tmp/luci-modulecache/; \
	/etc/init.d/rpcd reload 2>/dev/null; \
	exit 0; \
}
endef

define Package/luci-app-upnp-bridge-relay/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || { \
	/etc/init.d/upnp_bridge_relay stop 2>/dev/null; \
	/etc/init.d/upnp_bridge_relay disable 2>/dev/null; \
	rm -f /tmp/luci-indexcache.*; \
	rm -rf /tmp/luci-modulecache/; \
	exit 0; \
}
endef

define Build/Prepare/luci-app-upnp-bridge-relay
	$(SED) 's/@PKG_VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/root/usr/bin/upnp-bridge-relay
endef

include $(TOPDIR)/feeds/luci/luci.mk
