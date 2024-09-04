import $ from 'jquery';
import require from 'require';
import utils from 'base/js/utils';
import configmod from 'services/config';
import endpoints_default from './api_endpoints.json';

/**
 * CERNBox API connector
 * Converts API calls in callable functions and hides the complexities of getting and keeping track of a token
 */

var base_url = utils.get_body_data('baseUrl');
var endpoints;

/**
 * Create a promise to load the endpoints configs.
 * Useful to provide different endpoints than the default ones.
 */
var configs_check = new Promise(function(resolve, _) {
    var config = new configmod.ConfigSection('sharing', {base_url: base_url});
    config.load();
    config.loaded.then(function() {
        if (config.data.sharing) {
            console.log("Found configurations for SwanShare", config.data.sharing);
            endpoints = config.data.sharing;
            resolve();
        } else {
            console.log("Using default configuration for SwanShare");
            endpoints = endpoints_default;
            resolve();
        }
    }).catch(function(){
        console.warn("Error getting SwanShare config: Using default");
        endpoints = endpoints_default;
        resolve();
    });
});

/**
 * Function to give access to the endpoints outside of API
 */
function get_endpoints() {
    return endpoints;
}


function TokenError(message) {
    this.name = "TokenError";
    this.message = (message || "");
}

TokenError.prototype = Object.create(Error.prototype);

function _get_auth_header() {

    var cookie = document.cookie.match("\\b_xsrf=([^;]*)\\b");
    var xsrf = cookie ? cookie[1] : undefined;

    if (xsrf) {
        return {
            'X-XSRFToken': xsrf
        }
    }
    return {}
};

/**
 * Execute the funcions passed as parameters with the auth token stored
 * If the token is invalid, get a new one with an iFrame to bypass SSO
 */
var authtoken = {

    _token: -1,

    /**
     * Open auth page - through SSO - in a hidden iFrame and register event listener for iFrame page event, in order to store the token.
     * Then execute the function asked and pass the token.
     * @param func API function to call after getting token
     * @param config Configurations for the Api function call
     * @param success Function to call in case of API success
     * @param failure Function to call in case of API failure
     * @private
     */
    _get_auth_token: function (func, config, success, failure) {

        console.log('Getting CERNBox auth token');

        var that = this;
        // Retrieve the user oauth token from jupyterhub
        $.ajax({
            url: base_url + 'api/swanshare?origin=' + window.location.origin,
            headers: _get_auth_header()
        })
            .done(function(data) {
                that._token = data;
                func(that._token.authtoken, config, success, failure);
            })
            .fail(function() {
                failure(_, 'Error contacting CERNBox');
            });
    },

    /**
     * Check the validity of access token before executing the requested function.
     * In case of invalid token, refresh it.
     * Then call the requested function and pass the token
     * @param func API function to call after getting token
     * @param config Configurations for the Api function call
     * @param success Function to call in case of API success
     * @param failure Function to call in case of API failure
     */
    ready: function (func, config, success, failure) {

        var that = this;
        configs_check.then(function() {
            if (that._token == -1 || new Date(that._token.expire) < new Date()) {
                that._get_auth_token(func, config, success, failure);
            } else {
                func(that._token.authtoken, config, success, failure);
            }
        });
    },

    /**
     * Make the token invalid in order to request a new one
     */
    invalidate: function () {
        this._token = -1;
    },

    /**
     * Get the auth token string
     */
    get_auth_token_value: function () {
        return this._token.authtoken;
    }

}

/**
 * Get all projects shared by me
 * @param token Access token
 * @param success Function to call in case of API success
 * @param failure Function to call in case of API failure
 */
function get_shared_projects_by_me(token, _, success, failure) {

    ajax_request(endpoints.domain + endpoints.base + endpoints.shared,
        token, "GET", null, "json", success, failure);
}

/**
 * Get all projects shared with me by other users
 * @param token Access token
 * @param success Function to call in case of API success
 * @param failure Function to call in case of API failure
 */
function get_shared_projects_with_me(token, _, success, failure) {

    ajax_request(endpoints.domain + endpoints.base + endpoints.shared_with_me,
        token, "GET", null, "json", success, failure);
}

/**
 * Get information about a project shared by me
 * @param token Access token
 * @param config Project path
 * @param success Function to call in case of API success
 * @param failure Function to call in case of API failure
 */
function get_shared_project_info(token, config, success, failure) {

    ajax_request(endpoints.domain + endpoints.base + endpoints.share,
        token, "GET",
        {
            project: config
        },
        "json", success, failure);
}

/**
 * Share a project with other users
 * @param token Access token
 * @param config Object with a list share with the users with whom the project should be shared
 * @param success Function to call in case of API success
 * @param failure Function to call in case of API failure
 */
function set_shared_project(token, config, success, failure) {

    ajax_request(endpoints.domain + endpoints.base + endpoints.share + "?project=" + encodeURIComponent(config.project),
        token, "PUT",
        JSON.stringify({
            share_with: config.share
        }),
        null, success, failure);
}

/**
 * Stop sharing a project
 * @param token Access token
 * @param config Project path
 * @param success Function to call in case of API success
 * @param failure Function to call in case of API failure
 */
function remove_sharing_project(token, config, success, failure) {

    ajax_request(endpoints.domain + endpoints.base + endpoints.share + "?project=" + encodeURIComponent(config),
        token, "DELETE", null, null, success, failure);
}

/**
 * Clone a project to user path
 * @param token Access token
 * @param config Info about the project to be shared
 * @param success Function to call in case of API success
 * @param failure Function to call in case of API failure
 */
function clone_shared_project(token, config, success, failure) {

    ajax_request(endpoints.domain + endpoints.base + endpoints.clone
        + "?project=" + encodeURIComponent(config.project)
        + "&sharer=" + config.sharer
        + "&destination=" + encodeURIComponent(config.destination),
        token, "POST", null, null, success, failure);
}

/**
 * AJAX request wrapper
 * @param url URL to call
 * @param token Access token
 * @param type Type of request
 * @param data Data value to add to the request
 * @param success Function to call in case of API success
 * @param failure Function to call in case of API failure
 */
function ajax_request(url, token, type, data, dataType, success, failure) {

    $.ajax({
        url: require.toUrl(url),
        headers: {
            Authorization: 'Bearer ' + token
        },
        type: type,
        data: data,
        dataType: dataType,
        statusCode: {
            401: function () {
                throw new TokenError('Invalid token');
            }
        },
        success: success,
        error: failure
    });
}

/**
 * Wrapper to functions calls
 * In case of failure with the authentication, this invalidates the current token,
 * asks for a new one a re-calls the original function
 * @param func Function to be called
 * @returns {Function} Wrapping callable function
 */
function execute_function(func) {

    return function (config, success, failure) {
        try {
            authtoken.ready(func, config, success, failure);
        } catch (e) {
            if (e instanceof TokenError) { //Try a second time to get a valid token
                try {
                    authtoken.invalidate();
                    authtoken.ready(func, config, success, failure);
                } catch (e2) {
                    if(failure) {
                        failure(_, e.message, e2);
                    } else {
                        console.error("SwanShare API error", e2);
                    }
                }
            } else {
                if(failure) {
                    failure(_, e.message, e);
                }else {
                    console.error("SwanShare API error getting Token", e);
                }
            }
        }

    }
}

export default {
    get_shared_projects_by_me: execute_function(get_shared_projects_by_me),
    get_shared_projects_with_me: execute_function(get_shared_projects_with_me),
    get_shared_project_info: execute_function(get_shared_project_info),
    set_shared_project: execute_function(set_shared_project),
    remove_sharing_project: execute_function(remove_sharing_project),
    clone_shared_project: execute_function(clone_shared_project),
    get_endpoints: get_endpoints,
    authtoken: authtoken
};
