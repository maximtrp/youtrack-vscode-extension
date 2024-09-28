//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const webpack = require("webpack");
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
    mainFields: ["browser", "module", "main"],
    extensions: [".ts", ".js", ".mjs"],
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      https: require.resolve("https-browserify"),
      http: require.resolve("stream-http"),
      url: require.resolve("url"),
      buffer: require.resolve("buffer"),
      Buffer: require.resolve("buffer"),
      'process/browser': require.resolve('process/browser')
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
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser', // provide a shim for the global `process` variable
    }),
  ],
  optimization: {
    concatenateModules: false
  }
};

module.exports = [config, webConfig];
