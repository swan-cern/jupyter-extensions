var path = require('path');
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/extension.js',
    output: {
        path: path.resolve(__dirname, '../swanintro/nbextension'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },

    externals: ['jquery', 'require', 'base/js/dialog', 'tree/js/notebooklist'],
    module: {
        rules: [{
            test: /\.html$/,
            use: [{
                loader: 'html-loader',
                options: {
                    minimize: true
                }
            }],
        }]
    },
    plugins: [
        new CopyWebpackPlugin([{
            from: 'src/img',
            to: 'img',
            toType: 'dir'
        }])
    ]
};