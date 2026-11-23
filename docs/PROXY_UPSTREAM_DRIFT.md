# 代理上游漂移：怎么读、怎么处理

`proxy-upstream-baseline.json` 记录**实际资格化过**的上游代理版本，不是"允许存在的版本"。
`scripts/check-proxy-upstreams.py` 每周（`.github/workflows/proxy-compatibility.yml`，周一 03:23）
以及改到相关文件时，把这些记录和上游最新 release / 分支 HEAD 比一次。

## 漂移只报告，不挡出包

`Proxy compatibility canary` 的 `upstream-drift` job 会打印一张表，漂移的行标 `**DRIFT**`，
run summary 里还有一节 `### Upstream drift reported — does not block the release`。脚本此时 **exit 0**。

理由写在基线的 `policy` 里：上游发新版不是"功能坏了"的证据。本插件只与这些包**共用防火墙**——
自己插链、不写它们的文件、不驱动它们的服务——所以它们的版本号变了，等于"该复测了"，不等于"我们坏了"。

真正会挡住发布的是能描述失败的信号：relay / adapter 契约失败、资格化清单无效、不可变 tag 冲突；
以及基线自身的缺陷（缺字段、未知 `kind`）——那是本仓库的错，脚本对它 **exit 1**，
并由 `tests/proxy-upstream-policy.py` 钉死：把阻断权加回漂移必须是显式评审过的改动，不能顺手滑进去。

## DRIFT 出现后该做什么

1. **先看改了什么，不是看版本号。** 比 baseline 的 ref 和当前 ref：
   `gh api repos/<repo>/compare/<baseline>...<current>`，重点看 `nftables.sh` / `iptables.sh` /
   链名 / `hook prerouting` 优先级 / `sysctl` 一类会改变共存行为的行。
2. **判断是否落在共存面上。** 只改 LuCI 界面、翻译、订阅解析 → 与防火墙共存无关；
   改链序、TPROXY、`rp_filter`、`src_valid_mark` → 落在共存面上，必须实跑。
3. **要跑就跑一次共存流程**（隔离 OpenWrt，不碰主路由）：
   - 装上游包的目标版本，确认服务起来；
   - 装/启用 UPnP relay，确认重载后 `nft list ruleset` 里两套链共存、顺序符合预期；
   - 记录开上游前后 `net.ipv4.conf.*.rp_filter`、`src_valid_mark` 的实际值；
   - 从 LAN 侧做一次入向转发（映射）验证，再回滚到测试前状态。
4. **前进 baseline**：改 `observedRef`，并把 `qualification` 重写成"在哪个版本上、验到了什么、
   哪些模式仍未验证"——不要写成"已验证"这类笼统结论。
5. 没有跑就不要前进 ref。`qualification` 里写清"未复测、何时该复测"，让人一眼看到到期项。

## 当前状态（2026-11-24）

| 上游 | baseline | 上游最新 | 状态 |
|---|---|---|---|
| OpenClash | `v0.48.002` | `v0.48.002` | 无漂移；共存只在 `v0.47.156` 上实跑过 |
| PassWall1 | `26.11.11-1` | `26.11.23-1` | **DRIFT，未前进**：上游改了 IPv6 TPROXY 宏与 `rp_filter`/`src_valid_mark` |
| PassWall2 | `26.11.11-1` | `26.11.23-1` | **DRIFT，未前进**：同上，另有 `set_tproxy_sysctl()` 全局关 `rp_filter` |
| HomeProxy | `fadaa676104f` | 同左 | 无漂移 |
| sing-box | `v1.14.4` | `v1.14.4` | 无漂移 |

PassWall 这次的两处改动落在 relay 最关心的层（prerouting 链序、转发入向的反向路径校验），
所以按上面的第 3 步实跑之后再前进 ref；在那之前 canary 会一直显示这两行 DRIFT，这是预期行为。
