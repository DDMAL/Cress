const path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    landing: './dev/scripts/landing.ts',
    dashboard: './dev/scripts/dashboard.ts',
    editor: './dev/scripts/editor.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dev', 'server', 'Cress-gh'),
    publicPath: '/',
    filename: '[name].js',
  },
  devtool: 'inline-source-map',
  cache: {
    type: 'filesystem', // Enables persistent caching
  },
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
