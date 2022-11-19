define([
    'base/js/utils'
], function (utils) {

    // Wrap upstream promising_ajax to append the authorization header
    var promising_ajax = function(url, settings) {
        settings = settings || {};
        if (!settings.headers) {
            settings.headers = {};
        }
        const apiToken = utils.get_body_data('jupyterApiToken');
        if (!settings.headers.Authorization && apiToken) {
            settings.headers['Authorization'] = `token ${apiToken}`;
        }
        return utils.promising_ajax(url, settings)
    };
    return {
        ...utils,
        promising_ajax
    };
});