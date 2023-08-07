import $ from 'jquery';
import dialog from 'base/js/dialog';
import Jupyter from 'base/js/namespace';
import events from 'base/js/events';
import keyboard from 'base/js/keyboard';
import utils from 'base/js/utils';
import configmod from 'services/config';

import autocomplete from 'devbridge-autocomplete';
import InlineEdit from 'inline-edit-js';

import template_configuring from './templates/configuring.html'
import template_connected from './templates/connected.html'


/**
 * SparkConnector object constructor
 * @constructor
 */
function SparkConnector() {

    /**
     * States (pages) that the connector displays to the user, and their buttons
     */
    this.states = {
        auth: {
            get_html: $.proxy(this.get_html_auth, this),
            buttons: {
                'Authenticate': {
                    class: 'btn-success size-100 auth-button',
                    click: $.proxy(this.authenticate, this)
                }
            }
        },
        configuring: {
            get_html: $.proxy(this.get_html_configuring, this),
            buttons: {
                'Connect': {
                    class: 'btn-success size-100',
                    click: $.proxy(this.connect, this)
                }
            }
        },
        connecting: {
            get_html: $.proxy(this.get_html_connecting, this),
            hide_close: true,
            buttons: {
                'Cancel': {
                    class: 'btn-danger size-100',
                    click: $.proxy(this.back_to_config, this)
                }
            }
        },
        reconfigure: {
            get_html: $.proxy(this.get_html_reconfigure, this),
            hide_close: true,
            buttons: {
            }
        },
        connect_error: {
            get_html: $.proxy(this.get_html_connect_error, this),
            buttons: {
                'Go back to configuration': {
                    class: 'btn-primary size-100',
                    click: $.proxy(this.back_to_config, this)
                }
            }
        },
        connected: {
            get_html: $.proxy(this.get_html_connected, this),
            buttons: {
                'Go to the notebook': {
                    class: 'btn-primary size-50',
                },
                'Restart Spark session': {
                    class: 'btn-danger size-50',
                    click: $.proxy(this.back_to_config, this)
                },
            }
        }
    }

    console.log('SparkConnector start')

    this.comm = null;

    this.options = this.get_notebook_metadata();
    this.extra_options = {};
    this.spark_options = {};

    var that = this;
    var base_url = utils.get_body_data('baseUrl');
    var config_bundles = new configmod.ConfigSection('sparkconnector_bundles', {base_url: base_url});
    var config_spark_options = new configmod.ConfigSection('sparkconnector_spark_options', {base_url: base_url});
    config_bundles.load();
    config_spark_options.load();

    Promise.all([config_bundles, config_spark_options]).then(function(values) {

        values[0].loaded.then(function() {
            if (values[0].data.bundled_options) {
                console.log("SparkConnector: found bundles");

                that.extra_options = values[0].data.bundled_options;
            }
        });

        values[1].loaded.then(function() {
            if (values[1].data.spark_options) {
                console.log("SparkConnector: found spark_options");
                that.spark_options = values[1].data.spark_options;
            }
        });

        that.start_comm();

    }).catch(function(){
        console.warn("Error getting SparkConnector configs. Continuing without them.");
        that.start_comm();
    });

    events.on('kernel_connected.Kernel', $.proxy(this.start_comm, this));//Make sure there is always a comm when the kernel connects.
}

SparkConnector.prototype.filter_bundle_options = function (bundled_options) {
    var that = this;
    var filtered_options = {};
    $.each(bundled_options, function (name, data) {
        // Dont add bundle if currently selected cluster is filtered out
        if (data.cluster_filter && data.cluster_filter.length != 0 && !data.cluster_filter.includes(that.cluster)) {
            return;
        }

        // Dont add bundle if currently selected spark version is filtered out
        if (data.spark_version_filter && data.spark_version_filter.length != 0 && !data.spark_version_filter.includes(that.spark_version)) {
            return;
        }

        filtered_options[name] = data;
    });
    return filtered_options;
}

/**
 * Handler for messages received from the kernel
 * Messages can be an action or a page to show, which switched the current state
 * @param msg JSON message received
 */
SparkConnector.prototype.on_comm_msg = function (msg) {

    switch (msg.content.data.msgtype) {
        case 'sparkconn-action-open':
            this.enable();
            this.max_memory = parseInt(msg.content.data.maxmemory.replace('g', ''));
            this.cluster = msg.content.data.cluster;
            this.spark_version = msg.content.data.sparkversion;
            show_page(this, msg.content.data.page);
            break;
        case 'sparkconn-action-follow-log':
            this.connecting_logs.append(msg.content.data.msg);
            this.connecting_logs.scrollTop(this.connecting_logs.get(0).scrollHeight);
            break;
        case 'sparkconn-action-tail-log':
            this.connecting_logs.html(msg.content.data.msg);
            this.connecting_logs.scrollTop(this.connecting_logs.get(0).scrollHeight);
            break;
        default:
            var page = msg.content.data.msgtype;
            var config = msg.content.data.config;
            var error = msg.content.data.error;
            show_page(this, page, config, error);
            break;
    }

    function show_page(that, page, config, error) {
        switch (page) {
            case 'sparkconn-auth':
                that.switch_state(that.states.auth, config, error);
                break;
            case 'sparkconn-config':
                that.switch_state(that.states.configuring, config, error);
                break;
            case 'sparkconn-connected':
                that.switch_state(that.states.connected, config, error);
                break;
            case 'sparkconn-connect-error':
                that.switch_state(that.states.connect_error, config, error);
                break;
        }
    }
}

/**
 * Handler for message received when kernel shut down
 * @param msg
 */
SparkConnector.prototype.on_comm_close = function (msg) {

    console.log('SparkConnector: Comm closed', msg);

    this.toolbar_button.addClass('disabled');
    this.switch_state(this.states.configuring);
}

/**
 * When the kernel starts, start the communication with the it
 * Sends a test message and registers the handlers
 * Removes old communications channels that might be present (they shouldn't)
 */
SparkConnector.prototype.start_comm = function () {

    if (this.comm) {
        this.comm.close()
    }

    console.log('SparkConnector: Starting Comm with kernel')

    var that = this;

    if (Jupyter.notebook.kernel) {
        this.comm = Jupyter.notebook.kernel.comm_manager.new_comm('SparkConnector',
            {'msgtype': 'sparkconn-action-open'});
        this.comm.on_msg($.proxy(that.on_comm_msg, that));
        this.comm.on_close($.proxy(that.on_comm_close, that));
    } else {
        console.log("SparkConnector: No communication established, kernel null");
    }
}

/**
 * Send message to the kernel
 * @param msg Message in JSON format
 */
SparkConnector.prototype.send = function (msg) {
    this.comm.send(msg);
}

/**
 * Action for the restart spark session button
 * @returns {boolean} Returns false to prevent the modal box from closing
 */
SparkConnector.prototype.back_to_config = function () {
    var that = this;

    dialog.modal({
        notebook: Jupyter.notebook,
        keyboard_manager: Jupyter.keyboard_manager,
        title: 'Restarting Spark connection',
        body: 'This will reset your notebook state by restarting your notebook kernel. Do you wish to proceed?',
        buttons: {
            'No': {},
            'Restart kernel': {
                class: 'btn-danger size-100',
                click: restart_connection
            }
        }
    });

    function restart_connection() {
        that.send({
            action: 'sparkconn-action-disconnect',
        });

        // Switch to connect restart
        that.switch_state(that.states.reconfigure)

        // Failure of creating Spark Context needs to restart JVM due to Spark Context caching
        Jupyter.notebook.kernel.restart();
        that.modal.modal('hide');
    }

    return false;
}

/**
 * Action for the authentication button
 * Disables all the actions and send the password to the kernel for Kinit
 * @returns {boolean} Returns false to prevent the modal box from closing
 */
SparkConnector.prototype.authenticate = function () {

    console.log('SparkConnector: authenticating');

    var password_field = this.modal.find('.auth-button');
    password_field.attr('disabled', '');

    var password_field = this.modal.find('input[name="password"]');
    password_field.attr('disabled', '');

    this.send({
        action: 'sparkconn-action-auth',
        password: password_field.val()
    });

    return false;
}

/**
 * Action for the Connect button
 * Sends all options to the kernel, changes to the loading state and saves the options in the
 * notebook metadata
 * @returns {boolean} Returns false to prevent the modal box from closing
 */
SparkConnector.prototype.connect = function () {

    console.log('SparkConnector: Connecting');

    this.switch_state(this.states.connecting);
    this.save_notebook_metadata();

    var options = {};

    // Add user options
    $.each(this.options.list_of_options, function (i, option) {
        options[option.name] = option.value
    });

    // Add bundled options
    var that = this;
    $.each(this.options.bundled_options, function (i, bundle) {
        // Make sure bundle option from notebook metadata can be displayed in this environment
        if (!that.extra_options[bundle]) {
            return;
        }

        // For each bundle, loop over available options
        $.each(that.extra_options[bundle].options, function (i, option) {
            // Do not overwrite user options, add new or concatenate
            if (!(option.name in options)) {
                options[option.name] = option.value
            } else if ("concatenate" in option) {
                options[option.name] = options[option.name] + option.concatenate + option.value;
            }
        });
    });

    // Spawn spark session with available options
    this.send({
        action: 'sparkconn-action-connect',
        options: options
    });

    return false;
}

/**
 * Action for the Close button
 * If the changes are not saved, asks the user if he wants to save them
 */
SparkConnector.prototype.close = function () {

    if (!is_metadata_equal(this.options, this.get_notebook_metadata())) {
        dialog.modal({
            notebook: Jupyter.notebook,
            keyboard_manager: Jupyter.keyboard_manager,
            title: 'Unsaved changes',
            body: 'You made changes to the Spark connector configuration. Do you want to save them?',
            buttons: {
                'No': {},
                'Save': {
                    class: 'btn-success size-100',
                    click: $.proxy(this.save_notebook_metadata, this)
                }
            }
        });
    }

    // Compare two metadata config objects to see if they are equal
    function is_metadata_equal(first, second) {

        // If the number of bundle options are different, they are different
        if (first.bundled_options.length != second.bundled_options.length) {
            return false;
        }

        $.each(first.bundled_options, function (i, option) {
            if (!(option in second)) {
                return false;
            }
        });

        // If the number of user options are different, they are different
        if (first.list_of_options.length != second.list_of_options.length) {
            return false;
        }

        // Create associative arrays with the options of both objects to facilitate the comparison
        var options_first = {};
        var options_second = {};
        var first_properties = [];

        for (var i = 0; i < first.list_of_options.length; i++) {
            var option = first.list_of_options[i];
            options_first[option.name] = option.value;
            first_properties.push(option.name);
        }

        for (var i = 0; i < second.list_of_options.length; i++) {
            var option = second.list_of_options[i];
            options_second[option.name] = option.value;
        }

        // Check if options with the same name have the same value
        for (var i = 0; i < first_properties.length; i++) {
            var property = first_properties[i];
            if (options_first[property] !== options_second[property]) {
                return false;
            }
        }

        return true;
    }
}

/**
 * Enables the extension when the communication to the kernel is successful
 * By default, the toolbar button is visible but in disabled state
 */
SparkConnector.prototype.enable = function () {

    this.toolbar_button.removeClass('disabled');
    this.enabled = true;
}

//////////////////////////////////////////////////////////////

/**
 * Add a new button to the toolbar that opens the modal box
 * Adds css class and disables it
 */
SparkConnector.prototype.add_toolbar_button = function () {

    var action = {
        help: 'Spark clusters connection',
        help_index: 'zz', // Sorting Order in keyboard shortcut dialog
        handler: $.proxy(this.open_modal, this)
    };

    var prefix = 'SparkConnector';
    var action_name = 'show-sparkcluster-conf';

    var full_action_name = Jupyter.actions.register(action, action_name, prefix);
    this.toolbar_button = Jupyter.toolbar.add_buttons_group([full_action_name]).find('.btn');
    this.toolbar_button.addClass('disabled spark-icon');
    this.enabled = false;
}

/**
 * Action for the toolbar button
 * Show the modal box and show the current state
 * Only execute if it is enable, otherwise clicking button, even if disabled, will show the modal
 */
SparkConnector.prototype.open_modal = function () {

    if (this.enabled && !(this.modal && this.modal.data('bs.modal') && this.modal.data('bs.modal').isShown)) {
        var that = this;

        this.modal = dialog.modal({
            show: false,
            draggable: false,
            notebook: Jupyter.notebook,
            keyboard_manager: Jupyter.keyboard_manager,
            title: 'Spark clusters connection',
        }).attr('id', 'sparkclusters-modal').addClass('right');


        this.modal.click(function(e) {
            // Close modal on click outside of connector area when in not "hide_close" state
            if ($(e.target).is("div") && !$(e.target).closest('.modal-dialog').length && !that.state.hide_close) {
                that.modal.modal('hide');
            }
        });

        this.modal.on('shown.bs.modal', function () {
            that.modal.find("input").first().focus();
        });

        this.modal.on('show.bs.modal', function () {

            that.switch_state(that.state, that.state_config, that.state_error);

        }).modal('show');
        this.modal.find(".modal-header").unbind("mousedown");

        this.modal.on('hide.bs.modal', function () {
            that.close();
        });
    }
}

/**
 * Generates the HTML corresponding to the "auth" state of this Spark connector.
 * In this state the user has to input the password to generate a kerberos ticket.
 * @param error Error message received upon authentication failed
 */
SparkConnector.prototype.get_html_auth = function (config, error) {

    var that = this;
    var html = this.modal.find('.modal-body');

    if (error) {
        $('<div/>')
            .addClass('alert alert-dismissable alert-danger')
            .append(
                $('<button class="close" type="button" data-dismiss="alert" aria-label="Close"/>')
                    .append($('<span aria-hidden="true"/>').html('&times;'))
            ).append($('<p/>').text(error))
            .appendTo(html);
    }

    $('<p>Before connecting to the cluster, we need to obtain a Kerberos ticket.<br>Please enter your account password.</p><p>&nbsp;</p>')
        .appendTo(html);

    $('<input/>')
        .addClass('form-control')
        .attr('name', 'password')
        .attr('type', 'password')
        .appendTo(html)
        .keypress(function (e) {
            if (e.which == keyboard.keycodes.enter) {
                that.states.auth.buttons.Authenticate.click();
            }
        });
}

/**
 * Generates the HTML corresponding to the "configuring" state of this Spark connector.
 * In this state the user can configure the options that will be added to SparkConf.
 * @param error Error message received upon connection failed
 */
SparkConnector.prototype.get_html_configuring = function (config, error) {

    this.options = this.get_notebook_metadata();

    var that = this;
    var list_elements = [];

    var html = this.modal.find('.modal-body');

    if (error) {
        $('<div/>')
            .addClass('alert alert-dismissable alert-danger')
            .append(
                $('<button class="close" type="button" data-dismiss="alert" aria-label="Close"/>')
                    .append($('<span aria-hidden="true"/>').html('&times;'))
                ).append($('<p/>').text(error.msg))
            .appendTo(html);
    }

    html.append(template_configuring.replace('{cluster_name}', this.cluster));

    var new_option = html.find('.new-option');
    var bundled_options = html.find('#bundled-options');
    var options_list = html.find('.spark-options');

    // Filter bundle options
    this.extra_options = this.filter_bundle_options(this.extra_options);

    // Add the bundle options to the panel
    $.each(this.extra_options, function (name, data) {
        // Add bundle checkbox and action to show options on checkbox click
        $('<div><input type="checkbox" ' + (that.options.bundled_options.includes(name) ? 'checked' : '') + '> Include ' + name + ' options</div>')
            .appendTo(bundled_options)
            .find('input')
            .on('click', function () {
                // on select, add/remove bundle to/from the metadata
                if (that.options.bundled_options.includes(name)) {
                    that.options.bundled_options.splice(that.options.bundled_options.indexOf(name), 1);
                    hide_bundle_option(name);
                } else {
                    that.options.bundled_options.push(name);
                    show_bundle_option(name);
                }
            });
    });

    if (!this.extra_options) {
        html.find('#bundled-options').hide();
    }

    // Show the first step of adding an option
    choose_option_name();
    // Add the options saved in the notebook metadata
    fill_options();
    // Hightligh all the errors that might exist
    highlight_errors();

    /**
     * Display the first input, where users enter the name of the option.
     * If the are in step 2 (choosing the value) and decide to change the option name,
     * this function gets called with the old name as key
     * @param key Value to display inside the input form
     */
    function choose_option_name(key) {

        new_option.empty();

        $('<label for="add_new">Add a new option</label><br>')
            .appendTo(new_option);

        var input = $('<input/>')
            .addClass('form-control')
            .attr('name', 'add_new')
            .attr('type', 'text')
            .attr('value', key)
            .attr('placeholder', 'Write the option name...')
            .appendTo(new_option)
            .focus()
            .devbridgeAutocomplete({
                minChars: 1,
                lookup: that.spark_options,
                groupBy: 'category',
                triggerSelectOnValidInput: false,
                onSelect: function () {
                    choose_option_value(input.val());
                }
            })
            .keydown(function (e) {
                if (e.keyCode == keyboard.keycodes.enter && input.val() !== "") {
                    choose_option_value(input.val());
                }
            });
    };

    /**
     * Display the input where users can enter the value of the option.
     * The option name is shown above the input.
     * @param option_name Name of the option
     */
    function choose_option_value(option_name) {

        new_option.empty();

        $('<label>')
            .addClass('option')
            .attr('for', 'add_new')
            .html(' ' + option_name)
            .appendTo(new_option)
            .on('click', function () {
                choose_option_name(option_name);
            })
            .prepend('<i class="fa fa-pencil" aria-hidden="true"> ')
            .prepend('<i class="fa fa-cog" aria-hidden="true">')
            .append('<br>');

        var input = $('<input/>')
            .addClass('form-control')
            .attr('name', 'add_new')
            .attr('type', 'text')
            .attr('placeholder', 'Write the option value... ')
            .appendTo(new_option)
            .focus()
            .keydown(function (e) {
                if (e.keyCode == keyboard.keycodes.enter && input.val() !== "") {

                    var option = {
                        name: option_name,
                        value: input.val()
                    }
                    that.options.list_of_options.push(option);
                    show_option(option);
                    highlight_errors();
                    choose_option_name();
                }
            });

    };

    /**
     * Add an option to the list of options
     * @param option Object with name and value of the option being added
     */
    function show_option(option) {

        var entry = $('<li>')
            .addClass('editable')
            .append('<i class="fa fa-pencil" aria-hidden="true">')
            .append('<i class="fa fa-cog" aria-hidden="true">')
            .append('<i class="fa fa-exclamation-circle" aria-hidden="true">');

        var errors = get_errors(option);

        var elem = {option: option, entry: entry, errors: errors};
        list_elements.push(elem);

        var pair = $('<ul>')
            .appendTo(entry);

        var elem_key = $('<li>')
            .addClass('option')
            .html(option.name)
            .appendTo(pair);

        var elem_value = $('<li>')
            .html(option.value)
            .appendTo(pair);

        $('<span class="remove">×</span>')
            .appendTo(entry)
            .on('click', function () {
                entry.remove();
                that.options.list_of_options.splice(that.options.list_of_options.indexOf(option), 1);
                list_elements.splice(list_elements.indexOf(elem), 1);
                highlight_errors();
            });

        options_list.prepend(entry);

        // Add the ability to edit the options names and values inline...
        // And add the option to click "enter" to save

        var editing_element_name = document.createElement('input');

        $(editing_element_name).keydown(function (e) {
            if (e.keyCode == keyboard.keycodes.enter) {
                $(this).blur();
            }
        });

        new InlineEdit(elem_key.get(0), {
            onChange: function (newValue, oldValue) {
                if (newValue === "") {
                    elem_key.html(oldValue);
                } else {
                    option.name = newValue;
                    elem.errors = get_errors(option);
                    highlight_errors();
                }
            },
            editingElement: editing_element_name
        });

        var editing_element_value = document.createElement('input');

        $(editing_element_value).keydown(function (e) {
            if (e.keyCode == keyboard.keycodes.enter) {
                $(this).blur();
            }
        });

        new InlineEdit(elem_value.get(0), {
            onChange: function (newValue, oldValue) {
                if (newValue === "") {
                    elem_value.html(oldValue);
                } else {
                    option.value = newValue;
                    elem.errors = get_errors(option);
                    highlight_errors();
                }
            },
            editingElement: editing_element_value
        });
    }

    /**
     * Get the list of static errors that adding the given option produces.
     * These include using greater memory than the one available,
     * or overwriting the default connection values.
     * @param option Object with name and value of the option being added
     * @returns {Array} Array of error messages to display
     */
    function get_errors(option) {

        var errors = [];

        if (option.name === 'spark.driver.memory' &&
            option.value.replace('g', '') > that.max_memory) {

            errors.push('Memory exceeds the container memory');
        }

        if (option.name === 'spark.driver.host' ||
            option.name === 'spark.driver.port' ||
            option.name === 'spark.blockManager.port' ||
            option.name === 'spark.ui.port' ||
            option.name === 'spark.master' ||
            option.name === 'spark.authenticate' ||
            option.name === 'spark.network.crypto.enabled' ||
            option.name === 'spark.authenticate.enableSaslEncryption') {

            errors.push('Redefining a SWAN configuration');
        }
        return errors;
    }

    /**
     * Display the errors in the interface, and checks if there are duplicated
     * options or options that are already present in the selected bundles.
     */
    function highlight_errors() {

        var uniq = that.options.list_of_options
            .map((elem) => {
                return {count: 1, name: elem.name}
            })
            .reduce((a, b) => {
                a[b.name] = (a[b.name] || 0) + b.count
                return a
            }, {});

        var keys = Object.keys(uniq);
        var duplicates = keys.filter((a) => uniq[a] > 1)

        var duplicates_bundles = [];
        $.each(that.options.bundled_options, function (i, bundle) {
            // Ignore metadata entries that are not supported
            if (!that.extra_options[bundle]) {
                return;
            }

            $.each(that.extra_options[bundle].options, function (i, option) {
                if (!("concatenate" in option)
                    && keys.some(key => key === option.name)
                    && !(option.name in duplicates_bundles)) {
                    duplicates_bundles.push(option.name)
                }
            });
        });

        $.each(list_elements, function (i, elem) {
            var elem_errors = elem.errors.slice(0);

            if (duplicates.includes(elem.option.name)) {
                elem_errors.push("Option duplicated");
            }

            if (duplicates_bundles.includes(elem.option.name)) {
                elem_errors.push("Option redefined by bundle");
            }

            if (elem_errors.length > 0) {
                elem.entry
                    .addClass('warning')
                    .attr('title', elem_errors.join('\n'));
            } else {
                elem.entry
                    .removeClass('warning')
                    .removeAttr('title');
            }
        });
    }

    /**
     * Add the values from the metadata to the interface
     */
    function fill_options() {
        $.each(that.options.list_of_options, function (i, option) {
            show_option(option);
        });
        $.each(that.options.bundled_options, function (i, option) {
            show_bundle_option(option);
        });
        highlight_errors();
    }

    /**
     * Display the bundle individual options
     * @param option Name of the bundle
     */
    function show_bundle_option(bundle) {
        // Make sure bundle option from notebook metadata can be displayed in this environment
        if (!that.extra_options[bundle]) {
            return;
        }

        var entry = $('<li>')
            .addClass('bundle')
            .addClass('bundle_' + bundle)
            .append('<i class="fa fa-cogs" aria-hidden="true">')
            .appendTo(options_list);

        var pair = $('<ul>')
            .appendTo(entry);

        $('<li>')
            .addClass('option')
            .html(bundle)
            .appendTo(pair);

        $.each(that.extra_options[bundle].options, function (i, value) {
            var elem_value = $('<li>')
                .append('<i class="fa fa-cog" aria-hidden="true">')
                .appendTo(pair);

            var list_values = $('<ul>')
                .appendTo(elem_value);

            list_values.append('<li>' + value.name + '</li><li>' + value.value + '</li>')
        });
    }

    /**
     * Remove the bundle individual options from the interface
     * @param option Name of the bundle
     */
    function hide_bundle_option(option) {
        html.find('.bundle_' + option).remove();
    }
}

/**
 * Generates the HTML corresponding to the "restart kernel and session" state of Spark connector.
 */
SparkConnector.prototype.get_html_reconfigure = function (config, error) {
    var html = this.modal.find('.modal-body');
    var buttons = this.modal.find('.modal-footer');

    // Display context restart
    var loading = $('<div>')
        .addClass('loading')
        .appendTo(html);

    var wrapper = $('<div>')
        .addClass('wrapper')
        .appendTo(loading);

    $('<div>')
        .addClass('spin')
        .append('<i class="icon-clockwise fa fa-spin"></i>')
        .appendTo(wrapper);

    wrapper.append('Stopping Spark Context.<br>This may take a while...');
}


/**
 * Generates the HTML corresponding to the state of the Spark connector when starting up spark context has failed
 */
SparkConnector.prototype.get_html_connect_error = function (config, error) {

    var html = this.modal.find('.modal-body');

    // Display error
    $('<div/>')
        .addClass('alert alert-danger connect-error')
        .append(
            $('<p/>').addClass("header").text('Error while connecting to Spark cluster')
        )
        .append(
            $('<p/>').text(error)
        )
        .appendTo(html);

    var that = this;
    var logs_wrapper = $('<div>')
        .addClass('log-connect-error')
        .appendTo(html);

    logs_wrapper
        .append($('<p/>').text("These are the logs of the failed application."))
        .append(this.connecting_logs)

    this.connecting_logs.show()
}


/**
 * Generates the HTML corresponding to the "connecting" state of this Spark connector.
 * In this state the logs are displayed, while the connection is ongoing.
 */
SparkConnector.prototype.get_html_connecting = function (config, error) {

    var html = this.modal.find('.modal-body');

    var loading = $('<div>')
        .addClass('loading')
        .appendTo(html);

    var wrapper = $('<div>')
        .addClass('wrapper')
        .appendTo(loading);

    $('<div>')
        .addClass('spin')
        .append('<i class="icon-clockwise fa fa-spin"></i>')
        .appendTo(wrapper);

    wrapper.append('Trying to connect to the selected Spark cluster.<br>This may take a while...');

    var logs_wrapper = $('<div>')
        .addClass('log-connecting')
        .appendTo(html);

    this.connecting_logs = $('<pre>')
        .addClass('logs')
        .appendTo(logs_wrapper);
}

/**
 * Generates the HTML corresponding to the "connected" state of this Spark connector.
 * In this state the user is informed that everything is ok and that it is connected.
 */
SparkConnector.prototype.get_html_connected = function (config, error) {

    var html = this.modal.find('.modal-body');
    var that = this;

    var template = template_connected
        .replace('{spark_version}', that.spark_version)
        .replace('{cluster_name}', that.cluster);
    html.html(template);

    if (config && config.sparkmetrics) {
        var metricsURL = $('<a>').attr('href', config.sparkmetrics).attr('target','_blank').text('here')
        html.find('.success-metrics-text')
            .text('Spark Metrics Dashboard is available ')
            .append(metricsURL)
    }

    if (config && config.sparkwebui) {
        var webuiURL = $('<a>').attr('href', config.sparkwebui).attr('target','_blank').text('here')
        html.find('.success-history-text')
            .text('Spark WebUI is available ')
            .append(webuiURL)
    }

    html.find('.success-show-logs-action')
        .attr('href', 'javascript:')
        .text('show/hide')
        .on('click', function () {
            that.send({
                action: 'sparkconn-action-getlogs'
            });
            that.connecting_logs.toggle();
        });

    this.connecting_logs = html.find('.logs');
    this.connecting_logs.hide()
}

/**
 * Shows the specified state to the user
 * Clears the previous state and sets the buttons
 * @param new_state State to display
 * @param config Config of state to use (depends on the state)
 * @param error Error message to display (depends on the state)
 */
SparkConnector.prototype.switch_state = function (new_state, config, error) {
    this.state = new_state;
    this.state_config = config;
    this.state_error = error;

    if (this.modal) {
        Jupyter.keyboard_manager.disable()
        var header = this.modal.find('.modal-header');
        var body = this.modal.find('.modal-body');
        var footer = this.modal.find('.modal-footer');

        body.html('');
        footer.html('');

        new_state.get_html(config, error);

        $.each(new_state.buttons, function (name, options) {
            $('<button>')
                .addClass('btn btn-default btn-sm')
                .addClass(options.class)
                .attr('data-dismiss', 'modal')
                .on('click', options.click)
                .text(name)
                .appendTo(footer);
        });

        if (new_state.hide_close) {
            header.find('.close').hide();
        } else {
            header.find('.close').show();
        }
    }
}

//////////////////////////////////////////////////////////////

/**
 * Retrieves the connector related options stored in the notebook metadata
 * @returns {*} Options list
 */
SparkConnector.prototype.get_notebook_metadata = function () {

    var to_return = {
        list_of_options: [],
        bundled_options: []
    };

    if (Jupyter.notebook.metadata &&
        Jupyter.notebook.metadata.sparkconnect) {

        console.log("SparkConnector retrieve configs")

        //Clone the metadata so that users can recover the old configs if they choose not to save
        to_return = $.extend(true, to_return, Jupyter.notebook.metadata.sparkconnect);
    }

    return to_return;
}

/**
 * Store the options in the notebook metadata
 */
SparkConnector.prototype.save_notebook_metadata = function () {

    var sparkconnect_metadata = $.extend(true, {}, this.options);

    console.log("SparkConnector save configs")

    var metadata = Jupyter.notebook.metadata;
    metadata.sparkconnect = sparkconnect_metadata;
    Jupyter.notebook.metadata = metadata;
    Jupyter.notebook.save_checkpoint();
}

/**
 * Load Jupyter extension
 */
function load_ipython_extension() {

    var conn = new SparkConnector();
    conn.add_toolbar_button();
}

export {load_ipython_extension}
