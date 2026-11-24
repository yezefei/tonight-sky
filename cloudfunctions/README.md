# 云函数说明（一期：送星/收星/回音）

对应《今天先睡-后端设计文档》§4。四个函数：

| 函数 | 作用 | 设计文档 |
|---|---|---|
| shareCreate | 生成送星分享，msgSecCheck 过审 → 加密入库 → 返回 8 位短 ID | §4.1 |
| shareOpen | 接收方打开，waiting→opened 原子流转，触发「被打开了」通知 | §4.2 |
| shareReply | 接收方回复，过审加密入库，触发「有回音了」通知 | §4.3 |
| notifySubscribe | 登记一次订阅消息授权（一次授权发一条，发完即删） | §4.4 |

## 部署状态（2026-11-24）

✅ 四个函数已部署到环境 `cloud1-d2gjtovvqb51ec8b3`（WeChat trial，免费体验版，有效期至 2027-05-24）
✅ `CONTENT_KEY` 加密密钥已配置到 shareCreate / shareOpen / shareReply（三函数同值）
✅ 数据库集合 `shares` / `subscriptions` 已创建
✅ 端到端联调通过：shareCreate → shareOpen 全链路 OK

重新部署（代码有改动时）：

```bash
tcb login        # 授权过期时重新登录
cd cloudfunctions && tcb fn deploy shareCreate --dir shareCreate --install-dependency false --force
```

也可以在微信开发者工具里右键函数目录 →「上传并部署：云端安装依赖」。

## 部署后必配的环境变量（云开发控制台 → 云函数 → 配置）

| 变量 | 用途 | 说明 |
|---|---|---|
| `CONTENT_KEY` | 心事/回复 AES-256-GCM 加密密钥 | shareCreate/shareOpen/shareReply 三个函数都要配，值必须相同，随便一串长随机字符即可 |
| `TMPL_OPENED` | 「星被打开」订阅消息模板 ID | shareOpen 配；不配则跳过通知（链路照跑） |
| `TMPL_REPLY` | 「回音到了」订阅消息模板 ID | shareReply 配；同上 |

模板在 mp.weixin.qq.com → 功能 → 订阅消息 里申请，字段名要与 notify.js 里的 `data` 对应（默认 `thing1`，可按模板改）。

## 数据库集合（控制台 → 数据库，手动建两个空集合即可）

- `shares`：分享载体。权限建议「仅创建者可读写」——所有读取都走云函数，客户端不直查。
- `subscriptions`：订阅授权队列。同上。
