# 工牌设计器 (Badge Designer)

这是一个使用 React 和 Ant Design 构建的简单的工牌在线设计器。用户可以自定义工牌上的文本、样式等，并实时预览效果。

## ✨ 功能特性

- 实时预览工牌效果
- 自定义工牌尺寸
- 自定义多个文本元素的字体、大小、位置等
- 支持拖拽调整文本位置

## 🚀 如何开始

在开始之前，请确保你的电脑上已经安装了 [Node.js](https://nodejs.org/) (推荐使用 LTS 版本) 和 npm。

### Node.js 安装指南

<details>
<summary><b>Ubuntu (推荐使用 nvm)</b></summary>

我们推荐使用 `nvm` (Node Version Manager) 来安装和管理 Node.js 版本。

1.  **安装 nvm**:
    打开终端并运行以下命令：
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ```
2.  **激活 nvm**:
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
3.  **安装 Node.js**:
    运行以下命令来安装最新的 LTS (长期支持) 版本：
    ```bash
    nvm install --lts
    ```
4.  **验证安装**:
    在终端中运行 `node -v` 和 `npm -v`，如果能看到版本号，即表示安装成功。

</details>

<details>
<summary><b>macOS / Windows</b></summary>

我们推荐直接从 [Node.js 官网](https://nodejs.org/zh-cn/) 下载 **LTS (长期支持版)** 安装包进行安装。下载后，根据提示完成安装即可。

</details>

### 1. 安装依赖

首先，克隆或下载本仓库到本地，然后在项目根目录下运行以下命令来安装所有必需的依赖包：

```bash
npm install
```

### 2. 启动项目

安装完成后，运行下面的命令来启动本地开发服务器：

```bash
npm run dev
```

该命令会启动一个热重载的开发服务器，并自动在你的默认浏览器中打开项目页面，通常地址是 `http://localhost:8080`。

## 📜 可用脚本

在 `package.json` 文件中，我们定义了一些有用的脚本：

-   `npm run dev`:
    以开发模式启动应用，并自动在浏览器中打开。

-   `npm start`:
    以开发模式启动应用。

-   `npm run build`:
    将应用打包为生产环境的静态文件，输出到 `dist` 目录。

## 🛠️ 技术栈

-   [React](https://reactjs.org/)
-   [Ant Design](https://ant.design/)
-   [Webpack](https://webpack.js.org/)
-   [Babel](https://babeljs.io/)
