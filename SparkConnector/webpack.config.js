var path = require('path');

module.exports = {
    entry: './js/extension.js',
    output: {
        path: path.resolve(__dirname, 'sparkconnector/js'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['base/js/namespace', 'jquery', 'base/js/dialog', 'require', 'base/js/events']
};
