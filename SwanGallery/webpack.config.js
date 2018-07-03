var path = require('path');

module.exports = {
    entry: './js/extension.js',
    output: {
        path: path.resolve(__dirname, 'swangallery/js'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['jquery', 'require', 'base/js/utils'],
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
