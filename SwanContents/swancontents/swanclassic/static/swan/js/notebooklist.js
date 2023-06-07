define([
    'jquery',
    'require',
    'base/js/namespace',
    'tree/js/notebooklist',
    'base/js/dialog',
    'base/js/utils',
    'base/js/events',
    'base/js/keyboard',
    'moment'
], function ($, requirejs, IPython, notebook_list, dialog, utils, events, keyboard, moment) {

    /**
     * Extends Jupyter notebooklist lib to cope with the new filemanager and handlers
     * Add "Project" as a new type of object and override some of it functions
     */

    var swan_projects_name = 'SWAN_projects'
    var swan_share_root = 'swan_sharing_folder'

    var parent_notebook_list = notebook_list.NotebookList;
    var child_notebook_list = function (selector, options) {
        parent_notebook_list.call(this, selector, options);

        this.pages = {
            projects: {
                path: 'projects',
                title: 'My Projects'
            },
            share: {
                path: 'share',
                title: 'Share'
            },
            cernbox: {
                path: 'cernbox',
                title: 'CERNBox'
            }
        }

        if (window.location.pathname.startsWith(this.base_url + 'tree')) {
            window.location.replace(window.location.pathname.replace('tree', 'cernbox'));
        }

        if (window.location.pathname.startsWith(this.base_url + this.pages.projects.path)) {
            this.current_page = this.pages.projects;
        } else if (window.location.pathname.startsWith(this.base_url + this.pages.share.path)) {
            this.current_page = this.pages.share;
        } else {
            this.current_page = this.pages.cernbox;
        }

        $('.notebook_list.collapse ').on('shown.bs.collapse', function () {
            $(this).parent().find('h1 i, h2 i.icon-expand').removeClass('icon-expand').addClass('icon-collapse');
        });

        $('.notebook_list.collapse ').on('hidden.bs.collapse', function () {
            $(this).parent().find('h1 i, h2 i.icon-collapse').removeClass('icon-collapse').addClass('icon-expand');
        });

        parent_notebook_list.icons.project = 'project_icon';
        parent_notebook_list.uri_prefixes.project = this.current_page.path;
        parent_notebook_list.uri_prefixes.directory = this.current_page.path;

        this.sort_function = name_sorter(1);

        //Replace current state so we can go back and allow anchor links
        //as onpopstate checks if 'state' is not null

        var base_path = utils.url_path_join(
            this.base_url,
            this.current_page.path
        );
        window.history.replaceState({
            path: decodeURIComponent(window.location.pathname.replace(base_path, ''))
        }, this.current_page.title, window.location.pathname)

    }
    child_notebook_list.prototype = Object.create(parent_notebook_list.prototype);

    child_notebook_list.prototype.draw_notebook_list = function (list, error_msg) {

        // Check if the page changed to display the loading effect and clean the readme from previous page
        if (this.last_path === undefined || this.last_path !== this.notebook_path) {
            $('#readme').empty();
            this.changing_page = true;
            this.last_path = this.notebook_path;
        }

        this.display_graphical_elements();

        // Remember what was selected before the refresh.
        var selected_before = this.selected;

        // Store the data to be redrawn by sorting
        this.model_list = list;
        this.error_msg = error_msg;

        list.content.sort(this.sort_function);
        var message = error_msg || 'No files';
        var item = null;
        var model = null;
        var len = list.content.length;
        this.clear_list();
        var n_uploads = this.element.children('.list_item').length;
        if (len === 0) {
            item = this.new_item_swan(0);
            var span12 = item.first();
            span12.empty();
            span12.append($('<div style="margin:auto;text-align:center;color:grey"/>').text(message));
        }

        var offset = n_uploads;
        var is_project_view = this.current_page === this.pages.projects && this.notebook_path === swan_projects_name;

        item = null;
        for (var i = 0; i < len; i++) {
            model = list.content[i];

            if (!is_project_view || model.is_project ) {
                item = this.new_item_swan(i + offset, true, len);

                if (model.is_project) {
                    model.size = undefined;
                }

                try {
                    this.add_link(model, item);
                } catch (err) {
                    console.log('Error adding link: ' + err);
                }

                if ((list.is_project || list.project) && model.name.toLowerCase() === 'readme.md') {
                    var path = utils.url_path_join(
                        this.base_url,
                        'files',
                        utils.encode_uri_components(model.path)
                    );

                    this.add_readme(path, this.changing_page);
                }
            } else {
                // Needed if the default order is not by type, where all the projects come first
                // or if in the future the api only returns the projects instead of all folders
                offset--;
            }
        }
        this.changing_page = false;

        if (len !== 0 && item === null) {
            item = this.new_item_swan(0);
            var span12 = item.first();
            span12.empty();
            span12.append($('<div style="margin:auto;text-align:center;color:grey"/>').text('No Projects'));
        }
        this.add_header_footer(list)
        // Trigger an event when we've finished drawing the notebook list.
        events.trigger('draw_notebook_list.NotebookList');

        // Reselect the items that were selected before.  Notify listeners
        // that the selected items may have changed.  O(n^2) operation.
        selected_before.forEach(function (item) {
            var list_items = $('.list_item');
            for (var i = 0; i < list_items.length; i++) {
                var $list_item = $(list_items[i]);
                if ($list_item.data('path') === item.path) {
                    $list_item.find('input[type=checkbox]').prop('checked', true);
                    break;
                }
            }
        });

        this._selection_changed();

        /*

         Show Share button

         */


        if (list.is_project || list.path.startsWith(swan_share_root)) {
            show_share_related_buttons(list.path);
        } else if (list.type === 'directory' && list.project) {
            show_share_related_buttons(list.project);
        } else {
            hide_share_related_buttons()
        }

        function show_share_related_buttons(path) {
            if (path.startsWith(swan_share_root)) {
                show_clone_button(path);
            } else {
                show_share_button(path);
            }
        }

        function hide_share_related_buttons() {
            $('#share-project-button').hide();
            $('#clone-button').hide();
        }

        function show_share_button(project) {

            var share_button = $('#share-project-button');
            share_button.unbind();
            share_button.on('click', function () {
                requirejs(['nbextensions/swanshare/extension'], function (share) {
                    share.share_button_click(project);
                }, function (err) {
                    console.log('Failure while loading swanshare lib');
                });
            });

            share_button.show();
        }

        function show_clone_button(path) {

            var clone_button = $('#clone-button');
            clone_button.unbind();

            path = path.split('/');

            if (path.length >= 3) {
                clone_button.on('click', function () {
                    requirejs(['nbextensions/swanshare/extension'], function (share) {
                        share.clone_project(utils.url_path_join(swan_projects_name, path[2]), path[1]);
                    }, function (err) {
                        console.log('Failure while loading swanshare lib');
                    });
                });

                clone_button.show();
            }
        }
    };

    /**
     * Configure the given item with the correct link and other visual cues
     */
    child_notebook_list.prototype.add_link = function (model, item) {

        var that = this;
        var running = (model.type === 'notebook' && this.sessions[model.path] !== undefined);
        item.data('name', model.name);
        item.data('path', model.path);
        item.data('modified', model.last_modified);
        item.data('type', model.type);
        item.find(".item_name").text(model.name);
        item.find(".item_name").attr('title', model.name);
        var icon = null;
        if(model.is_project)
        {
            icon = parent_notebook_list.icons['project'];
        }else
        {
            icon = parent_notebook_list.icons[model.type];
        }

        if (running) {
            icon = 'running_' + icon;
        }
        var uri_prefix = parent_notebook_list.uri_prefixes[model.type];

        if (this.current_page === this.pages.share) {
            uri_prefix = 'view';
            if (model.type === 'notebook' || (model.type === 'file' && this._is_notebook(model))) {
                uri_prefix = 'notebook';
            }
        } else if (model.type === 'file') {
            if (this._is_viewable(model)) {
                uri_prefix = 'view';
            }
            if (this._is_pdflike(model)) {
                uri_prefix = 'files';
            }

            if (this._is_notebook(model)) {
                uri_prefix = 'notebooks';
            }
        }

        item.find(".item_icon").addClass(icon).addClass('icon-fixed-width');

        var url_path = model.path;
        if (this.current_page != this.pages.cernbox && (model.type === 'directory' || model.is_project)) {
            url_path = url_path.split('/').slice(1).join('/');
        }
        var link = item.find("a.item_link")
            .attr('href',
                utils.url_path_join(
                    this.base_url,
                    uri_prefix,
                    utils.encode_uri_components(url_path)
                )
            );

        if (running) {
            item.find(".running-indicator").show();
        }

        // directory nav doesn't open new tabs
        // files, notebooks do
        if (model.type !== "directory" && !model.is_project) {
            link.attr('target', IPython._target);
        } else {
            // Replace with a click handler that will use the History API to
            // push a new route without reloading the page
            link.click(function (e) {

                // Allow the default browser action when the user holds a modifier (e.g., Ctrl-Click)
                if(e.altKey || e.metaKey || e.shiftKey) {
                    return true;
                }

                window.history.pushState({
                    path: url_path
                }, url_path, utils.url_path_join(
                    that.base_url,
                    that.current_page.path,
                    utils.encode_uri_components(url_path)
                ));
                that.update_swan_location(url_path);
                return false;
            });
        }

        // Add in the date that the file was last modified
        item.find(".item_modified").text(utils.format_datetime(model.last_modified));
        item.find(".item_modified").attr("title", moment(model.last_modified).format("YYYY-MM-DD HH:mm"));

        var filesize = utils.format_filesize(model.size);
        item.find(".file-size").text(filesize || '\xA0');
    };

    /**
     * Add "New Project" button and change the sort icons displayed so that only one is displayed at a time
     */
    child_notebook_list.prototype.bind_events = function () {
        parent_notebook_list.prototype.bind_events.call(this);

        if (this.element_name === 'notebook') {

            var that = this;

            $('#new-project').click(function (e) {

                var modal = dialog.modal({
                    title: 'New Project',
                    body: $('<p class="rename-message">Enter a project name:</p><br>\
                            <input type="text" name="proj_name" placeholder="Keep empty for default name..." class="form-control">'),
                    buttons: {
                        'Create': {
                            class: 'btn-primary size-100',
                            click: create_new_project
                        }
                    },
                    open : function () {
                        modal.find('input[type="text"]').keydown(function (event) {
                            if (event.which === keyboard.keycodes.enter) {
                                modal.find('.btn-primary').first().click();
                                return false;
                            }
                        });
                        modal.find('input[type="text"]').focus().select();
                    }
                });
                modal.find(".modal-header").unbind("mousedown");

                function create_new_project() {

                    modal.find('.btn').prop('disabled', true);
                    modal.data('bs.modal').isShown = false;

                    var proj_name = modal.find('input[name="proj_name"]').val();

                    if (proj_name === '') {
                        that.contents.new_untitled((that.notebook_path || ''), {type: 'project'})
                            .then(function (result) {
                                new_project_success(modal, result.path.replace(swan_projects_name, ''));
                            }).catch(function (e) {
                            new_project_error(modal, 'Error creating project: ', e);
                        });
                    } else {

                        that.contents.get((that.notebook_path || '') + '/' + proj_name, {type: 'directory'})
                            .then(function () {
                                new_project_error(modal, 'Cannot create project. Directory/Project already exist.');
                            }).catch(function (e) {
                                that.contents.new(((that.notebook_path || '') + '/' + proj_name), {type: 'project'})
                                    .then(function (result) {
                                        new_project_success(modal, proj_name);
                                    }).catch(function (e) {
                                        new_project_error(modal, 'Error creating project: ', e);
                                    }
                                );
                            }
                        );
                    }
                    that.load_sessions();
                }

                return false;
            });

            $('#download-project').click(function (e) {

                var modal = dialog.modal({
                    title: 'Download Project from git',
                    body: $('<p class="rename-message">Project url to download (it will also download submodules if they exist):</p><br>\
                            <input type="text" name="url" class="form-control">'),
                    buttons: {
                        'Download': {
                            class: 'btn-primary size-100',
                            click: download_project
                        }
                    },
                    open : function () {
                        modal.find('input[type="text"]').keydown(function (event) {
                            if (event.which === keyboard.keycodes.enter) {
                                modal.find('.btn-primary').first().click();
                                return false;
                            }
                        });
                        modal.find('input[type="text"]').focus().select();
                    }
                });
                modal.find(".modal-header").unbind("mousedown");

                function download_project() {

                    modal.find('.btn').prop('disabled', true);
                    modal.data('bs.modal').isShown = false;

                    var proj_url = modal.find('input[name="url"]').val();

                    that.contents.download(proj_url)
                        .then(function (result) {

                            if(result && result.path) {

                                var path = result.path.replace(swan_projects_name, '');

                                if (extension(path)) {
                                    path = path.split('/');
                                    path.pop();
                                    path = path.join('/');
                                }
                                new_project_success(modal, path);
                            } else {
                                new_project_error(modal, 'Error downloading project.');
                            }
                        }).catch(function (e) {
                            new_project_error(modal, 'Error downloading project: ', e);
                        }
                    );
                    that.load_sessions();
                }

                return false;
            });

            $('.sort-action').unbind();
            $('.sort-action').click(function (e) {
                var sort_on = e.target.id;

                // Clear sort indications in UI
                $(".sort-action i").removeClass("fa-sort-desc").removeClass("fa-sort-asc")

                if ((that.sort_id === sort_on) && (that.sort_direction === 1)) {
                    that.sort_list(sort_on, 0);
                    $("#" + sort_on + " i").addClass("fa-sort-asc");
                    that.sort_direction = 0;
                } else {
                    that.sort_list(sort_on, 1);
                    $("#" + sort_on + " i").addClass("fa-sort-desc");
                    that.sort_direction = 1;
                }
                that.sort_id = sort_on;

                $(sort_on === 'last-modified' ? "#sort-name i" : "#last-modified i").hide();
                $("#" + sort_on + " i").show();
            });

            $('.extend_name').on('click', function () {
                $(this).parent().parent().parent().parent().toggleClass("extended_names");
                $(this).find('i').toggleClass("fa-compress fa-expand");
            });

            /**
             * Common functions for new projects (upload or create)
             */

            function new_project_success(modal, path) {

                var url = utils.url_path_join(
                    that.base_url,
                    that.current_page.path,
                    utils.encode_uri_components(path)
                );

                modal.data('bs.modal').isShown = true;
                modal.modal('hide');

                window.history.pushState({
                    path: path
                }, path, url);
                that.update_swan_location(path);
            }

            function new_project_error(modal, message, exception) {

                if (exception) {
                    console.warn(message, exception);
                }

                var reason = exception ? (exception.message || exception.xhr_error || exception.reason || exception) : '';

                var alert = $('<div/>')
                    .addClass('alert alert-dismissable')
                    .addClass('alert-danger')
                    .append(
                        $('<button class="close" type="button" data-dismiss="alert" aria-label="Close"/>')
                            .append($('<span aria-hidden="true"/>').html('&times;'))
                    )
                    .hide()
                    .append(
                        $('<p/>').text(message + reason)
                    );

                modal.find('.modal-body').prepend(alert);
                alert.slideDown('fast');

                modal.find('.btn').prop('disabled', false);
                modal.data('bs.modal').isShown = true;


                alert.fadeTo(4000, 500).slideUp(500, function () {
                    alert.slideUp(500);
                });
            }
        }
    };

    /**
     * New line design
     */
    child_notebook_list.prototype.new_item_swan = function (index, selectable, length) {

        var row = $('<div/>')
            .addClass("list_item")
            .addClass("row");

        var name_column = $('<div/>')
            .addClass("col-md-5")
            .addClass("col-xs-9")
            .appendTo(row);

        var actions_column = $('<div/>')
            .addClass("col-md-3")
            .addClass("hidden-xs")
            .append('<ul class="actions">')
            .appendTo(row);

        var size_column = $('<div/>')
            .addClass("col-md-1")
            .addClass("hidden-xs")
            .addClass("file-size")
            .appendTo(row);

        var status_column = $('<div/>')
            .addClass("col-md-1")
            .addClass("hidden-xs")
            .addClass("status-indicators")
            .appendTo(row);

        var time_column = $('<div/>')
            .addClass("col-md-2")
            .addClass("col-xs-3")
            .appendTo(row);

        var item_modified = $('<span>')
            .addClass("item_modified")
            .appendTo(time_column);


        var name_column_row = $('<div/>')
            .addClass("row")
            .appendTo(name_column);

        var name_column_selector = $('<div/>')
            .addClass("col-xs-1")
            .addClass("selector")
            .appendTo(name_column_row);

        var name_column_name = $('<div/>')
            .addClass("col-xs-11")
            .addClass("name")
            .appendTo(name_column_row);

        var checkbox;
        if (selectable !== undefined) {
            checkbox = $('<input/>')
                .attr('type', 'checkbox')
                .attr('title', 'Click here to rename, delete, etc.')
                .appendTo(name_column_selector);
        }

        $('<i/>')
            .addClass('item_icon')
            .appendTo(name_column_selector);

        var link = $("<a/>")
            .addClass("item_link")
            .appendTo(name_column_name);

        $("<span/>")
            .addClass("item_name")
            .appendTo(link);


        if (selectable === false) {
            checkbox.css('visibility', 'hidden');
        } else if (selectable === true) {
            var that = this;
            row.click(function (e) {
                // toggle checkbox only if the click doesn't come from the checkbox or the link
                if (!$(e.target).is('span[class=item_name]') && !$(e.target).is('input[type=checkbox]')) {
                    checkbox.prop('checked', !checkbox.prop('checked'));
                }
                that._selection_changed(e.shiftKey);
            });
        }

        $('<div/>')
            .addClass('running-indicator')
            .css('display', 'none')
            .append('<i class="fa fa-cogs" aria-hidden="true" title="Running"></i>')
            .appendTo(status_column);

        $('<div/>')
            .addClass('sharing-indicator')
            .css('display', 'none')
            .append('<i class="fa fa-share-alt" aria-hidden="true" title="This project is being shared"></i>')
            .appendTo(status_column);

        if (this.changing_page) {
            row.hide();
            row.delay(70 * index / length).fadeIn();
        }
        this.element.children().eq(index).after(row);

        return row;
    };

    child_notebook_list.prototype.new_item = function (index, selectable) {

        var row = $('<div/>')
            .addClass("list_item")
            .addClass("row");


        //So that the shutdown notebook button works
        var inside_div = $('<div/>')
            .appendTo(row);

        var name_column = $('<div/>')
            .addClass(index === -1 ? "col-xs-9" : "col-xs-5")
            .appendTo(inside_div);

        var time_column = $('<div/>')
            .addClass("item_buttons")
            .addClass("col-xs-3")
            .appendTo(inside_div);

        var name_column_row = $('<div/>')
            .addClass("row")
            .appendTo(name_column);

        var name_column_selector = $('<div/>')
            .addClass("col-xs-1")
            .appendTo(name_column_row);

        var name_column_name = $('<div/>')
            .addClass("col-xs-11")
            .addClass("name")
            .appendTo(name_column_row);

        $('<i/>')
            .addClass('item_icon')
            .appendTo(name_column_selector);

        var link = $("<a/>")
            .addClass("item_link")
            .appendTo(name_column_name);

        $("<span/>")
            .addClass("item_name")
            .appendTo(link);

        this.element.children().eq(index).after(row);

        return row;
    };

    child_notebook_list.prototype._selection_changed = function (shift_key) {
        // Use a JQuery selector to find each row with a checked checkbox.  If
        // we decide to add more checkboxes in the future, this code will need
        // to be changed to distinguish which checkbox is the row selector.
        var that = this;
        var selected = [];
        var has_running_notebook = false;
        var has_directory = false;
        var has_file = false;
        var that = this;
        var checked = 0;

        if (shift_key) {
            var selection = $('.list_item :checked');
            if (selection.length === 2) {
                var list_items = $('.list_item input');
                list_items.slice(list_items.index(selection.get(0)), list_items.index(selection.get(1))).prop('checked', 'checked');
            }
        }

        $('.list_item.selected').removeClass("selected");

        $('.list_item :checked').each(function (index, item) {
            var parent = $(this).closest('.list_item');
            parent.addClass("selected");

            // If the item doesn't have an upload button, isn't the
            // breadcrumbs and isn't the parent folder '..', then it can be selected.
            // Breadcrumbs path == ''.
            if (parent.find('.upload_button').length === 0 && parent.data('path') !== '' && parent.data('path') !== utils.url_path_split(that.notebook_path)[0]) {
                checked++;
                selected.push({
                    name: parent.data('name'),
                    path: parent.data('path'),
                    type: parent.data('type')
                });

                // Set flags according to what is selected.  Flags are later
                // used to decide which action buttons are visible.
                has_running_notebook = has_running_notebook ||
                    (parent.data('type') === 'notebook' && that.sessions[parent.data('path')] !== undefined);
                has_file = has_file || (parent.data('type') === 'file');
                has_directory = has_directory || (parent.data('type') === 'directory');
            }
        });
        this.selected = selected;

        // Rename is only visible when one item is selected, and it is not a running notebook
        if (selected.length === 1 && !has_running_notebook) {
            $('.rename-button').css('display', 'inline-block');
        } else {
            $('.rename-button').css('display', 'none');
        }

        // Move is visible if at least one item is selected, and none of them
        // are a running notebook.
        if (selected.length > 0 && !has_running_notebook) {
            $('.move-button').css('display', 'inline-block');
        } else {
            $('.move-button').css('display', 'none');
        }

        // Download is only visible when items are selected, and none are
        // running notebooks or a directories
        if (selected.length > 0 && !has_running_notebook && !has_directory) {
            $('.download-button').css('display', 'inline-block');
        } else {
            $('.download-button').css('display', 'none');
        }

        // Shutdown is only visible when one or more notebooks running notebooks
        // are selected and no non-notebook items are selected.
        if (has_running_notebook && !(has_file || has_directory)) {
            $('.shutdown-button').css('display', 'inline-block');
        } else {
            $('.shutdown-button').css('display', 'none');
        }

        // Duplicate isn't visible when a directory is selected.
        if (selected.length > 0 && !has_directory) {
            $('.duplicate-button').css('display', 'inline-block');
        } else {
            $('.duplicate-button').css('display', 'none');
        }

        // Delete is visible if one or more items are selected.
        if (selected.length > 0) {
            $('.delete-button').css('display', 'inline-block');
        } else {
            $('.delete-button').css('display', 'none');
        }

        // View is visible in the following case:
        //
        //   - the item is editable
        //   - it is not a notebook
        //
        // If it's not editable or unknown, the default action should be view
        // already so no need to show the button.
        // That should include things like, html, py, txt, json....
        if (selected.length >= 1 && !has_directory) {
            $('.view-button').css('display', 'inline-block');
        } else {
            $('.view-button').css('display', 'none');
        }

        // Edit is visible when an item is unknown, that is to say:
        //    - not in the editable list
        //    - not in the known non-editable list.
        //    - not a notebook.
        // Indeed if it's editable the default action is already to edit.
        // And non editable files should not show edit button.
        // for unknown we'll assume users know what they are doing.
        if (selected.length >= 1 && !has_directory && selected.every(function (el) {
                return that._is_editable(el);
            })) {
            $('.edit-button').css('display', 'inline-block');
        } else {
            $('.edit-button').css('display', 'none');
        }

        // If all of the items are selected, show the selector as checked.  If
        // some of the items are selected, show it as checked.  Otherwise,
        // uncheck it.
        var total = 0;
        $('.list_item input[type=checkbox]').each(function (index, item) {
            var parent = $(this).closest('.list_item');
            // If the item doesn't have an upload button and it's not the
            // breadcrumbs, it can be selected.  Breadcrumbs path == ''.
            if (parent.find('.upload_button').length === 0 && parent.data('path') !== '' && parent.data('path') !== utils.url_path_split(that.notebook_path)[0]) {
                total++;
            }
        });

        var select_all = $("#select-all");
        if (checked === 0) {
            select_all.prop('checked', false);
            select_all.prop('indeterminate', false);
            select_all.data('indeterminate', false);
        } else if (checked === total) {
            select_all.prop('checked', true);
            select_all.prop('indeterminate', false);
            select_all.data('indeterminate', false);
        } else {
            select_all.prop('checked', false);
            select_all.prop('indeterminate', true);
            select_all.data('indeterminate', true);
        }
    };

    child_notebook_list.prototype.delete_selected = function() {
        var message;
        var selected = this.selected.slice(); // Don't let that.selected change out from under us
        if (selected.length === 1) {
            message = '<p>Are you sure you want to permanently delete: ' + selected[0].name + '?<br>All of its contents will be lost.</p>';
        } else {
            message = '<p>Are you sure you want to permanently delete the ' + selected.length + ' files/folders/projects selected?<br>All of their contents will be lost.</p>';
        }
        var that = this;

        dialog.modal({
            title : "Delete",
            body : $(message),
            default_button: "Cancel",
            buttons : {
                Cancel: {},
                Delete : {
                    class: "btn-danger",
                    click: function() {
                        // Shutdown any/all selected notebooks before deleting
                        // the files.
                        that.shutdown_selected();

                        // Delete selected.
                        selected.forEach(function(item) {

                            // Shutdown all the notebooks inside this folder
                            for (var session in that.session_list.sessions) {
                                if (session.startsWith(item.path + '/')) {
                                    that.shutdown_notebook(session);
                                }
                            }

                            that.contents.force_delete(item.path).then(function() {
                                that.notebook_deleted(item.path);
                            }).catch(function(e) {

                                dialog.modal({
                                    title: "Delete Failed",
                                    body: $('<div/>')
                                        .text("An error occurred while deleting \"" + path + "\".")
                                        .append($('<div/>')
                                            .addClass('alert alert-danger')
                                            .text(e.message || e)),
                                    buttons: {
                                        OK: {'class': 'btn-primary'}
                                    }
                                });
                                console.warn('Error during content deletion:', e);
                            });
                        });
                    }
                }
            }
        });
    };

    /*
       Util functions for readme
     */

    /**
     * Returns the extension of a given file
     * @param path Path to the file
     * @returns {*} Extension name or null if there isn't any
     */
    var extension = function (path) {
        var parts = path.split('.');
        parts = parts.filter(function (n) {
            return n !== ""
        });
        if (parts.length > 1)
            return parts[parts.length - 1];
        return null;
    };

    /**
     * Returns the protocol of the url
     * @param path Url
     * @returns {*} Protocol name
     */
    var protocol = function (path) {
        var parts = path.split(':');
        parts = parts.filter(function (n) {
            return n !== ""
        });
        if (parts.length ==  2 && path.startsWith(parts[0] + ':'))
            return parts[0];
        return null;
    };

    /**
     * Check if the path given is external (if it conaint ://)
     * @param path Path/url to check
     * @returns {boolean}
     */
    var is_external = function (path) {
        var parts = path.split('://');
        if (parts.length > 1)
            return true;
        return false;
    };

    /**
     * Merges to paths, by replacing the relative modificators
     * i.e. "path/to/folder" + "../../to/file.txt" becomes "path/to/file.txt"
     * @param path1
     * @param path2
     * @returns {string} Joined path
     */
    function merge_paths(path1, path2) {

        var path_elems = path1.split('/');

        $.each(path2.split('/'), function (i, elem) {
            if (elem === "..") {
                path_elems.pop()
            } else if (elem !== ".") {
                path_elems.push(elem);
            }
        });
        return path_elems.join('/');
    }

    /**
     * Modal box to ask the user if it really wants to open an external url.
     * @param url Url to open
     */
    window.open_external = function (url) {
        dialog.modal({
            notebook: IPython.notebook,
            keyboard_manager: IPython.keyboard_manager,
            title: 'Opening external link',
            body: $('<p>Are you sure you want to open the following <b>external link</b>?<br>' + url + '</p>'),
            buttons: {
                'No': {},
                'Open': {
                    class: 'btn-warning',
                    click: function () {
                        window.open(url, '_blank');
                    }
                }
            }
        });
    }

    /**
     * Show the content of a readme file inside a div with "readme" id
     * @param path Path to the readme file
     * @param change Show fadein effect
     */
    child_notebook_list.prototype.add_readme = function (path, change) {

        var that = this;

        var readme = $('#readme');

        var fadein;
        if(change) {
            readme.hide();
            fadein = readme.delay(70).fadeIn().promise();
        }

        $.get(path, function (markdown) {

            var folder_path = path.replace(/\/readme.md/ig, '/');

            // Use showdown to convert markdown into HTML and xss to remove not allowed HTML elements
            // (for security reasons).
            // Replace the links with safer versions
            requirejs(['codemirror/lib/codemirror', './libs/showdown.min', './libs/xss.min', 'codemirror/mode/python/python',
                'notebook/js/codemirror-ipython'], function (CodeMirror, showdown) {

                var whitelist = filterXSS.getDefaultWhiteList();
                whitelist['h1'].push('id');
                whitelist['h2'].push('id');
                whitelist['h3'].push('id');
                whitelist['h4'].push('id');

                showdown.extension('clear-xss', function () {
                    return [{
                        type: "output",
                        filter: function (text) {
                            return filterXSS(text, {
                                whiteList: whitelist,
                                onTagAttr: function (tag, name, value, isWhiteAttr) {
                                    if (tag == 'a') {
                                        if (name == 'href') {

                                            var url_string;
                                            var blank = false;

                                            if (is_external(value)) { //External link. Tell that to the users
                                                url_string = 'javascript:open_external(\'' + value + '\')';

                                            } else {
                                                //Check if the links don't spill out of this project
                                                var temp_url = merge_paths(window.location.pathname, value);

                                                if (temp_url.startsWith(window.location.pathname)) {

                                                    if (protocol(value)) {
                                                        url_string = value;
                                                    } else if (!extension(value)) { //Not a file (could be a folder or anchor link)
                                                        //Test if it's an anchor link
                                                        if (value.startsWith('#')) {
                                                            url_string = value;
                                                        } else {
                                                            url_string = temp_url;
                                                        }
                                                    } else { //It's a file...
                                                        blank = true;
                                                        //It could be a notebook or other file (and all files are currently editable for Jupyter)
                                                        // base_url is already present in folder_path
                                                        url_string = utils.url_path_join(
                                                            folder_path.replace('files/', that._is_notebook({path: value}) ? 'notebooks/' : 'edit/'),
                                                            value
                                                        );
                                                    }
                                                } else { //Link outside the project: block it
                                                    url_string = "#"
                                                }
                                            }
                                            return 'href="' + url_string + '"' + (blank ? ' target="_blank"' : '');
                                        }
                                    } else if (tag == 'img') {
                                        if (name == 'src') {
                                            if (!is_external(value)) {
                                                new_value = utils.url_path_join(
                                                    folder_path,
                                                    value
                                                );
                                                return 'src="' + new_value + '"';
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }]
                });
                var converter = new showdown.Converter({
                    extensions: ['clear-xss']
                });
                converter.setOption('ghCompatibleHeaderId', true);
                converter.setOption('tables', true);
                var html = converter.makeHtml(markdown);

                var panel = $('<div>')
                    .addClass('row panel panel-default');

                var heading = $('<div>')
                    .addClass('panel-heading')
                    .attr('data-toggle', 'collapse')
                    .attr('data-target', '#readme .panel-body')
                    .appendTo(panel);

                $('<i>')
                    .addClass('fa fa-fw ')
                    .addClass(that.readme_closed ? 'fa-caret-down' : 'fa-caret-up')
                    .appendTo(heading);

                heading.append('readme.md');

                var body = $('<div>')
                    .addClass('panel-body collapse')
                    .addClass(that.readme_closed ? '' : 'in')
                    .appendTo(panel)
                    .on('shown.bs.collapse', function () {
                        heading.find('i').removeClass('fa-caret-down').addClass('fa-caret-up');
                        that.readme_closed = false;
                    })
                    .on('hidden.bs.collapse', function () {
                        heading.find('i').removeClass('fa-caret-up').addClass('fa-caret-down');
                        that.readme_closed = true;
                    });

                $('<div>')
                    .addClass('wrapper')
                    .html(html)
                    .appendTo(body);

                readme.html(panel);

                // Add syntax highlight to all pre code blocks
                readme.find('pre code').each(function() {

                    var this_obj = $(this),
                        text = this_obj.text().trim();
                    this_obj.empty();

                    var codemirror = CodeMirror(this, {
                        value: text,
                        mode: 'python',
                        lineNumbers: false,
                        readOnly: true
                    });

                    if (fadein) {
                        fadein.done(function () {
                            codemirror.refresh();
                        });
                    }
                });
            });
        });
    }

    /**
     * Update the files list
     */
    child_notebook_list.prototype.load_list = function () {

        var that = this;

        // Add an event handler browser back and forward events
        window.onpopstate = function (e) {
            if (e.state !== null) {
                var path = (window.history.state && window.history.state.path) ?
                    window.history.state.path : '';
                that.update_swan_location(path);
            }
        };

        // If share tab, do not load any contents
        if (!(this.current_page === this.pages.share && this.notebook_path === "")) {
            this.contents.list_contents(this.notebook_path).then(
                $.proxy(this.draw_notebook_list, this),
                function (error) {
                    that.draw_notebook_list({content: []}, "Server error: " + error.message);
                }
            );
        }
    };

    /**
     * Put the title, up and breadcrumb dynamically in the interface
     * Needed because now the interface reloads only the list of files
     */
    child_notebook_list.prototype.display_graphical_elements = function () {

        var that = this;

        var breadcrumb = $('.breadcrumb');
        var title = $('.title-bar h1');
        breadcrumb.empty();

        //Root path of the breadcrumb
        $('<li/>')
            .appendTo(breadcrumb)
            .append('<a href="/">SWAN</a>');


        var base_url = utils.url_path_join(
            that.base_url,
            that.current_page.path
        );

        // Add the current page
        // The base share tab page does not load dynamically, so the link should be a normal one
        if (this.current_page === this.pages.share) {

            $('<li/>')
                .appendTo(breadcrumb)
                .append('<a href="' + base_url + '">' + this.current_page.title + '</a>');
        } else {
            $('<li/>')
                .appendTo(breadcrumb)
                .append(get_link(this.current_page.title, ''));
        }

        if (this.notebook_path !== "" &&
            (this.current_page !== this.pages.projects || this.notebook_path !== swan_projects_name)) {

            var path_parts = [];
            var up_button = null;

            var paths = this.notebook_path.split('/');
            if (this.current_page === this.pages.projects || this.current_page === this.pages.share) {
                paths = paths.slice(1);

                if (paths.length == 2) {
                    up_button = '<a href="' + base_url + '"><i class="icon-up" aria-hidden="true"></i></a>';
                }
            }

            for (var i = 0; i < paths.length; i++) {

                path_parts.push(paths[i]);
                var path = path_parts.join('/');

                if (i == 0 && this.current_page === this.pages.share) {
                    $('<li/>')
                        .appendTo(breadcrumb)
                        .append(paths[i]);
                    continue;
                }

                if (i == paths.length - 2) {
                    up_button = get_link(path, path, '<i class="icon-up" aria-hidden="true"></i>');
                }

                $('<li/>')
                    .appendTo(breadcrumb)
                    .append(get_link(paths[i], path));
            }

            // Set the title and the browser title
            title.text(paths[paths.length - 1]);
            document.title = this.current_page.title + ' - ' + paths.join('/');

            if (up_button !== null) {
                title.append(up_button);
            } else if (paths.length == 1) {
                title.append(get_link(this.current_page.title, '', '<i class="icon-up" aria-hidden="true"></i>'));
            }

        } else {
            // Set the title and the browser title
            title.text(this.current_page.title);
            document.title = this.current_page.title
        }

        // Toggle between the buttons groups
        if (this.current_page === this.pages.projects && this.notebook_path === swan_projects_name) {
            $('.page-projects').show();
            $('.page-tree').hide();
        } else {
            $('.page-projects').hide();
            $('.page-tree').show();
        }

        /**
         * Construct the link added to the interface.
         * If clicked, instead of loading the full page, the javascript only loads the list of files.
         * @param title Title of the page (displayed in browser history and on the link if no html is provided)
         * @param path Relative path of the link, in relation to the base of the current tab
         * @param html Title/element to be shown
         * @returns {jQuery} Html a element
         */
        function get_link(title, path, html) {

            var url = utils.url_path_join(
                that.base_url,
                that.current_page.path,
                utils.encode_uri_components(path)
            );

            return $('<a href="' + url + '">' + (html ? html : title) + '</a>').click(function (e) {

                // Allow the default browser action when the user holds a modifier (e.g., Ctrl-Click)
                if(e.altKey || e.metaKey || e.shiftKey) {
                    return true;
                }

                window.history.pushState({
                    path: path
                }, title, url);
                that.update_swan_location(path);
                return false;
            });
        }

    }

    /**
     * Reload the new location.
     * Used to load the list of files dynamically.
     */
    child_notebook_list.prototype.update_swan_location = function (path) {

        if (this.current_page === this.pages.projects) {
            this.update_location(utils.url_path_join(swan_projects_name, path));
        } else if (this.current_page === this.pages.share) {
            this.update_location(utils.url_path_join(swan_share_root, path));
        } else {
            this.update_location(path);
        }
    }

    /*
        Util functions for sorting lists
        Brought as is from Jupyter code.
        It is needed because it does not belong to the object and there is no other way to access it.
     */

    var type_order = {'project': 0, 'directory': 1, 'notebook': 2, 'file': 3};

    var sort_functions = {
        'sort-name': name_sorter,
        'last-modified': modified_sorter,
        'file-size': size_sorter
    };

    function name_sorter(ascending) {
        return (function (a, b) {
            if (type_order[a['type']] < type_order[b['type']]) {
                return -1;
            }
            if (type_order[a['type']] > type_order[b['type']]) {
                return 1;
            }
            if (a['name'].toLowerCase() < b['name'].toLowerCase()) {
                return (ascending) ? -1 : 1;
            }
            if (a['name'].toLowerCase() > b['name'].toLowerCase()) {
                return (ascending) ? 1 : -1;
            }
            return 0;
        });
    };

    function modified_sorter(ascending) {
        var order = ascending ? 1 : 0;
        return (function (a, b) {
            return utils.datetime_sort_helper(a.last_modified, b.last_modified,
                order)
        });
    }

    function size_sorter(ascending) {
        // directories have file size of undefined
        return (function(a, b) {
          if (a.size === undefined) {
             return (ascending) ? -1 : 1;
          }
           if (b.size === undefined) {
             return (ascending) ? 1 : -1;
          }
           if (a.size > b.size) {
            return (ascending) ? -1 : 1;
          }
           if (b.size > a.size) {
            return (ascending) ? 1 : -1;
          }
           return 0;
        });
    }

    child_notebook_list.prototype.sort_list = function (id, order) {
        if (sort_functions.hasOwnProperty(id)) {
            this.sort_function = sort_functions[id](order);
            this.draw_notebook_list(this.model_list, this.error_msg);
        } else {
            console.error("No such sort id: '" + id + "'")
        }
    };

    return {'NotebookList': child_notebook_list};

});
