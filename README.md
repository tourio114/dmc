# DMC · 我的世界下载站

可直接部署到 **Cloudflare Workers 的单文件网站**。根目录的 `worker.js` 已包含网页、样式、前端逻辑和同源接口，无需数据库、KV、R2 或静态资源绑定。CurseForge 功能需额外配置服务端 API 密钥。

支持 Minecraft Java Edition 客户端/服务端、Java、Forge、Fabric，以及 Modrinth / CurseForge / MC 百科模组检索与批量 ZIP 下载；提供版本搜索、正式版/快照/远古版筛选、文件校验值、复制链接、错误重试和手机布局。

支持明暗模式：首次访问跟随系统外观，右上角按钮可切换，浏览器会记住手动选择。导航、下载面板与弹窗采用半透明液态玻璃质感；不支持背景模糊或偏好减少透明效果时使用清晰的实色背景。

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

Minecraft、Forge、Fabric 目录和镜像下载使用 [BMCLAPI](https://bmclapidoc.bangbang93.com/)，感谢 bangbang93 和 OpenBMCLAPI 社区。版本信息通过同源 `/api/catalog` 获取，避免浏览器跨域限制；原版游戏和 Java 大文件直接从上游下载。Forge 安装器通过同源下载接口保留正确文件名，镜像失败时尝试 Forge 官方 Maven。模组批量下载通过受限的同源流式接口解决跨域，在浏览器中打包 ZIP。

Java 默认使用[清华 TUNA Adoptium 国内镜像](https://mirrors.tuna.tsinghua.edu.cn/help/Adoptium/)，优先提供体积较小的 JRE，可选 JDK 与安装程序。另可选择[华为云 OpenJDK 国内镜像](https://mirrors.huaweicloud.com/openjdk/)（仅 JDK），或 [Adoptium 官方源](https://api.adoptium.net/q/swagger-ui/)作为备用。

Java 目录直接从所选镜像读取，不依赖 GitHub 版本接口才能展示国内下载。支持 Java 8 / 11 / 17 / 21 / 25、Windows / macOS / Linux、x64 / ARM64，实际可用组合与版本以来源目录为准，镜像不保证与官方同步。运行游戏通常只需 JRE；如来源未提供 JRE 可选择 JDK。解压后在启动器中指定 Java 路径。
另提供 BMCLAPI 旧版 JRE 入口。上游 `/java/list` 目前可能返回 403，页面显示实际错误；现代游戏需要的 Java 版本以游戏详情为准。

原版客户端 JAR 并非完整游戏，需要合法启动器补全 libraries、assets 等依赖并通过正版账号登录。服务端首次启动后需阅读并同意 Minecraft EULA。Forge 提供安装器；Fabric 提供通用安装器和供启动器集成的 Loader 配置 JSON。本站非 Mojang/Microsoft 官方网站。

## 模组搜索与批量下载

- **Modrinth**：使用[公开官方 API](https://docs.modrinth.com/api/)，无需密钥。按游戏版本、加载器筛选，选定版本后加入队列。
- **CurseForge**：使用[官方 API](https://docs.curseforge.com/rest-api/)，需要站长配置密钥。未配置时显示提示与原站入口；作者未开放第三方文件下载时，只提供原站链接，不拼接 CDN 地址绕过限制。
- **MC 百科**：读取[公开搜索页](https://search.mcmod.cn/)的中文条目，以及条目公开收录的 Modrinth / CurseForge 链接，再由相应平台读取匹配文件。不是 MC 百科官方 API，也不把百科当作自有文件镜像；页面结构改变或无公开来源时可前往百科条目查看。

先选择 Minecraft 版本与加载器，再加入模组。队列可跨三个搜索入口添加，但同一批次的游戏版本和加载器必须一致。同一来源同一模组只保留一个所选版本。队列不跨刷新保存。

每批最多 30 个、200 MiB，单文件最多 64 MiB。文件流式经过 Worker，在浏览器中按上游 SHA-1 / SHA-512 校验后合成 ZIP。支持实时进度、取消、勾选、移除和仅重试未完成项；部分失败时只打包成功文件，并在清单中记录失败原因。

ZIP 包含 `mods/`、`dmc-manifest.json` 和 `README.txt`。清单记录来源、项目、版本、校验值、原站链接与必需前置。**前置依赖不自动补齐**，请根据清单和原站说明另行添加；同名模组请只保留一个来源。跨域与浏览器多文件弹窗由单 ZIP 下载处理，较大批次需要相应的浏览器内存。

## 模组图片与用途

搜索结果展示来源提供的真实图标、预览图、简介和用途分类，常见分类使用中文标签。点击“图文详情”可切换截图、阅读图片说明、打开原图及展开原站介绍。图片按需加载；没有图片或加载失败时显示占位提示，仍可查看介绍和选择文件。图片与介绍接口失败不会阻塞版本文件列表。

Modrinth 使用官方 `icon_url`、`gallery` 等字段，CurseForge 使用官方 `logo`、`screenshots` 等字段（仍需密钥）。MC 百科在条目可访问时读取公开封面、介绍配图和文字；不生成或猜测模组图片。图片只允许已知来源的 HTTPS 地址，直接由浏览器读取，没有开放的任意图片代理。

MC 百科可能拒绝 Worker 所在服务器的请求并返回 **403**。该状态会保留并明确展示，提供浏览器直接搜索／打开百科条目，以及切换到 Modrinth 的按钮；不会声称解除上游访问限制。站外中文资料链接在图片或百科接口失败时仍可用。

## 启用 CurseForge

向 CurseForge 申请自己的第三方 API 密钥，然后在 Cloudflare 控制台 → 当前 Worker → 设置 → 变量和机密，添加 **Secret** `CURSEFORGE_API_KEY`，保存并部署。密钥只在 Worker 服务端读取，不写入源码，也不会发送给浏览器。

也可使用 Wrangler 的安全交互输入：

```sh
npx wrangler secret put CURSEFORGE_API_KEY
```

本地开发可在已忽略的 `.dev.vars` 文件中配置同名变量。不要提交真实密钥。未配置时 Modrinth、MC 百科检索及 Java 功能仍可用；百科中的 CurseForge 下载入口同样需要密钥。

## 接口保护与验证

`/api/catalog`、`/api/java`、`/api/mods`、`/api/forge-download` 只读取固定来源。参数限制阻止任意 URL 与路径穿越；目录读取设置 20 秒超时、8 MiB 上限。模组流式下载设置 90 秒超时、64 MiB 上限，只从平台元数据指定的允许 CDN 域名读取 JAR，使用 Workers 支持的 `redirect: manual`，逐跳检查重定向目标，拒绝来源不匹配和未允许的目标。成功目录响应提供缓存头，不缓存失败或模组二进制响应。

测试覆盖镜像地址映射、Java 目录解析、参数与域名限制、百科来源提取、CurseForge 密钥传递与缺失提示、模组文件匹配和流式返回。修改后运行构建、类型检查、测试与 Wrangler `--dry-run`；浏览器检查批量 ZIP、校验、失败重试、暗色模式及手机布局。

## JAR 下载与文件名

Forge 安装器与模组单独下载都使用同源接口，在保存前检查 JAR/ZIP 文件头，并对可用的 SHA 校验值进行浏览器校验。上游返回 HTML、JSON 等错误页面时显示错误，不把它另存为 JAR。单独下载失败会留在当前页面提示，批量失败保留原有重试功能。

下载响应同时提供 ASCII `filename` 与 UTF-8 `filename*`，浏览器保存时显式指定包含 `.jar` 的文件名；中文、空格、括号和单引号按下载文件名编码处理。Forge 文件名形如 `forge-1.21.1-52.0.1-installer.jar`，无需手动添加扩展名。

回归测试在真正的 workerd（Miniflare）运行时执行下载路由，覆盖 Modrinth 和 CurseForge CDN 重定向、Forge 镜像链、Unicode 文件名、文件字节完整性和错误页面拒绝，避免只在 Node.js 测试中通过、部署到 Worker 却失败。
