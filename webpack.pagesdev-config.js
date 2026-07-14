const path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

/**
 * Variant of webpack.pages-config.js for deploying to a Cloudflare Pages
 * preview URL (https://<branch>.<project>.pages.dev), where the site lives at
 * the ROOT path, not under /Cress/ like the production ddmal.ca/Cress/ build.
 *
 * Only the path prefixes differ from webpack.pages-config.js:
 *   __ASSET_PREFIX__   /Cress/Cress-gh/  ->  /Cress-gh/
 *   __LINK_LOCATION__  https://ddmal.ca/Cress/  ->  /
 * Everything else is identical. Output still goes to gh-pages/Cress/Cress-gh.
 */
module.exports = {
  mode: 'production',
  entry: {
    landing: './dev/scripts/landing.ts',
    editor: './dev/scripts/editor.ts',
    dashboard: './dev/scripts/dashboard.ts',
  },
  output: {
    path: path.resolve(__dirname, 'gh-pages', 'Cress', 'Cress-gh'),
    filename: '[name].js',
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: ['ts-loader'],
        exclude: /node_modules/,
      },
      {
        test: /Worker\.js$/,
        use: [
          {
            loader: 'worker-loader',
            options: { publicPath: '/Cress-gh/' },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new NodePolyfillPlugin(),
    new webpack.DefinePlugin({
      __LINK_LOCATION__: JSON.stringify('/'),
      __ASSET_PREFIX__: JSON.stringify('/Cress-gh/'),
    }),
  ],
};
