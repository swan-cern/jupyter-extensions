var path = require('path');

module.exports = {
    entry: './js/extension.js',
    output: {
        path: path.resolve(__dirname, 'swanshare/js'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['jquery', 'base/js/namespace', 'base/js/utils', 'base/js/events', 'services/config', 'services/contents', 'require', 'base/js/dialog'],
    module: {
        rules: [{
            test: /\.html$/,
            use: [ {
                loader: 'html-loader',
                options: {
                    minimize: true
                }
            }],
        }]
    }
};
