define([
    'require',
    'contents'
], function (require, contents) {

    /**
     * Extends Jupyter contents lib to provide an option
     * to create new Projects with a specific name.
     * By default, we can only create folders/files with the default name.
     */

    var utils = require('base/js/utils');

    var parent_contents = contents.Contents;
    var child_contents = function (options) {
        parent_contents.call(this, options);
    }
    child_contents.prototype = Object.create(parent_contents.prototype);

    child_contents.prototype.new = function(path, options) {
        var data = JSON.stringify({
          ext: options.ext,
          type: options.type
        });

        var settings = {
            processData : false,
            type : "PUT",
            data: data,
            contentType: 'application/json',
            dataType : "json",
        };
        return utils.promising_ajax(this.api_url(path), settings);
    };

    child_contents.prototype.download = function(url) {

        var settings = {
            processData : false,
            type : "GET",
            contentType: 'application/json',
            dataType : "json",
        };
        return utils.promising_ajax(this.api_url('fetch')+'?url=' + url, settings);
    };

    return {'Contents': child_contents};
});