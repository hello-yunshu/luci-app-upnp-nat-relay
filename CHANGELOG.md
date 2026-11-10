# CHANGELOG

## 1.3.13-3

修复三条经复核（容器 + 设备实测）确认的缺陷，改动彼此独立、可单独回退。

### D-01 postinst 在升级时覆盖 `/etc/config/upnp_nat_relay`（高）

- 现象：只要 `/etc/config/upnp_bridge_relay` 存在，任何安装/升级都会用 `cp -p` 覆盖 nat 配置；`conffiles` 只能让 apk 把新默认文件写成 `.apk-new`，挡不住脚本里的显式拷贝。设备上因此把 `enabled=1` 覆盖成 `enabled=0`，守护进程下一轮同步自停。
- 修复：迁移仅在新装时执行（`PKG_UPGRADE=1` 或 postinst 参数 `upgrade` 时跳过），且仅当 nat 配置仍与包内默认值一致（新增 `/usr/share/upnp_nat_relay/config.default` 供 `cmp` 比对）时才从 bridge 配置迁移一次。
- 实测：`1.3.13-r2 → 1.3.13-r3` 升级后配置 md5 不变；新装且存在 bridge 配置时仍能正确迁移。
- 回退：删除 postinst 中的 `PKG_UPGRADE`/`cmp` 守卫即可（单条改动）。

### D-05 `--clear` 与 `--sync` 竞态，clear 被静默撤销（高）

- 现象：`do_sync` 持有 `/tmp/upnp_nat_relay.lock` 的 flock，`do_clear` 不取锁；同步进行中执行 clear，等同步跑完会把表重新建回来。`stop_service` 的 `--clear` 同样受影响。
- 修复：`do_clear` 使用同一把锁，BusyBox flock 无 `-w`，改为 1 秒重试、最多 30 秒；超时返回 `{"success":false,"error":"another_sync_running"}`。
- 实测：同步进行中执行 clear 会等待锁释放后再删表，最终表与规则均为空；无并发时行为不变。
- 回退：删除 `do_clear` 开头的加锁循环。

### D-06 端口冲突检查逐行 fork（高）

- 现象：`check_port_conflict_single` 对 ruleset 每行执行 `$(echo "$line" | tr ...)`，每个映射重扫整表。
- 修复：改为单次 `awk` 完成“跳过自身表 / 跳过本插件注释 / 匹配 dnat + 协议 + dport（含区间）”的索引。
- 实测（2 个映射、3180 行 ruleset）：一次同步 fork 从约 20,200 降到约 400，耗时从约 28s 降到 1s 内（容器，x86_64 模拟）；设备原生单次扫描 fork 从 9,373 降到 5。
- 回退：恢复旧的 for 循环实现。

### 版本口径

三条均为不改变对外行为语义的缺陷修复（D-01 只影响安装脚本，D-05 只影响并发时序，D-06 只影响性能），按补丁版本发布：`1.3.13-3`。
