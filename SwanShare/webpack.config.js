var path = require('path');

module.exports = {
    entry: './src/extension.js',
    output: {
        path: path.resolve(__dirname, 'swanshare/nbextension'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['jquery', 'base/js/namespace', 'base/js/utils', 'base/js/events', 'services/config', 'services/contents',
        'require', 'base/js/dialog', 'base/js/keyboard', 'moment', 'services/config'
    ],
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
    }
};