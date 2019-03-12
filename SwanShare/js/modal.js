import $ from 'jquery';
import require from 'require';
import Jupyter from 'base/js/namespace';
import events from 'base/js/events';
import utils from 'base/js/utils';
import dialog from 'base/js/dialog';
import keyboard from 'base/js/keyboard';

import autocomplete from 'devbridge-autocomplete';

import share_widget from './templates/share_widget.html'

import util from './util';
import api from './api';

var modal_share;
var modal_clone;
var current_project;
var current_user;

var persons = [];
var person_names = [];
var is_start = true;

var current_user = (Jupyter.notebook_list ? Jupyter.notebook_list : Jupyter.notebook)
    .base_url.replace('/user/', '').replace('/', '');

var buttons = {
    has_state: {
        'Stop Sharing': {
            class: 'btn-danger act-unshare size-50',
            click: stop_sharing
        },
        'Update': {
            class: 'btn-primary act-update size-50',
            click: update_sharing
        }
    },
    no_state: {
        'Share': {
            class: 'btn-success act-share size-100',
            click: update_sharing
        }
    },
    clone: {
        'Clone': {
            class: 'btn-success act-share size-100',
            click: clone
        }
    }

};

/**
 * Share and Update Share button action
 * Send the list of users selected to update the sharing.
 * Should only be called when the list os users is not empty
 */
function update_sharing() {

    if (persons.length > 0) {

        modal_share.find('.btn').prop('disabled', true);
        modal_share.data('bs.modal').isShown = false;

        api.set_shared_project({
                project: current_project,
                share: persons
            },
            function () {
                util.alert_success(modal_share, (is_start ? "Started" : "Updated") + " sharing with success");
                events.trigger('draw_notebook_list.NotebookList');
            },
            function () {
                util.alert_error_modal(modal_share, "Error trying to share the Project. Please try again.");
            });
    }
    return false;
}

/**
 * Stop Sharing button action
 * Remove the share for the current project
 */
function stop_sharing() {

    modal_share.find('.btn').prop('disabled', true);
    modal_share.data('bs.modal').isShown = false;

    api.remove_sharing_project(current_project,
        function () {
            util.alert_success(modal_share, "Stopped sharing with success");
            events.trigger('draw_notebook_list.NotebookList');
        },
        function () {
            util.alert_error_modal(modal_share, "Error trying to stop sharing the Project. Please try again.");
        });
}

/**
 * Clone button action
 * Ask user for the name to give to the local folder, calls the API to get the clone and redirects the browser to that folder
 */
function clone() {

    modal_clone.find('.btn').prop('disabled', true);
    modal_clone.data('bs.modal').isShown = false;

    var new_path = modal_clone.find('#new_name').val();

    api.clone_shared_project({
            project: current_project,
            sharer: current_user,
            destination: 'SWAN_projects/' + new_path
        },
        function () {
            var base_url = utils.get_body_data("baseUrl");
            window.location.replace(base_url + 'projects/' + new_path);
        },
        function (error) {
            var error_json = JSON.parse(error.responseText);
            util.alert_error_modal(modal_clone, "Error trying to clone the Project. Please try again. " + error_json.error);
        });

}

/**
 * Add a person, with corresponding icon, to the HTML list
 * Bind action for removal
 * @param person Person object from API
 */
function add_person(person) {

    person_names.push(person.name);

    var shared_people = modal_share.find('#shared-people');

    var li = $('<li>')
        .appendTo(shared_people);

    li.append('<span class="remove">×</span>');
    if (person.entity === "u") {
        li.append('<i class="fa fa-user" aria-hidden="true"></i>');

    } else {
        li.append('<i class="fa fa-users" aria-hidden="true"></i>');
    }
    li.append(person.display_name ? person.display_name : person.name);

    li.on('click', function () {
        persons.splice(persons.indexOf(person), 1);
        person_names.splice(person_names.indexOf(person.name), 1);
        li.remove();

        if (persons.length === 0) {
            modal_share.find('.act-update, .act-share').attr('disabled', '');
        }
    });
    modal_share.find('.act-update, .act-share').removeAttr('disabled');
}

/**
 * Open the modal box and instantiate the autocomplete
 * Before opening  gets the info about the project from the API
 * @param project Path of the project to be shared
 */
function show_share_modal(project) {

    current_project = project;
    // Reset all values
    persons = [];
    person_names = [];
    is_start = true;

    api.get_shared_project_info(project, function (project_info) {

            var shared_users = project_info.shares[0] ? project_info.shares[0].shared_with : null;

            modal_share = dialog.modal({
                show: false,
                draggable: false,
                title: 'Share Project',
                notebook: Jupyter.notebook,
                keyboard_manager: Jupyter.keyboard_manager,
                body: $('<div/>').attr('id', 'share-widget').append(share_widget),
                buttons: shared_users ? buttons.has_state : buttons.no_state
            }).attr('id', 'sharing-modal').addClass('right');

            if (shared_users) {
                persons = shared_users;
                persons.forEach(add_person);
                is_start = false;
            } else {
                modal_share.find('.act-share').attr('disabled', '');
            }

            modal_share.find('#name-search').devbridgeAutocomplete({
                serviceUrl: require.toUrl(api.get_endpoints().domain + api.get_endpoints().base + api.get_endpoints().search),
                showNoSuggestionNotice: true,
                minChars: 2,
                deferRequestBy: 400,
                preventBadQueries: false,
                preserveInput: true,
                paramName: "filter",
                dataType: 'json',
                ajaxSettings: {
                    headers: {
                        Authorization: 'Bearer ' + api.authtoken.get_auth_token_value()
                    }
                },
                transformResult: function (response) {

                    return {
                        suggestions: $.map(response, function (item) {

                            // Don't allow sharing with the own user
                            if (item.cn === current_user) {
                                return null; // Return null to remove from the suggestions
                            }

                            // TO BE REMOVED
                            if (item.account_type === "egroup" || item.account_type === "unixgroup") {
                                return null; // Return null to remove from the suggestions
                            }

                            var converted_data = {
                                name: item.cn,
                                entity: item.account_type === "egroup" ? "egroup" : (item.account_type === "unixgroup" ? "g" : "u"),
                                display_name: item.account_type === "egroup" ? item.display_name : item.display_name + " (" + item.cn + ")"
                            }

                            return {value: converted_data.display_name, data: converted_data};
                        })
                    };
                },
                onSelect: function (suggestion) {

                    // Already removed from the selection options if present in the list
                    persons.push(suggestion.data);
                    add_person(suggestion.data);
                    modal_share.find('#name-search').val('');
                },
                onSearchStart: function () {
                    $(this).parent().find('.error').hide();
                    $(this).parent().find('.loading').show();
                },
                onSearchComplete: function () {
                    $(this).parent().find('i').hide();
                },
                onSearchError: function (query, jqXHR, textStatus, errorThrown) {

                    if (jqXHR.status === 0) {
                        // Request canceled because user changed the input
                        return;
                    }

                    var error_icon = $(this).parent().find('.error');

                    if (jqXHR.status === 400) {
                        error_icon.attr('title', 'Invalid input');
                        error_icon.addClass('warning');

                    } else {
                        error_icon.attr('title', 'Error contacting directory. Please try again.');
                        error_icon.removeClass('warning');
                        console.log('Error contacting directory:', errorThrown);
                    }
                    $(this).parent().find('.loading').hide();
                    error_icon.show();
                },
                beforeRender: function (container, suggestions) {

                    if(suggestions.length === 0) return;

                    var counter = 0;
                    $.each(suggestions, function (i, suggestion) {

                        if (person_names.indexOf(suggestion.data.name) !== -1 ) {
                            container.find('[data-index='+i+']').hide();
                            counter++;
                        }
                    });

                    if (counter === suggestions.length) {
                        $('<div class="autocomplete-no-suggestion">Name(s) already added</div>')
                            .appendTo(container);
                    }
                }
            });

            modal_share.on('shown.bs.modal', function () {
                modal_share.find('#name-search').focus();
            });

            modal_share.modal('show');

            modal_share.find(".modal-header").unbind("mousedown");
            modal_share.find('.project-path').text(project.replace('SWAN_projects/', '').replace(/^\/|\/$/g, ''));

        },
        function (requestObject, error, errorThrown) {
            console.log('Error opening the share dialog', requestObject, error, errorThrown);
            var error_json = JSON.parse(requestObject.responseText);
            util.alert_error(null, 'Error opening the share dialog. ' + error_json.error);
        });
}

/**
 * Modal box to let the user choose the name of the cloned Project
 * @param project Path of the project to be cloned
 * @param user User who shared the project
 */
function show_clone_modal(project, user) {

    current_project = project;
    current_user = user;

    var name = project.split('/');

    modal_clone = dialog.modal({
        draggable: false,
        title: 'Clone Project',
        notebook: Jupyter.notebook,
        body: $('<div><p class="rename-message">Enter the cloned Project name:</p><br>' +
            '<input id="new_name"  value="' + name[name.length - 1] + '"type="text" size="25" class="form-control"></div>'),
        buttons: buttons.clone,
        open : function () {
            modal_clone.find('input[type="text"]').keydown(function (event) {
                if (event.which === keyboard.keycodes.enter) {
                    modal_clone.find('.btn-primary').first().click();
                    return false;
                }
            });
            modal_clone.find('input[type="text"]').focus().select();
        }
    });
}

export default {
    show_share_modal: show_share_modal,
    show_clone_modal: show_clone_modal
}
