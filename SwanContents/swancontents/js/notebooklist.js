define([
    'jquery',
    'require',
    'base/js/namespace',
    'tree/js/notebooklist',
    'base/js/dialog',
    'base/js/utils',
    'base/js/events'
], function ($, require, Jupyter, notebook_list, dialog, utils, events) {

    /**
     * Extends Jupyter notebooklist lib to cope with the new filemanager and handlers
     * Add "Project" as a new type of object and override some of it functions
     */

    var parent_notebook_list = notebook_list.NotebookList;
    var child_notebook_list = function (selector, options) {
        parent_notebook_list.call(this, selector, options);

        if (window.location.pathname.startsWith(this.base_url + 'projects')) {
            this.current_page = 'projects';
        } else if (window.location.pathname.startsWith(this.base_url + 'share')) {
            this.current_page = 'share';
        } else {
            this.current_page = 'cernbox';
        }

        $('.notebook_list.collapse ').on('shown.bs.collapse', function () {
            $(this).parent().find('h1 i, h2 i').removeClass('icon-expand').addClass('icon-collapse');
        });

        $('.notebook_list.collapse ').on('hidden.bs.collapse', function () {
            $(this).parent().find('h1 i, h2 i').removeClass('icon-collapse').addClass('icon-expand');
        });

        parent_notebook_list.icons.project = 'project_icon';
        parent_notebook_list.uri_prefixes.project = this.current_page;
        parent_notebook_list.uri_prefixes.directory = this.current_page;

    }
    child_notebook_list.prototype = Object.create(parent_notebook_list.prototype);

    var type_order = {'project':0,'directory':1,'notebook':2,'file':3};
    child_notebook_list.prototype.draw_notebook_list = function (list, error_msg) {

        // Remember what was selected before the refresh.
        var selected_before = this.selected;

        list.content.sort(function(a, b) {
            if (type_order[a['type']] < type_order[b['type']]) {
                return -1;
            }
            if (type_order[a['type']] > type_order[b['type']]) {
                return 1;
            }
            if (a['name'].toLowerCase() < b['name'].toLowerCase()) {
                return -1;
            }
            if (a['name'].toLowerCase() > b['name'].toLowerCase()) {
                return 1;
            }
            return 0;
        });
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
        var is_project_view = window.location.pathname == this.base_url + 'projects';

        item = null;
        for (var i=0; i<len; i++) {
            model = list.content[i];
            if(!is_project_view || model.type == 'project') {
                item = this.new_item_swan(i+offset, true);
                try {
                    this.add_link(model, item);
                } catch(err) {
                    console.log('Error adding link: ' + err);
                }
            }
        }

        if(len !== 0 && item === null) {
            item = this.new_item_swan(0);
            var span12 = item.first();
            span12.empty();
            span12.append($('<div style="margin:auto;text-align:center;color:grey"/>').text('No Projects'));
        }

        // Trigger an event when we've finished drawing the notebook list.
        events.trigger('draw_notebook_list.NotebookList');

        // Reselect the items that were selected before.  Notify listeners
        // that the selected items may have changed.  O(n^2) operation.
        selected_before.forEach(function(item) {
            var list_items = $('.list_item');
            for (var i=0; i<list_items.length; i++) {
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

        var share_button = $('#share-project-button');

        if(list.type === 'project') {
            show_share_button(list.path);
        } else if (list.type === 'directory' && list.project) {
            show_share_button(list.project);
        }

        function show_share_button(project){

            share_button.unbind();
            share_button.on('click', function () {
                require(['nbextensions/swanshare/extension'], function (share) {
                    share.share_button_click(project);
                }, function (err) {
                    console.log('Failure while loading swanshare lib');
                });
            });

            share_button.show();
        }
    };

    child_notebook_list.prototype.add_link = function (model, item) {

        var path = model.path,
            name = model.name,
            modified = model.last_modified;

        var running = (model.type === 'notebook' && this.sessions[path] !== undefined);

        item.data('name', name);
        item.data('path', path);
        item.data('modified', modified);
        item.data('type', model.type);
        item.find(".item_name").text(name);
        item.find(".item_name").attr('title', name);
        var icon = parent_notebook_list.icons[model.type];
        if (running) {
            icon = 'running_' + icon;
        }
        var uri_prefix = parent_notebook_list.uri_prefixes[model.type];
        if (model.type === 'file'
            && !this._is_editable(path)) {
            uri_prefix = 'view';
        }

        item.find(".item_icon").addClass(icon).addClass('icon-fixed-width');

        var url_path = path;
        if(this.current_page == 'projects' && (model.type === 'directory' || model.type === 'project')) {
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

        if(running) {
            item.find(".running-indicator").show();
        } else {
            item.find(".running-indicator").hide();
        }

        // directory nav doesn't open new tabs
        // files, notebooks do
        if (model.type !== "directory" && model.type !== "project") {
            link.attr('target', IPython._target);
        }

        // Add in the date that the file was last modified
        item.find(".item_modified").text(utils.format_datetime(modified));
        item.find(".item_modified").attr("title", moment(modified).format("YYYY-MM-DD HH:mm"));
    };

    /**
     * Add "New Project" button and change the sort icons displayed so that only one is displayed at a time
     */
    child_notebook_list.prototype.bind_events = function () {
        parent_notebook_list.prototype.bind_events.call(this);

        if(this.element_name === 'notebook') {

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
                        }
                    });
                    modal.find(".modal-header").unbind( "mousedown" );

                    function create_new_project() {

                        modal.find('.btn').prop('disabled', true);
                        modal.data('bs.modal').isShown = false;

                        var proj_name = modal.find('input[name="proj_name"]').val();

                        if(proj_name === '') {
                            that.contents.new_untitled((that.notebook_path || ''), {type: 'project'})
                                .then(function (result) {
                                    create_new_project_success(result.path);
                                }).catch(function (e) {
                                create_new_project_error('Error creating project: ' + (e.message || e));
                                console.warn('Error during New project creation', e);
                            });
                        } else {

                            that.contents.get((that.notebook_path || '') + '/' + proj_name, {type: 'directory'})
                                .then(function () {
                                    create_new_project_error('Cannot create project. Directory/Project already exist.');
                                }).catch(function (e) {

                                that.contents.new(((that.notebook_path || '') + '/' + proj_name), {type: 'project'})
                                    .then(function (result) {
                                        create_new_project_success(result.path);
                                    }).catch(function (e) {

                                    create_new_project_error('Error creating project: ' + (e.message || e));
                                    console.warn('Error during New project creation', e);
                                });

                            });
                        }
                        that.load_sessions();
                    }

                    function create_new_project_success(path) {
                        modal.data('bs.modal').isShown = true;
                        modal.modal('hide');
                        gtag('event', 'projects_created');
                        window.location.replace(that.base_url + path.replace('SWAN_projects/', 'projects/'));
                    }

                    function create_new_project_error(message) {

                        var alert = $('<div/>')
                            .addClass('alert alert-dismissable')
                            .addClass('alert-danger')
                            .append(
                                $('<button class="close" type="button" data-dismiss="alert" aria-label="Close"/>')
                                    .append($('<span aria-hidden="true"/>').html('&times;'))
                            )
                            .hide()
                            .append(
                                $('<p/>').text(message)
                            );

                        modal.find('.modal-body').prepend(alert);
                        alert.slideDown('fast');

                        modal.find('.btn').prop('disabled', false);
                        modal.data('bs.modal').isShown = true;


                        alert.fadeTo(4000, 500).slideUp(500, function () {
                            alert.slideUp(500);
                        });
                        gtag('event', 'projects_error');
                    }

                    gtag('event', 'projects_click_new');

                    return false;
                });

            $('.sort-action').unbind();
            $('.sort-action').click(function(e) {
                var sort_on = e.target.id;

                if (that.sort_state.sort_on == 0) {
                    that.sort_list(sort_on, 1);
                    $("#" + sort_on + " i").removeClass("fa-sort-desc").addClass("fa-sort-asc");
                    that.sort_state.sort_on = 1;
                } else {
                    that.sort_list(sort_on, 2);
                    $("#" + sort_on + " i").removeClass("fa-sort-asc").addClass("fa-sort-desc");
                    that.sort_state.sort_on = 0;
                }

                $(sort_on === 'last-modified' ? "#sort-name i" : "#last-modified i").hide();
                $("#" + sort_on + " i").show();
            });
        }
    };

    /**
     * New line design
     */
    child_notebook_list.prototype.new_item_swan = function (index, selectable) {

        var row = $('<div/>')
            .addClass("list_item")
            .addClass("row");

        var name_column = $('<div/>')
            .addClass("col-md-5")
            .addClass("col-xs-9")
            .appendTo(row);

        var actions_column = $('<div/>')
            .addClass("col-md-4")
            .addClass("hidden-xs")
            .append('<ul class="actions">')
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
            row.click(function(e) {
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

    child_notebook_list.prototype._selection_changed = function(shift_key) {
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

        if(shift_key){
            var selection = $('.list_item :checked');
            if(selection.length === 2) {
                var list_items = $('.list_item input');
                list_items.slice(list_items.index(selection.get(0)), list_items.index(selection.get(1))).prop('checked', 'checked');
            }
        }

        $('.list_item.selected').removeClass("selected");

        $('.list_item :checked').each(function(index, item) {
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

        // Download is only visible when one item is selected, and it is not a
        // running notebook or a directory
        // TODO(nhdaly): Add support for download multiple items at once.
        if (selected.length === 1 && !has_running_notebook && !has_directory) {
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
        if (selected.length == 1 && !has_directory && selected.every(function(el) {
                return that._is_editable(el.path) && ! that._is_notebook(el.path);
            })) {
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
        if (selected.length == 1 && !has_directory && selected.find(function(el) {
                return !that._is_editable(el.path)
                    && !that._is_not_editable(el.path)
                    && !that._is_notebook(el.path);
            })) {
            $('.edit-button').css('display', 'inline-block');
        } else {
            $('.edit-button').css('display', 'none');
        }

        // If all of the items are selected, show the selector as checked.  If
        // some of the items are selected, show it as checked.  Otherwise,
        // uncheck it.
        var total = 0;
        $('.list_item input[type=checkbox]').each(function(index, item) {
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
        // Update total counter
        $('#counter-select-all').html(checked===0 ? '&nbsp;' : checked);

        // If at aleast on item is selected, hide the selection instructions.
        if (checked > 0) {
            $('.dynamic-instructions').hide();
        } else {
            $('.dynamic-instructions').show();
        }
    };

    return {'NotebookList': child_notebook_list};

});