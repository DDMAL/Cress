const path = require('path');
const webpack = require('webpack');
const childProcess = require('child_process');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    landing: './deployment/scripts/landing.ts',
    dashboard: './deployment/scripts/dashboard.ts',
    editor: './deployment/scripts/editor.ts',
  },
  output: {
    path: path.resolve(__dirname, 'deployment', 'server', 'Cress-gh'),
    publicPath: '/',
    filename: '[name].js'
  },
  node: {
    fs: 'empty'
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          'ts-loader'
        ],
        exclude: /node_modules/
      },
      {
        test: /Worker\.js$/,
        use: [
          {
            loader: 'worker-loader',
            options: { publicPath: '/Neon-gh/' }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ]
  },
  plugins: [
    new HardSourceWebpackPlugin(),
    new webpack.DefinePlugin({
      __LINK_LOCATION__: JSON.stringify('/'),
      __ASSET_PREFIX__: JSON.stringify('/Cress-gh/')
    })
  ]
};
