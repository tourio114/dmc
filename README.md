# DMC · 我的世界下载站

可直接部署到 **Cloudflare Workers 的单文件网站**。根目录的 `worker.js` 已包含网页、样式、前端逻辑和同源接口，无需数据库、KV、R2、环境变量或静态资源绑定。

支持 Minecraft Java Edition 客户端/服务端、Java、Forge、Fabric；提供版本搜索、正式版/快照/远古版筛选、文件校验值、复制链接、错误重试和手机布局。

## 直接粘贴部署（无需构建）

1. 下载仓库根目录 [`worker.js`](./worker.js) 的完整内容，在 GitHub 点击 Raw 后保存或复制全部代码。
2. Cloudflare 控制台 → Workers & Pages → 创建 Worker，先创建默认 Hello World Worker。
3. 打开“编辑代码”，用 `worker.js` 全部内容替换默认代码，使用 ES Modules 格式，点击部署。
4. 访问该 Worker 的 `workers.dev` 地址。

只需要这一份文件。无需上传 React 源码，不需要 assets 绑定。自定义域名可在 Worker 设置中添加。

## Wrangler 部署

需要 Node.js >= 22.13：

```sh
git clone https://github.com/tourio114/dmc.git
cd dmc
npm ci
npx wrangler login
npx wrangler deploy
```

`wrangler.jsonc` 已配置入口 `worker.js`、Worker 名称 `dmc`、兼容日期和日志/追踪。上述部署使用仓库中已生成的文件；如修改源码，运行 `npm run deploy` 重新构建并部署。

连接 GitHub 到 Workers Builds 时，构建命令填写 `npm run build`，部署命令填写 `npx wrangler deploy`，项目根目录使用 `/`。

## 修改源码

```sh
npm ci
npm run build         # 重新生成 worker.js
npm run dev           # 本地预览已生成的 Worker
npm run typecheck
npm test
```

界面位于 `app/page.tsx` 与 `app/globals.css`；接口位于 `app/api/catalog/route.ts`；下载规则位于 `lib/downloads.ts`。`standalone/` 包含浏览器和 Worker 入口，`scripts/build-worker.mjs` 将它们打包为单个 ES Module，无运行时 npm 依赖。可选的 Google Fonts 加载失败时使用系统字体。

本地预览兼容日期设置为当前锁定 workerd 支持的 `2026-05-22`；生产配置使用 `2026-11-20`。项目需要服务端接口，不支持直接部署为 GitHub Pages 静态站。

## 下载来源

Minecraft、Forge、Fabric 目录和镜像下载使用 [BMCLAPI](https://bmclapidoc.bangbang93.com/)，感谢 bangbang93 和 OpenBMCLAPI 社区。版本信息通过同源 `/api/catalog` 获取，避免浏览器跨域限制；大文件直接从上游下载，不经过本站服务器。

现代 Java 使用 [Adoptium 官方 API](https://api.adoptium.net/q/swagger-ui/)，提供 Temurin 8 / 11 / 17 / 21 / 25，支持 Windows、macOS、Linux 与 x64/ARM64。下载为 JDK 压缩包，包含运行环境；解压后在启动器中指定 Java 路径。不存在的系统/架构组合会显示空列表。

另提供 BMCLAPI 旧版 JRE 入口。上游 `/java/list` 目前可能返回 403，页面显示实际错误；现代游戏需要的 Java 版本以游戏详情为准。

原版客户端 JAR 并非完整游戏，需要合法启动器补全 libraries、assets 等依赖并通过正版账号登录。服务端首次启动后需阅读并同意 Minecraft EULA。Forge 提供安装器；Fabric 提供通用安装器和供启动器集成的 Loader 配置 JSON。本站非 Mojang/Microsoft 官方网站。

## 接口保护

仅允许固定上游与受限 JSON 目录路径，拒绝任意 URL、路径穿越与非法参数。请求设置 20 秒超时、8 MiB 响应上限。成功目录响应提供缓存头；不代理二进制文件，不缓存失败响应。上游有频率限制，错误可稍后重试。

测试覆盖镜像映射、接口目标白名单、路径穿越、Java 参数与 Worker 路由。
