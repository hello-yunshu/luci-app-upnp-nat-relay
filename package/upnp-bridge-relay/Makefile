include $(TOPDIR)/rules.mk

PKG_NAME:=upnp-bridge-relay
PKG_VERSION:=1.1.0
PKG_RELEASE:=3

PKG_MAINTAINER:=yunshu
PKG_LICENSE:=GPL-3.0

include $(INCLUDE_DIR)/package.mk

define Package/upnp-bridge-relay
	SECTION:=net
	CATEGORY:=Network
	TITLE:=UPnP Bridge Relay - Bridge downstream UPnP mappings through upstream NAT
	DEPENDS:=+miniupnpc +nftables +uci +ubus +rpcd +luci-base
	PKGARCH:=all
	REPLACES:=luci-app-upnp-bridge-relay
	PROVIDES:=luci-app-upnp-bridge-relay
endef

define Package/upnp-bridge-relay/description
	OpenWrt plugin for bridging downstream router UPnP mappings through
	upstream NAT, with nftables DNAT and OpenClash RETURN support.
	Includes LuCI web interface.
endef

define Package/upnp-bridge-relay/conffiles
/etc/config/upnp_bridge_relay
endef

define Build/Compile
	if [ -f ./files/po/po2lmo.py ]; then \
		mkdir -p $(PKG_BUILD_DIR)/lmo; \
		for po_dir in ./files/po/*/; do \
			[ -d "$$$$po_dir" ] || continue; \
			lang=$$$$(basename "$$$$po_dir"); \
			[ "$$$$lang" = "templates" ] && continue; \
			[ -f "$$$$po_dir/upnp-bridge-relay.po" ] || continue; \
			if [ -x "$(STAGING_DIR_HOSTPKG)/bin/po2lmo" ]; then \
				"$(STAGING_DIR_HOSTPKG)/bin/po2lmo" "$$$$po_dir/upnp-bridge-relay.po" "$(PKG_BUILD_DIR)/lmo/upnp-bridge-relay.$$$$lang.lmo"; \
			elif command -v python3 >/dev/null 2>&1; then \
				python3 ./files/po/po2lmo.py "$$$$po_dir/upnp-bridge-relay.po" "$(PKG_BUILD_DIR)/lmo/upnp-bridge-relay.$$$$lang.lmo"; \
			fi; \
		done; \
	fi
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
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/upnp_bridge_relay
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/upnp_bridge_relay/*.js $(1)/www/luci-static/resources/view/upnp_bridge_relay/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./files/usr/share/luci/menu.d/luci-app-upnp-bridge-relay.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/luci-app-upnp-bridge-relay.json $(1)/usr/share/rpcd/acl.d/
	if [ -n "$$$$(ls $(PKG_BUILD_DIR)/lmo/*.lmo 2>/dev/null)" ]; then \
		$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n; \
		$(INSTALL_DATA) $(PKG_BUILD_DIR)/lmo/*.lmo $(1)/usr/lib/lua/luci/i18n/; \
	fi
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
