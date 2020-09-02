var path = require('path');

module.exports = {
    entry: './src/extension.js',
    output: {
        path: path.resolve(__dirname, '../swannotifications/nbextension'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['jquery', 'require', 'base/js/namespace', 'base/js/events'],
    module: {
        loaders: [{
            test: /\.css$/,
            loader: 'style-loader!css-loader'
        }]
    },
    resolve: {
        extensions: ['.js', '.css']
    }
};