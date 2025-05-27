const path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

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
      __LINK_LOCATION__: JSON.stringify('https://ddmal.ca/Cress/'),
      __ASSET_PREFIX__: JSON.stringify('/Cress/Cress-gh/'),
    }),
  ],
};
