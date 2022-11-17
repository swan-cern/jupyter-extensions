var path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/extension.js',
    output: {
        path: path.resolve(__dirname, '../savefailedpopup/nbextension'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['base/js/dialog', 'base/js/events']
};