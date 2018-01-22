import $ from 'jquery';
import dialog from 'base/js/dialog';
import Jupyter from 'base/js/namespace';
import events from 'base/js/events';
import extra_options from './extra_options.json'


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
                    click: $.proxy(this.cancel, this)
                }
            }
        },
        connected: {
            get_html: $.proxy(this.get_html_connected, this),
            buttons: {
                'Go to the notebook': {
                    class: 'btn-primary size-100',
                }
            }
        }
    }

    this.comm = null;
    this.list_of_extrajavaoptions = [];
    this.list_of_jars = [];
    this.list_of_options = [];
    this.include_nxcals_options = false;

    var saved_options = this.get_notebook_metadata();

    // If metadata about the connection is saved in the notebook, retrieve it
    if (Object.keys(saved_options).length > 0) {

        this.list_of_extrajavaoptions = saved_options.list_of_extrajavaoptions || [];
        this.list_of_jars = saved_options.list_of_jars || [];
        this.list_of_options = saved_options.list_of_options || [];
        this.include_nxcals_options = saved_options.include_nxcals_options || false;
    }

    this.start_comm();
    events.on('kernel_connected.Kernel', $.proxy(this.start_comm, this));//Make sure there is always a comm when the kernel connects.
}

/**
 * Handler for messages received from the kernel
 * Messages can be an action or a page to show, which switched the current state
 * @param msg JSON message received
 */
SparkConnector.prototype.on_comm_msg = function (msg) {

    console.log('SparkConnector: Message received', msg);

    switch (msg.content.data.msgtype) {
        case 'sparkconn-action-open':
            this.enable();
            this.max_memory = parseInt(msg.content.data.maxmemory.replace('g', ''));
            this.cluster = msg.content.data.cluster;
            show_page(this, msg.content.data.page);
            break;
        case 'sparkconn-action-log':
            this.connecting_logs.append(msg.content.data.msg + "\n\n");
            this.connecting_logs.scrollTop(this.connecting_logs.get(0).scrollHeight);
            break;
        default:
            show_page(this, msg.content.data.msgtype, msg.content.data.error);
            if(msg.content.data.error) {
                gtag('event', 'spark_connector_error');
            }
            break;
    }

    function show_page(that, page, error) {

        switch (page) {
            case 'sparkconn-auth':
                that.switch_state(that.states.auth, error);
                break;
            case 'sparkconn-config':
                that.switch_state(that.states.configuring, error);
                gtag('event', 'spark_connector_config');
                break;
            case 'sparkconn-connected':
                that.switch_state(that.states.connected);
                gtag('event', 'spark_connector_connected');
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

    var memory = this.modal.find('input[name="memory"]').val();

    this.send({
        action: 'sparkconn-action-connect',
        memory: memory,
        extrajavaoptions: this.include_nxcals_options ? this.list_of_extrajavaoptions.concat(extra_options.nxcals_extraopts) : this.list_of_extrajavaoptions,
        jars: this.include_nxcals_options ? this.list_of_jars.concat(extra_options.nxcals_jars) : this.list_of_jars,
        options: this.list_of_options
    });

    return false;
}

/**
 * Action for the Cancel button
 * Ensures that the user knows that canceling means restarting the kernel, and then restarts it
 * @returns {boolean} Returns false to prevent the modal box from closing before confirmation
 */
SparkConnector.prototype.cancel = function () {

    var that = this;

    dialog.modal({
        notebook: Jupyter.notebook,
        keyboard_manager: Jupyter.keyboard_manager,
        title: 'Cancel connection',
        body: 'Canceling the connection will restart your kernel. Do you wish to proceed?',
        buttons: {
            'No': {},
            'Restart kernel': {
                class: 'btn-danger size-100',
                click: cancel_connection
            }
        }
    });

    function cancel_connection() {
        Jupyter.notebook.kernel.restart();
        that.modal.modal('hide');
    }

    return false;
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
        help: 'Spark Clusters connection',
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

    gtag('event', 'spark_connector_click');

    if (this.enabled && !(this.modal && this.modal.data('bs.modal') && this.modal.data('bs.modal').isShown)) {
        var that = this;

        this.modal = dialog.modal({
            show: false,
            draggable: false,
            notebook: Jupyter.notebook,
            keyboard_manager: Jupyter.keyboard_manager,
            title: 'Spark Clusters connection',
        }).attr('id', 'sparkclusters-modal').addClass('right');

        this.modal.on('shown.bs.modal', function () {
            that.modal.find("input").first().focus();
            gtag('event', 'spark_connector_show_modal');
        });

        this.modal.on('show.bs.modal', function () {

            that.switch_state(that.state);

        }).modal('show');
        this.modal.find(".modal-header").unbind("mousedown");
    }
}

/**
 * Html for auth state
 * @param error Error message received upon authentication failed
 */
SparkConnector.prototype.get_html_auth = function (error) {

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
            if (e.which == 13) {
                that.states.auth.buttons.Authenticate.click();
            }
        });
}

/**
 * Html for configuring state
 * @param error Error message received upon connection failed
 */
SparkConnector.prototype.get_html_configuring = function (error) {

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

    $('<p>This allows you to connect to CERN IT Spark Clusters.</p>')
        .appendTo(html);

    $('<p>You are going to connect to:<br><span class="cluster-name">' + this.cluster + '</span></p><p>&nbsp;</p>')
        .appendTo(html);

    $('<p>You can configure the following <a href="https://spark.apache.org/docs/latest/configuration.html#available-properties" target="_blank" title="SparkConf options">options</a>:</p>')
        .appendTo(html);

    $('<br><label for="memory">spark.driver.memory</label><br>')
        .appendTo(html);

    $('<input/>')
        .addClass('form-control')
        .attr('name', 'memory')
        .attr('type', 'number')
        .attr('min', 1)
        .attr('max', this.max_memory)
        .attr('value', 1)
        .appendTo(html)
        .on('input', function () {
            if ($(this).val() !== '' && ($(this).val() < 1 || $(this).val() > that.max_memory)) {
                $(this).val(that.max_memory);
            }
        });

    get_special_block(this.list_of_extrajavaoptions, 'extrajavaoptions', 'spark.driver.extraJavaOptions', 'e.g. -Opt.A=a   -Opt.B=b', 'fa-cog');

    get_special_block(this.list_of_jars, 'jars', 'spark.jars', 'e.g. path/to/my/file.jar   path/to/my/file2.jar', 'fa-cube');

    get_special_block(this.list_of_options, 'options', 'Other options', 'e.g. opt.a=&quot;a&quot;   opt.file=os.environ[\'b\']+&quot;/file.py&quot;', 'fa-cogs');

    $('<br><label for="include_nxcals">Bundled configurations</label><br>')
        .appendTo(html);
    $('<div><input type="checkbox" name="include_nxcals" ' + (this.include_nxcals_options ? 'checked' : '') + '> Include NXCALS options</div>')
        .appendTo(html)
        .find('input').on('click', function () {
        if (that.include_nxcals_options) {
            hide_nxcals_options();
        } else {
            show_nxcals_options();
        }
    });

    if (that.include_nxcals_options) {
        show_nxcals_options();
    }

    var lists = html.find('.list-wrapper');
    lists.each(function () {
        if ($(this).find('ul li').length > 3) {
            $(this).find('.show-more').show();
        }
    });

    function get_special_block(list_elems, elem, title, dfl_val, icon) {

        /* Html code */

        var special_block = $('<div>')
            .attr('id', elem + '_block')
            .addClass('special-block');

        $('<br><label for="' + elem + '">' + title + '</label>')
            .appendTo(special_block);

        var input_wrapper = $('<div>').addClass('input-block').appendTo(special_block);

        var input = $('<input type="text" name="\' + elem + \'" class="form-control" placeholder="' + dfl_val + '">')
            .appendTo(input_wrapper)
            .keypress(function (e) {
                if (e.which == 13) {
                    if (input_wrapper.hasClass('editing')) {
                        button_edit.click();
                    } else {
                        button_add.click();
                    }
                    return false;
                }
            });

        var button_add = $('<button class="btn btn-default btn-primary add" title="Add"><i class="fa fa-plus" aria-hidden="true"></i></button>')
            .appendTo(input_wrapper);

        var button_edit = $('<button class="btn btn-default btn-primary edit" title="Edit"><i class="fa fa-pencil" aria-hidden="true"></i></button>')
            .appendTo(input_wrapper);

        var button_delete = $('<button class="btn btn-default btn-danger delete" title="Remove"><i class="fa fa-minus" aria-hidden="true"></i></button>')
            .appendTo(input_wrapper);

        var list_wrapper = $('<div>')
            .attr('id', elem + '_wrapper')
            .addClass('list-wrapper')
            .appendTo(special_block);

        var list = $('<ul>')
            .appendTo(list_wrapper);

        var show_more = $('<p class="show-more"><a href="javascript:"><i class="icon-expand"></i></a></p>')
            .hide()
            .appendTo(list_wrapper);

        var show_less = $('<p class="show-less"><a href="javascript:"><i class="icon-collapse"></i></a></p>')
            .hide()
            .appendTo(list_wrapper);

        // Add the elements already in the list (i.e. from the notebook metadata)
        $.each(list_elems, function (i, path) {
            add_path(path);
        });

        // Append after adding the elements to prevent flashing update in the screen
        html.append(special_block);

        /* Helper functions */

        // Add an element to the list
        function add_path(path) {
            var entry = $('<li>');

            $('<i class="fa fa-pencil" aria-hidden="true">')
                .appendTo(entry);

            $('<i class="fa ' + icon + '" aria-hidden="true">')
                .appendTo(entry);

            var path_elem = $('<span>')
                .addClass('path')
                .text(path)
                .attr('title', path)
                .appendTo(entry);

            list.prepend(entry);

            // On click show the editing buttons and the text inside input
            entry.on('click', function () {

                input.val(path);
                input_wrapper.addClass('editing');

                // Remove old actions (from the editing before)
                button_delete.unbind();
                button_edit.unbind();

                // On remove, take the elem out of the list and update the interface
                // Check if the height changes to see if the show more/less are still necessary
                button_delete.on('click', function () {

                    entry.remove();
                    list_elems.splice(list_elems.indexOf(path), 1);
                    input_wrapper.removeClass('editing');
                    input.val("");

                    if (list.height() < 120) {
                        show_more.fadeOut();
                        show_less.fadeOut();
                    }
                })

                // On edit, check if the value changed
                // If it did, check that's not already in the list, otherwise remove it
                // Put the new value at the top of the list
                button_edit.on('click', function () {
                    var new_path = input.val();

                    if (new_path !== path) {

                        if ($.inArray(new_path, list_elems) === -1) {

                            list_elems[list_elems.indexOf(path)] = new_path;
                            path_elem.text(new_path).attr('title', new_path);
                            path = new_path;
                            entry.prependTo(list);

                        } else {

                            entry.remove();
                            list_elems.splice(list_elems.indexOf(path), 1);
                        }
                    }

                    input_wrapper.removeClass('editing');
                    input.val("");
                })
            });
        }

        /* Events */

        button_add.on('click', function () {

            var paths = input.val();
            input.val("");

            $.each(paths.split(/ +(?=(?:(?:[^"]*"){2})*[^"]*$)/g), function (i, path) {

                path = $.trim(path);

                if (path !== "" && $.inArray(path, list_elems) === -1) {

                    list_elems.push(path);
                    add_path(path);
                }
            });
        });

        show_more.on('click', function () {

            list_wrapper.css({
                // Set height to prevent instant jumpdown when max height is removed
                'height': list_wrapper.height(),
                'max-height': 'none'
            })
                .animate({
                    "height": list.outerHeight() + show_less.outerHeight()
                }, function () {
                    list_wrapper.css({
                        'height': 'auto'
                    })
                });
            show_more.hide();
            show_less.fadeIn();

            return false;
        });

        show_less.on('click', function () {

            list_wrapper.animate({
                "height": '120px'
            });
            show_less.hide();
            show_more.fadeIn();

            return false;
        });

        // Observe if the list height passed the size of the container
        new MutationObserver(function (mutations) {

            if (list.height() >= 120) {

                if (show_less.css('display') === 'none') {
                    show_more.fadeIn();
                }

            } else {

                show_more.fadeOut();
                show_less.fadeOut();
                list_wrapper.css({
                    'height': 'auto',
                    'max-height': '120px'
                })
            }
        }).observe(list.get(0), {childList: true});
    }

    // Show the NXCALS options in the interface
    function show_nxcals_options() {

        that.include_nxcals_options = true;

        var jars_block = that.modal.find('#jars_block');
        var options_block = that.modal.find('#extrajavaoptions_block');

        var jars_ul = jars_block.find('ul');
        var options_ul = options_block.find('ul');

        $.each(extra_options.nxcals_extraopts, function (k, opt) {

            var entry = $('<li>').addClass('nxcals_option');

            $('<i class="fa fa-cog" aria-hidden="true">')
                .appendTo(entry);
            $('<span>')
                .addClass('path')
                .text(opt)
                .attr('title', opt)
                .appendTo(entry);

            options_ul.append(entry);

        });

        $.each(extra_options.nxcals_jars, function (k, jar) {

            var entry = $('<li>').addClass('nxcals_option');

            $('<i class="fa fa-cube" aria-hidden="true">')
                .appendTo(entry);
            $('<span>')
                .addClass('path')
                .text(jar)
                .attr('title', jar)
                .appendTo(entry);

            jars_ul.append(entry);
        });
    }

    function hide_nxcals_options() {
        that.include_nxcals_options = false;
        that.modal.find('.nxcals_option').remove();
    }
}

/**
 * Html for connecting state
 */
SparkConnector.prototype.get_html_connecting = function () {

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

    wrapper.append('Trying to connect to Spark Clusters.<br>This may take a while...');

    var logs_wrapper = $('<div>')
        .addClass('connecting')
        .appendTo(html);

    this.connecting_logs = $('<pre>')
        .addClass('logs')
        .appendTo(logs_wrapper);
}

/**
 * Html for connected state
 */
SparkConnector.prototype.get_html_connected = function () {

    var html = this.modal.find('.modal-body');

    html.html('<p class="success">You are now connected!</p><p>The following variables were instantiated:</p>' +
        '<ul class="variables">' +
        '<li><b>sc</b> = <a href="https://spark.apache.org/docs/2.2.0/api/python/pyspark.html#pyspark.SparkContext" target="_blank">SparkContext</a></li>' +
        '<li><b>spark</b> = <a href="https://spark.apache.org/docs/2.2.0/api/python/pyspark.sql.html#pyspark.sql.SparkSession" target="_blank">SparkSession</a></li>' +
        '</ul>');

    if (this.connecting_logs != null) {

        var that = this;
        $('<a>')
            .attr('href', 'javascript:')
            .text('Show/Hide connection logs')
            .on('click', function () {
                that.connecting_logs.toggle();
            })
            .appendTo(html);

        this.connecting_logs.appendTo(html);
    }
}

/**
 * Shows the specified state to the user
 * Clears the previous state and sets the buttons
 * @param new_state State to display
 * @param error Error message to display (depends on the state)
 */
SparkConnector.prototype.switch_state = function (new_state, error) {
    this.state = new_state;

    if (this.modal) {
        var header = this.modal.find('.modal-header');
        var body = this.modal.find('.modal-body');
        var footer = this.modal.find('.modal-footer');

        body.html('');
        footer.html('');

        new_state.get_html(error);

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
    if (Jupyter.notebook.metadata &&
        Jupyter.notebook.metadata.sparkconnect) {
        return Jupyter.notebook.metadata.sparkconnect;
    }
    return {};
}

/**
 * Store the options in the notebook metadata
 */
SparkConnector.prototype.save_notebook_metadata = function () {

    var sparkconnect_metadata = {
        list_of_extrajavaoptions: this.list_of_extrajavaoptions,
        list_of_jars: this.list_of_jars,
        list_of_options: this.list_of_options,
        include_nxcals_options: this.include_nxcals_options
    }

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
