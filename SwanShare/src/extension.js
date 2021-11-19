import $ from 'jquery';
import Jupyter from 'base/js/namespace';
import events from 'base/js/events';
import utils from 'base/js/utils';
import configmod from 'services/config';
import moment from 'moment'

import util from './util';
import modal from './modal';
import api from './api';

/**
 * SwanShare extension
 * It allows the sharing of projects through CERNBox API.
 * This file adds all the graphical elements to the tree view, share tab and notebook.
 */

// create config object to load parameters
var base_url = utils.get_body_data("baseUrl");
var configs = {
    notebook: new configmod.ConfigSection('notebook', {base_url: base_url}),
    tree: new configmod.ConfigSection('tree', {base_url: base_url})
};

// Store the API replies
var sharing_projects_list;
var shared_projects_list;

// Configs for both lists in the Share tab
var sorting = {
    'shared' : {
        id : 'sort-name',
        direction : 1,
        function : sorter_name(1),
        draw : draw_shared_with_me
    },
    'sharing' : {
        id : 'sort-name',
        direction : 1,
        function : sorter_name(1),
        draw : draw_shared_by_me
    }
}

// Types of sorting made available
var sort_functions = {
    'sort-name': sorter_name,
    'last-modified': sorter_modified,
    'sort-size': sorter_size,
    'sort-with': sorter_with,
    'sort-by': sorter_by
};

/**
 * Put sharing files in sharing tab
 * Update the list of sharing elements and look for the ones being shared with the user
 */
function refresh_share_page() {

    api.get_shared_projects_with_me({}, function (shared_projects) {

        if (shared_projects.shares && shared_projects.shares.length > 0) {
            shared_projects_list = shared_projects.shares;
        } else {
            shared_projects_list = null;
        }
        draw_shared_with_me();
    });

    api.get_shared_projects_by_me({}, function (sharing_projects) {

        if (sharing_projects.shares && sharing_projects.shares.length > 0) {
            sharing_projects_list = sharing_projects.shares;
        } else {
            sharing_projects_list = null;
        }
        draw_shared_by_me();
    });
}

/**
 * Put the shared icons in the tree view and refresh the list of shared projects.
 * Refresh the list with old values while waiting for new ones (the API takes some time to reply)
 */
function refresh_tree_page() {

    // Refresh with the old values to prevent the sharing icons from disappearing while waiting for the API
    draw_notebook_list();

    if (Jupyter.notebook_list.notebook_path === "SWAN_projects") {

        api.get_shared_projects_by_me({}, function (sharing_projects) {

            var temp_sharing_projects = [];
            $.each(sharing_projects.shares, function (i, project) {
                temp_sharing_projects.push(project.project);
            });
            sharing_projects_list = temp_sharing_projects;

            // Refresh with the new values
            draw_notebook_list();
        });
    }
}

/**
 * In the tree view puts the shared icon inline next to the shared files and links the share buttons to the modal box.
 * It also populates the share endpoint with the projects shared by me and with me.
 */
function draw_notebook_list() {

    $('#notebook_list').find('.project_icon').each(function () {

        var parent = $(this).closest('.list_item');

        var this_project_path = parent.find('.item_link').attr('href')
            .replace(Jupyter.notebook_list.base_url + 'cernbox/', '')
            .replace(Jupyter.notebook_list.base_url + 'projects/', 'SWAN_projects/')
            .replace(/%20/g, ' ').replace(/^\/|\/$/g, '');

        parent.find('.sharing-button').remove();

        var share_button_list;

        if ($.inArray(this_project_path, sharing_projects_list) !== -1) {
            share_button_list = $('<li><a href="javascript:" class="sharing-button blue">Edit sharing</a></li>');
        } else {
            share_button_list = $('<li><a href="javascript:" class="sharing-button green">Share</a></li>');
        }

        share_button_list.click(function () {
            modal.show_share_modal(this_project_path);
            return false;
        });

        parent.find('.actions').append(share_button_list);

        if ($.inArray(this_project_path, sharing_projects_list) !== -1) {
            parent.find('.sharing-indicator').show();
        } else {
            parent.find('.sharing-indicator').hide();
        }
    });
}

/**
 * Draw the list of files that are being shared with me, in the Share tab
 */
function draw_shared_with_me () {
    var elem_list_shared = $('#shared-projects-list');
    elem_list_shared.html('');

    shared_projects_list.sort(sorting['shared'].function);

    if (shared_projects_list) {
        var elem_template = $('#shared-projects-project-element');

        $.each(shared_projects_list, function (i, project) {
            var elem = elem_template.clone();
            elem.attr('id', '');
            var name = project.project.split('/');
            name = name[name.length - 1];
            elem.find('.item_name').text(name);
            elem.find('.shared_date').text(utils.format_datetime(project.shared_with[0].created));
            elem.find('.shared_date').attr("title", moment(project.shared_with[0].created).format("YYYY-MM-DD HH:mm"));
            elem.find('.shared_size').text(utils.format_filesize(parseInt(project.size)));
            elem.find('.shared_user').text(project.shared_by);
            elem.find('.btn-clone').on('click', function () {
                clone_project(project.project, project.shared_by);
            });

            var this_path = Jupyter.notebook_list.base_url + 'share/' + project.shared_by + '/' + name;
            elem.find('.item_link').attr('href', this_path);

            elem.show();
            elem_list_shared.append(elem);
        });

    } else {
        var elem = $('#share-projects-placeholder').clone();
        elem.show();
        elem_list_shared.append(elem);
    }
}

/**
 * Draw the list of files that are being shared by me, in the Share tab
 */
function draw_shared_by_me () {
    var elem_list_sharing = $('#sharing-projects-list');
    elem_list_sharing.html('');

    if (sharing_projects_list) {
        var elem_template = $('#sharing-projects-project-element');

        sharing_projects_list.sort(sorting['sharing'].function);

        $.each(sharing_projects_list, function (i, project) {

            var elem = elem_template.clone();
            elem.attr('id', '');
            elem.find('.item_name').text(project.project.replace('SWAN_projects/', ''));
            elem.find('.shared_date').text(utils.format_datetime(project.shared_with[0].created));
            elem.find('.shared_date').attr("title", moment(project.shared_with[0].created).format("YYYY-MM-DD HH:mm"));
            if (project.shared_with.length == 1) {
                elem.find('.shared_with').text(project.shared_with[0].name);
            } else {
                elem.find('.shared_with').text(project.shared_with.length + " people/groups");
            }
            elem.find('.btn-update').on('click', function () {
                modal.show_share_modal(project.project);
            });

            var this_path = Jupyter.notebook_list.base_url + 'projects/' + project.project.replace('SWAN_projects/', '');
            elem.find('.item_link').attr('href', this_path);

            elem.show();
            elem_list_sharing.append(elem);
        });
    } else {
        var elem = $('#share-projects-placeholder').clone();
        elem.show();
        elem_list_sharing.append(elem);
    }
}

/**
 * Start the extension from within the tree view
 * Bind the refresh of the interface to Jupytrer's tree refresh
 * Insert all the sharing elements in the interface
 */
function start_tree_view() {

    configs['tree'].load();

    var refresh_function;
    if (Jupyter.notebook_list.current_page === Jupyter.notebook_list.pages.share) {
        refresh_function = refresh_share_page;
        register_share_page_events();
    } else {
        refresh_function = refresh_tree_page;
    }

    if (refresh_function) {
        configs.tree.loaded.then(function () {
            refresh_function();
            events.on('draw_notebook_list.NotebookList', refresh_function);
        });
    }
}

/**
 * Register the events called by clicking in the column titles that are sortable,
 * as well as the collapse/expand buttons next to the titles. All, necessary in the Share tab.
 */
function register_share_page_events() {

    $('.sort-action-share').unbind();
    $('.sort-action-share').click(function (e) {

        var target = $(e.target);
        var sort_on = e.target.dataset.sorter;
        var parent = target.closest(".notebook_list");
        var id = parent.attr('id');

        // Clear sort indications in UI
        parent.find( ".sort-action-share i").removeClass("fa-sort-desc").removeClass("fa-sort-asc")

        if ((sorting[id].id === sort_on) && (sorting[id].direction === 1)) {
            sort_list(id, sort_on, 0);
            target.find("i").addClass("fa-sort-asc");
            sorting[id].direction = 0;
        } else {
            sort_list(id, sort_on, 1);
            target.find("i").addClass("fa-sort-desc");
            sorting[id].direction = 1;
        }

        sorting[id].id = sort_on;
        parent.find( ".sort-action-share i").hide();
        target.find("i").show();
    });

    $('.notebook_list.collapse ').on('shown.bs.collapse', function () {
        $(this).parent().find('h1 i, h2 i').removeClass('icon-expand').addClass('icon-collapse');
    });

    $('.notebook_list.collapse ').on('hidden.bs.collapse', function () {
        $(this).parent().find('h1 i, h2 i').removeClass('icon-collapse').addClass('icon-expand');
    });
}

/**
 * Sort the Projects list, in the Share tab
 * @param list_id Id of the list to be sorted (shared by me or with me)
 * @param id Name of the sorting function
 * @param order 1 for Ascending or 0 for descending order
 */
function sort_list (list_id, id, order) {
    if (sort_functions.hasOwnProperty(id)) {
        sorting[list_id].function = sort_functions[id](order);
        sorting[list_id].draw();
    } else {
        console.error("No such sort id: '" + id + "'")
    }
}

/**
 * Start the extension from within the notebook editor
 * Puts a button in the header
 */
function start_notebook_view() {

    configs['notebook'].load();

    configs.notebook.loaded.then(function () {

        var share_button = $('<button class="btn btn-default btn-xs" title="Share"> \
            <i class="fa fa-share-alt" aria-hidden="true"></i>\
            </button>');

        share_button.on('click', function () {

            var folder_path = window.location.href;

            if (folder_path.indexOf(Jupyter.notebook.base_url + 'notebooks/SWAN_projects/') !== -1) {

                folder_path = folder_path.replace('/notebooks/SWAN_projects/', '/api/contents/SWAN_projects/')
                    .split(encodeURI(Jupyter.notebook.notebook_name))[0];

                $.get(folder_path, function (folder) {

                    if (folder.is_project) {
                        modal.show_share_modal(folder.path);
                    } else if (folder.type === 'directory' && folder.project) {
                        modal.show_share_modal(folder.project);
                    } else {
                        util.alert_error(null, "You can only share SWAN Projects. Please place this notebook inside one.");
                    }
                }).fail(function (e) {
                    console.log('Error getting project path', e);
                    util.alert_error(null, "There was an error with your project. Please try again later.");
                });

            } else {
                util.alert_error(null, "You can only share SWAN Projects and they must be inside SWAN_projects");
            }
        });

        $('#buttons-right').prepend(share_button);
    });
}

/**
 * Function used in the sort of the projects list.
 * Returns a function the compares two projects by their name, depending on the order chosen.
 * @param ascending If the function should consider the ascending order
 * @returns {Function} Comparable function
 */
function sorter_name(ascending) {
    return (function (a, b) {
        return sorter_string_aux(ascending, a.project, b.project)
    });
}


/**
 * Function used in the sort of the projects list.
 * Returns a function the compares two projects by their "shared by" name, depending on the order chosen.
 * @param ascending If the function should consider the ascending order
 * @returns {Function} Comparable function
 */
function sorter_by(ascending) {
    return (function (a, b) {
        return sorter_string_aux(ascending, a.shared_by, b.shared_by);
    });
}

/**
 * Function used in the sort of the projects list.
 * Returns a function the compares two projects by their "shared with" name, depending on the order chosen.
 * @param ascending If the function should consider the ascending order
 * @returns {Function} Comparable function
 */
function sorter_with(ascending) {
    return (function (a, b) {
        if (a.shared_with.length == 1 && b.shared_with.length == 1) {
            return sorter_string_aux(ascending, a.shared_with[0].name, b.shared_with[0].name);
        }

        return sorter_number_aux(ascending, a.shared_with.length, b.shared_with.length);
    });
}


/**
 * Function used in the sort of the projects list.
 * Returns a function the compares two projects by their size, depending on the order chosen.
 * @param ascending If the function should consider the ascending order
 * @returns {Function} Comparable function
 */
function sorter_size(ascending) {
    return (function (a, b) {
        var aa = sorter_number_aux(ascending, parseInt(a.size), parseInt(b.size));
        return aa;
    });
}


/**
 * Function used in the sort of the projects list.
 * Returns a function the compares two projects by modified date, depending on the order chosen.
 * @param ascending If the function should consider the ascending order
 * @returns {Function} Comparable function
 */
function sorter_modified(ascending) {
    var order = ascending ? 1 : 0;
    return (function (a, b) {
        return utils.datetime_sort_helper(a.shared_with[0].created, b.shared_with[0].created,
            order)
    });
}

/**
 * Auxiliary function to compare strings, depending on order
 * @param ascending Order to compare
 * @param a First string
 * @param b Second string
 * @returns {number} Order (-1, 0 or 1)
 */
function sorter_string_aux(ascending, a, b) {

    if (a.toLowerCase() < b.toLowerCase()) {
        return (ascending) ? -1 : 1;
    }
    if (a.toLowerCase() > b.toLowerCase()) {
        return (ascending) ? 1 : -1;
    }
    return 0;
}

/**
 * Auxiliary function to compare integers, depending on order
 * @param ascending Order to compare
 * @param a First integer
 * @param b Second integer
 * @returns {number} Order (-1, 0 or 1)
 */
function sorter_number_aux (ascending, a, b) {

    if (a < b) {
        return (ascending) ? -1 : 1;
    }
    if (a > b) {
        return (ascending) ? 1 : -1;
    }
    return 0;
}

function share_button_click(project_path) {
    modal.show_share_modal(project_path);
}

function clone_project(project, shared_by) {
    modal.show_clone_modal(project, shared_by);
}

function load_ipython_extension() {
    if (Jupyter.notebook != null) {
        start_notebook_view();
    } else {
        start_tree_view();
    }
}

export {
    share_button_click,
    clone_project,
    load_ipython_extension
}
