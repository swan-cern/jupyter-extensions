var path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/extension.js',
    output: {
        path: path.resolve(__dirname, '../sparkconnector/nbextension'),
        filename: 'extension.js',
        libraryTarget: 'umd'
    },
    externals: ['base/js/namespace', 'jquery', 'base/js/dialog', 'require', 'base/js/events',
        'base/js/keyboard', 'base/js/utils', 'services/config'
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
            },
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,
                        presets: ["@babel/preset-env"],
                        babelrc: false,
                    }
                }
            }
        ]
    }
};