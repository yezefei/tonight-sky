# 云函数说明（送星 / 回音 / 云同步）

对应《今天先睡-后端设计文档》§4 与 §4.6。共 7 个函数：

| 函数 | 作用 | 设计文档 |
|---|---|---|
| shareCreate | 生成送星分享，msgSecCheck 过审 → 加密入库 → 返回 8 位短 ID | §4.1 |
| shareOpen | 接收方打开，waiting→opened 原子流转，触发「被打开了」通知；返回真实状态 | §4.2 |
| shareReply | 接收方回复，过审加密入库，触发「有回音了」通知；限制仅接收方可回 | §4.3 |
| replyCheck | 发送方拉未读回音 / 已打开状态，并机会式清理过期分享 | §4.5 |
| shareAck | 回音回执，仅分享所有者可回，幂等 | §4 闭环 |
| notifySubscribe | 登记一次订阅消息授权（一次授权发一条，发完即删） | §4.4 |
| starsSync | 星星云同步：按 id 合并、updatedAt 新者胜、删除墓碑保留 30 天 | §4.6 |

## 部署状态

- 原 6 个函数此前已部署到 `cloud1-d2gjtovvqb51ec8b3`（WeChat trial，有效期至 2027-05-24）。
- `starsSync` 为新增函数，**必须先在云开发控制台新建 `stars` 集合并部署该函数**；客户端「云同步」默认关闭，开启后才会调用。
- 代码改动后需重新部署全部改动过的函数。

重新部署：

```bash
tcb login        # 授权过期时重新登录
cd cloudfunctions
tcb fn deploy shareCreate --dir shareCreate --install-dependency false --force
# 其余函数同理；新增 starsSync 也要部署
```

也可以在微信开发者工具里右键函数目录 →「上传并部署：云端安装依赖」。

> ⚠️ 右键「上传并部署」不会携带环境变量，也不会带 node_modules。部署后必须到 web 控制台补环境变量，并选择「云端安装依赖」。

## 必配环境变量（云开发控制台 → 云函数 → 配置）

| 变量 | 用途 | 需要配置的函数 |
|---|---|---|
| `CONTENT_KEY` | 心事 / 回音 / 云同步文本的 AES-256-GCM 密钥 | **shareCreate、shareOpen、shareReply、replyCheck、starsSync**（五个函数必须同值） |
| `TMPL_OPENED` | 「星被打开」订阅消息模板 ID | shareOpen；留空则静默跳过 |
| `TMPL_REPLY` | 「回音到了」订阅消息模板 ID | shareReply；留空则静默跳过 |
| `MP_STATE` | 订阅消息跳转的小程序版本：`developer` / `trial` / `formal` | shareOpen、shareReply；默认 developer，上线前改 formal |

`CONTENT_KEY` 现在采用 **fail closed**：未配置会直接报错并返回 `SYS`，不再明文落库。

模板在 mp.weixin.qq.com → 功能 → 订阅消息 里申请，字段名要与 `notify.js` 里的 `data` 对应（默认 `thing1`，可按模板改）。拿到 ID 后还要填进 `utils/config.js`，前端才会请求授权。

## 数据库集合（控制台 → 数据库，手动建空集合）

| 集合 | 说明 | 权限 |
|---|---|---|
| `shares` | 分享载体。客户端不直查，全部走云函数 | 仅创建者可读写 |
| `subscriptions` | 订阅授权队列 | 仅创建者可读写 |
| `stars` | 云同步星星（新增）。文档含 `id`、`updatedAt`、`deletedAt`、加密后的 `text`/`reply`/`more` | 仅创建者可读写 |

建议给 `stars` 建索引：`_openid + id`（唯一）、`_openid + updatedAt`、`deletedAt`（过期清理）。

## 同步行为

- 客户端默认**不开启**云同步；用户在首页「数据与隐私」里开启后才上传。
- 每次本地 `store.save()` 会自动防抖 1.5 秒后同步；App 启动 / 回到前台也会同步一次。
- 删除记为墓碑（`deletedAt`），30 天后由 `starsSync` 物理删除。
- 服务端密钥在环境变量里，属于**加密存储而非零知识**，对外文案不要过度承诺。
