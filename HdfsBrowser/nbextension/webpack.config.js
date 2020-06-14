var path = require('path');

module.exports = {
    entry: './src/extension.js',
    output: {
        path: path.resolve(__dirname, '../hdfsbrowser/nbextension'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['base/js/namespace'],
    module: {
        rules: [{
            test: /\.js$/,
            use: {
                loader: 'babel-loader',
                options: {
                    cacheDirectory: true,
                    presets: ["env"],
                    "babelrc": false,
                }
            }
        },
        {
            test: /\.css$/,
            use: [
               'style-loader',
               'css-loader'
            ]
        }
        ]
    }
};
