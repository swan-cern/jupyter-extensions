var path = require('path');
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './js/extension.js',
    output: {
        path: path.resolve(__dirname, 'swanhelp/js'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['jquery', 'require', 'base/js/dialog'],
    plugins: [
        new CopyWebpackPlugin([
            { from: './help', to: 'docs'  }
            ])
        ]
};
