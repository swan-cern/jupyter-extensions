import $ from 'jquery';
import Jupyter from 'base/js/namespace';
import events from 'base/js/events';
import utils from 'base/js/utils';
import configmod from 'services/config';

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

/**
 * Put sharing files in sharing tab
 * Update the list of sharing elements and look for the ones being shared with the user
 */
function refresh_share_page() {

    api.get_shared_projects_by_me({}, function (sharing_projects_list) {

        var elem_list_sharing = $('#sharing-projects-list');
        elem_list_sharing.html('');

        if (sharing_projects_list.shares.length > 0) {
            var elem_template = $('#sharing-projects-project-element');

            $.each(sharing_projects_list.shares, function (i, project) {

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
                    gtag('event', 'sharing_share_inline');
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

        api.get_shared_projects_with_me({}, function (shared_projects) {

            /*
             Put shared files in shared tab
             */
            var elem_list_shared = $('#shared-projects-list');
            elem_list_shared.html('');

            if (shared_projects.shares.length > 0) {
                var elem_template = $('#shared-projects-project-element');

                $.each(shared_projects.shares, function (i, project) {
                    var elem = elem_template.clone();
                    elem.attr('id', '');
                    var name = project.project.split('/');
                    elem.find('.item_name').text(name[name.length - 1]);
                    elem.find('.shared_date').text(utils.format_datetime(project.shared_with[0].created));
                    elem.find('.shared_date').attr("title", moment(project.shared_with[0].created).format("YYYY-MM-DD HH:mm"));
                    elem.find('.shared_size').text(formatBytes(project.size));
                    elem.find('.shared_user').text(project.shared_by);
                    elem.find('.btn-clone').on('click', function () {
                        modal.show_clone_modal(project.project, project.shared_by);
                        gtag('event', 'sharing_clone');
                    });
                    elem.show();
                    elem_list_shared.append(elem);
                });

            } else {
                var elem = $('#share-projects-placeholder').clone();
                elem.show();
                elem_list_shared.append(elem);
            }

            $('.notebook_list.collapse ').on('shown.bs.collapse', function () {
                $(this).parent().find('h1 i, h2 i').removeClass('icon-expand').addClass('icon-collapse');
            });

            $('.notebook_list.collapse ').on('hidden.bs.collapse', function () {
                $(this).parent().find('h1 i, h2 i').removeClass('icon-collapse').addClass('icon-expand');
            });

        });
    });
}

/**
 * In the tree view puts the shared icon inline next to the shared files and links the share buttons to the modal box.
 * It also populates the share endpoint with the projects shared by me and with me.
 */
function refresh_tree_page() {

    api.get_shared_projects_by_me({}, function (sharing_projects_list) {

        var sharing_projects = [];
        $.each(sharing_projects_list.shares, function (i, project) {
            sharing_projects.push(project.project);
        });

        $('#notebook_list').find('.project_icon').each(function () {

            var parent = $(this).closest('.list_item');

            var this_project_path = parent.find('.item_link').attr('href')
                .replace(Jupyter.notebook_list.base_url + 'cernbox/', '')
                .replace(Jupyter.notebook_list.base_url + 'projects/', 'SWAN_projects/').replace('%20', ' ')
                .replace('#projects', '').replace('#cernbox', '').replace(/^\/|\/$/g, '');

            parent.find('.sharing-button').remove();

            var share_button_list;

            if ($.inArray(this_project_path, sharing_projects) !== -1) {
                share_button_list = $('<li><a href="javascript:" class="sharing-button blue">Edit sharing</a></li>');
            } else {
                share_button_list = $('<li><a href="javascript:" class="sharing-button green">Share</a></li>');
            }

            share_button_list.click(function () {
                modal.show_share_modal(this_project_path);
                gtag('event', 'sharing_tree_inline');
                return false;
            });

            parent.find('.actions').append(share_button_list);

            if ($.inArray(this_project_path, sharing_projects) !== -1) {
                parent.find('.sharing-indicator').show();
            } else {
                parent.find('.sharing-indicator').hide();
            }
        });
    });
}

/**
 * Start the extension from within the tree view
 * Bind the refresh of the interface to Jupytrer's tree refresh
 * Insert all the sharing elements in the interface
 */
function start_tree_view() {

    configs['tree'].load();

    var refresh_function;
    if (window.location.pathname.startsWith(Jupyter.notebook_list.base_url + 'share')) {
        refresh_function = refresh_share_page;

    } else if (window.location.pathname.startsWith(Jupyter.notebook_list.base_url + 'projects') ||
        (window.location.pathname.startsWith(Jupyter.notebook_list.base_url + 'cernbox/SWAN_projects'))) {
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
                    .split(Jupyter.notebook.notebook_name)[0];

                $.get(folder_path, function (folder) {

                    if (folder.type === 'project') {
                        modal.show_share_modal(folder.path);
                        gtag('event', 'sharing_notebook_header');
                    } else if (folder.type === 'directory' && folder.project) {
                        modal.show_share_modal(folder.project);
                        gtag('event', 'sharing_notebook_header');
                    } else {
                        util.alert_error(null, "You can only share SWAN Projects. Please place this notebook inside one.");
                        gtag('event', 'sharing_error_not_project');
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

// From https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function formatBytes(bytes) {
    if (bytes == 0) return 'Empty';
    var k = 1024,
        dm = 2,
        sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function share_button_click(project_path) {
    modal.show_share_modal(project_path);
    gtag('event', 'sharing_tree_header');
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
    load_ipython_extension
}
