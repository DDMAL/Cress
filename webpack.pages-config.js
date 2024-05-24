const path = require('path');
const webpack = require('webpack');
const childProcess = require('child_process');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    landing: './deployment/scripts/landing.ts',
    editor: './deployment/scripts/editor.ts',
    dashboard: './deployment/scripts/dashboard.ts',
  },
  output: {
    path: path.resolve(__dirname, 'gh-pages', 'Cress-gh'),
    filename: '[name].js',
  },
  node: {
    fs: 'empty',
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: ['ts-loader'],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new HardSourceWebpackPlugin(),
    new webpack.DefinePlugin({
      __LINK_LOCATION__: JSON.stringify('https://ddmal.music.mcgill.ca/Cress'),
      __ASSET_PREFIX__: JSON.stringify('/Cress-gh/'),
    }),
  ],
};
