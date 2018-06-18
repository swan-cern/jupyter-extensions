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

    child_contents.prototype.swan_api_url = function() {
        var url_parts = [
            this.base_url, 'api/swan/contents',
            utils.url_join_encode.apply(null, arguments),
        ];
        return utils.url_path_join.apply(null, url_parts);
    };

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

    child_contents.prototype.force_delete = function(path) {
        var settings = {
            processData : false,
            type : "DELETE",
            dataType : "json",
        };
        var url = this.swan_api_url(path);
        return utils.promising_ajax(url, settings).catch(
            // Translate certain errors to more specific ones.
            function(error) {
                // TODO: update IPEP27 to specify errors more precisely, so
                // that error types can be detected here with certainty.
                if (error.xhr.status === 400) {
                    throw new child_contents.DirectoryNotEmptyError();
                }
                throw error;
            }
        );
    };

    return {'Contents': child_contents};
});