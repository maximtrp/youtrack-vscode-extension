//@ts-check

"use strict";

const path = require("path");

/**@type {import('webpack').Configuration}*/
const config = {
  mode: "none",
  target: "node",
  entry: { extension: "./src/extension.ts" },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, "out"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode",
  },
  resolve: {
    mainFields: ["main"],
    extensions: [".ts", ".js"],
    alias: {
      // provides alternate implementation for node module and source files
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                module: "es6", // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
              },
            },
          },
        ],
      },
    ],
  },
};

/**@type {import('webpack').Configuration}*/
const webConfig = {
  mode: "none",
  target: "webworker",
  entry: { webExtension: "./src/extension.ts" },
  output: {
    path: path.resolve(__dirname, "out"),
    filename: "[name].js",
    libraryTarget: "commonjs",
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode",
  },
  resolve: {
    mainFields: ["browser"],
    extensions: [".ts", ".js", ".mjs"],
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      form_data: require.resolve("form-data"),
      url: require.resolve("url"),
      util: require.resolve("util"),
      http: require.resolve("http"),
      https: require.resolve("https"),
      zlib: require.resolve("zlib"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                module: "es6", // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
              },
            },
          },
        ],
      },
    ],
  },
};

module.exports = [config, webConfig];
