include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for UPnP Bridge Relay
LUCI_DEPENDS:=+upnp-bridge-relay +luci-base
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot
$(eval $(call BuildPackage,luci-app-upnp-bridge-relay))
