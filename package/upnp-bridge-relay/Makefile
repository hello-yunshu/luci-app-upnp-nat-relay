include $(TOPDIR)/rules.mk

PKG_NAME:=upnp-bridge-relay
PKG_VERSION:=1.0.1
PKG_RELEASE:=1

PKG_MAINTAINER:=yunshu
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/upnp-bridge-relay
	SECTION:=net
	CATEGORY:=Network
	TITLE:=UPnP Bridge Relay - Bridge downstream UPnP mappings through upstream NAT
	DEPENDS:=+miniupnpc +nftables +uci +ubus +rpcd
	PKGARCH:=all
endef

define Package/upnp-bridge-relay/description
	OpenWrt plugin for bridging downstream router UPnP mappings through
	upstream NAT, with nftables DNAT and OpenClash RETURN support.
endef

define Package/upnp-bridge-relay/conffiles
/etc/config/upnp_bridge_relay
endef

define Build/Compile
endef

define Package/upnp-bridge-relay/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/upnp-bridge-relay $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/upnp_bridge_relay $(1)/etc/config/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/upnp_bridge_relay $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/upnp_bridge_relay
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/usr/libexec/rpcd/upnp_bridge_relay $(1)/usr/libexec/rpcd/
endef

define Package/upnp-bridge-relay/postinst
#!/bin/sh
[ -n "$${IPKG_NO_SCRIPT}" ] && exit 0
[ -x /etc/init.d/upnp_bridge_relay ] && /etc/init.d/upnp_bridge_relay enable 2>/dev/null
exit 0
endef

define Package/upnp-bridge-relay/prerm
#!/bin/sh
[ -n "$${IPKG_NO_SCRIPT}" ] && exit 0
/etc/init.d/upnp_bridge_relay stop 2>/dev/null
/etc/init.d/upnp_bridge_relay disable 2>/dev/null
exit 0
endef

$(eval $(call BuildPackage,upnp-bridge-relay))
