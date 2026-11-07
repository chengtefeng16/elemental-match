# Elemental Match

静态站点，无构建步骤。

- 主页：https://chengtefeng16.github.io/elemental-match/
- Playbook：https://chengtefeng16.github.io/elemental-match/playbook.html

| 文件 | 作用 |
|---|---|
| `index.html` | 主页 |
| `playbook.html` | 解锁后的完整内容 |
| `apps-script.gs` | Google Apps Script 数据接收脚本 |
| `deploy.sh` | 一条命令发布 |
| `tests/regression.mjs` | 回归检查 |

## 本地预览

```bash
python3 -m http.server 8080
```

然后打开 http://localhost:8080 。按 `Ctrl+C` 停止。

## 发布

改完文件后，在本目录运行：

```bash
./deploy.sh "这次改了什么"
```

脚本会提交全部改动、推送到 `main`，并等到两个网址都返回 200。如果改动里有疑似密钥，它会停下，不发布。

默认代理是 `http://127.0.0.1:40009`。要换代理，在命令前加 `PROXY=你的代理地址`。

## 回滚

撤销最近一次发布，历史记录会保留：

```bash
git revert --no-edit HEAD
```

```bash
./deploy.sh
```

要撤销更早的版本，先用 `git log --oneline` 找到那次提交的编号，再运行 `git revert --no-edit 编号`，最后运行 `./deploy.sh`。

## 填写 CONFIG.endpoint

数据接收脚本还没有在 Google 上真正运行过，第一次部署后要实测一次。

1. 新建一个 Google 表格，第一行依次填写表头：`ts type event variant sid src camp ad w email lang`（每个词一格）。
2. 在表格菜单选择"扩展程序 → Apps Script"，把 `apps-script.gs` 的内容粘贴进去并保存。
3. 点"部署 → 新建部署"，类型选"Web 应用"。"执行身份"选自己，"谁可以访问"选"任何人"。
4. 复制以 `/exec` 结尾的网址，填到 `index.html` 的 `CONFIG` 里，其他几个地址留空即可：

   ```js
   endpoint: 'https://script.google.com/macros/s/…/exec',
   ```

5. 运行 `./deploy.sh "接入数据接收"`。
6. 打开线上主页走一遍流程，确认表格里出现新行。

注意：

- 这个网址会写在公开页面里，任何人都能向表格发数据，也能打开它看漏斗汇总。
- 表格本身不公开，但不要在里面放其他资料。
- 不要改页面里 `mode:'no-cors'` 和 `Content-Type:'text/plain'` 的写法，否则数据发不出去。

## 回归检查

只需安装一次依赖。这里跳过浏览器下载，因为脚本用的是本机的 Google Chrome：

```bash
HTTPS_PROXY=http://127.0.0.1:40009 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

检查本地文件：

```bash
npm test
```

检查线上网址：

```bash
BASE_URL=https://chengtefeng16.github.io/elemental-match npm test
```

检查内容：

- 两个页面在 400px 宽度下 `scrollWidth` 等于 400。
- 中英文各走一遍主流程（填生日、算结果、解锁、提交邮箱），无 console 报错。
- Playbook 点"先看一份示例结果"能算出提示。

发往 Google 的请求会被脚本拦下，检查不会往表格写数据。

## 绑定自己的域名（以后需要时）

1. 在域名服务商处购买域名，并添加 DNS 记录：
   - 用 `www.你的域名`：添加 CNAME 记录，把 `www` 指向 `chengtefeng16.github.io`。
   - 用不带 `www` 的根域名：添加 4 条 A 记录，指向 `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`。
2. 打开仓库的 Settings → Pages，在 Custom domain 填入域名并保存。
3. DNS 生效后勾选 Enforce HTTPS，证书可能要等一段时间才能勾选。
4. GitHub 会往 `main` 分支自动提交一个 `CNAME` 文件，所以要先同步到本地，否则下次发布会被拒绝：

   ```bash
   git pull origin main
   ```

5. 如果已填 `CONFIG.shareUrl`，把它改成新网址，再运行 `./deploy.sh`。

绑定后旧的 `github.io` 网址会自动跳转到新域名。
