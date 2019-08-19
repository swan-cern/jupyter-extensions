import $ from 'jquery';
import dialog from 'base/js/dialog';
import Jupyter from 'base/js/namespace';
import events from 'base/js/events';
import requirejs from 'require';
import keyboard from 'base/js/keyboard';
import user_html from './templates/user.html';
import create_context_html from './templates/create_context.html';
import user_create from './templates/user_create.html';
import './css/style.css';
import kubernetes_icon from './images/k8s.png';
import kubernetes_icon_blue from './images/k8s_blue.png';


/**
 * @desc K8sSelection object constructor
 * @constructor
 */
function K8sSelection() {

    /**
     * @desc States that are visible to the user
     */
    this.states = {
        select: {
            get_html: $.proxy(this.get_html_select_cluster, this),
        },
        auth: {
            get_html: $.proxy(this.get_html_auth, this),
            buttons: {
                'Authenticate': {
                    class: 'btn-blue size-100 auth-button',
                    click: $.proxy(this.authenticate, this)
                }
            }
        },
        create: {
            get_html: $.proxy(this.get_html_create_clusters, this),
            buttons: {
                'AddCluster': {
                    class: 'btn-blue size-100',
                    click: $.proxy(this.create_context, this)
                }
            }
        },
        create_users: {
            get_html: $.proxy(this.get_html_create_users, this),
            buttons: {
                'CreateUser': {
                    class: 'btn-blue size-100',
                    click: $.proxy(this.create_users, this)
                }
            }
        },
        loading: {
            get_html: $.proxy(this.get_html_loading, this),
            hide_close: true,
        },
        error: {
            get_html: $.proxy(this.get_html_error, this)
        },
        cluster_details: {
            get_html: $.proxy(this.get_cluster_detials_view_html, this)
        }
    };

    this.comm = null;
    this.get_auth = false;
    this.is_reachable = false;
    this.is_admin = false;
    this.initial_select = true;
    this.stateConfigMap = {};
    this.openstack_tab = 'openstack';
    this.token_tab = 'sa-token';

    // Starts the communication with backend when the kernel is connected
    events.on('kernel_connected.Kernel', $.proxy(this.start_comm, this));
}


/**
 * @desc adds custom extension button to the Jupyter notebook.
 */
K8sSelection.prototype.add_toolbar_button = function() {
    var action = {
        help: 'Spark clusters settings',
        help_index: 'zz', // Sorting Order in keyboard shortcut dialog
        handler: $.proxy(this.open_modal, this)
    };

    var prefix = 'K8sSelection';
    var action_name = 'show-sparkcluster-conf';
    var full_action_name = Jupyter.actions.register(action, action_name, prefix);
    this.toolbar_button = Jupyter.toolbar.add_buttons_group([full_action_name]).find('.btn');
    this.toolbar_button.html('<div id="extension_icon"></div>');
    this.toolbar_button.find("#extension_icon").css('background-image', 'url("' + requirejs.toUrl('./' + kubernetes_icon) + '")');
    this.toolbar_button.find("#extension_icon").css('width', '16px');
    this.toolbar_button.find("#extension_icon").css('height', '16px');
    this.toolbar_button.find("#extension_icon").css('margin-left', '5px');
    this.enabled = false;
};


/**
 * @desc function to handle dialog box modal of the extension
 */
K8sSelection.prototype.open_modal = function () {

    if (this.enabled && !(this.modal && this.modal.data('bs.modal') && this.modal.data('bs.modal').isShown)) {
        var that = this;

        this.modal = dialog.modal({
            show: false,
            draggable: false,
            notebook: Jupyter.notebook,
            keyboard_manager: Jupyter.keyboard_manager,
            title: 'Spark cluster setting',
        });

        this.modal.click(function(e) {
            // Close modal on click outside of connector area when in not "hide_close" state
            if ($(e.target).is("div") && !$(e.target).closest('.modal-dialog').length && !that.hide_close) {
                that.modal.modal('hide');
            }
        });

        // Call this function when the modal shows after clicking the extension button
        this.modal.on('show.bs.modal', function () {
            that.switch_state(that.states.loading);
            console.log("Get auth: " + that.get_auth);
            that.refresh_modal();
        }).modal('show');

        // Prevents moving the dialog box when clicked on the header
        this.modal.find(".modal-header").unbind("mousedown");

        // Close the dialog box
        this.modal.on('hide.bs.modal', function () {
            return true;
        });
    }
};


/**
 * @desc refreshes the context select state
 */
K8sSelection.prototype.refresh_modal = function() {
    this.switch_state(this.states.loading);
    this.send({'action': 'Refresh'});
};


/**
 * @desc handler to send message to the frontend
 * @param msg - The message that we have to send to the error
 */
K8sSelection.prototype.send = function (msg) {
    this.comm.send(msg);
};


/**
 * @desc display the frontend of the select state. This is the main state and the user will interact with
 * this state the most.
 */
K8sSelection.prototype.get_html_select_cluster = function() {
    var html = this.modal.find('.modal-body');
    var footer = this.modal.find('.modal-footer');
    var header = this.modal.find('.modal-header');

    $('<h4 class="modal-title">Spark cluster setting</h4>').appendTo(header);
    var contexts = this.contexts;
    var current_context = this.current_context;
    var template = user_html;
    this.hide_close = true;
    html.append(template);
    var that = this;
    var list_div = html.find("#user_html_inputs");



    if(current_context != '') {
        if(this.initial_select == true) {
            $('<div class="cluster-list-div"><div class="connect-symbol" style="visibility: hidden;"><i class="fa fa-circle" aria-hidden="true"></i></div><div class="list-item-text" style="color: #C0C0C0;">' + current_context + '</div><button class="list-item-delete pure-material-button-text" id="delete.' + current_context + '">X</button><button disabled class="list-item-share pure-material-button-text" id="share.' + current_context + '"><i class="fa fa-share-alt"></i></button><button class="list-item-select pure-material-button-text" id="select.' + current_context + '">Select</button><hr></div>').appendTo(list_div);
        }
        else {
            if(this.is_reachable == false) {
                $('<div class="cluster-list-div"><div class="not-connected-symbol"><i class="fa fa-circle" aria-hidden="true"></i></div><div class="list-item-text">' + current_context + '</div><button class="list-item-delete pure-material-button-text" id="delete.' + current_context + '">X</button><button disabled class="list-item-share pure-material-button-text" id="share.' + current_context + '"><i class="fa fa-share-alt"></i></button><button class="list-item-select pure-material-button-text" id="select.' + current_context + '">Select</button><hr></div>').appendTo(list_div);
            }
            else {
                if(this.is_admin == true && this.current_cluster_auth_type == this.openstack_tab) {
                    $('<div class="cluster-list-div"><div class="connect-symbol"><i class="fa fa-circle" aria-hidden="true"></i></div><div class="list-item-text">' + current_context + '</div><button class="list-item-delete pure-material-button-text" id="delete.' + current_context + '">X</button><button class="list-item-share pure-material-button-text" id="share.' + current_context + '"><i class="fa fa-share-alt"></i></button><button disabled class="list-item-select pure-material-button-text" id="select.' + current_context + '">Select</button><hr></div>').appendTo(list_div);
                }
                else {
                    $('<div class="cluster-list-div"><div class="connect-symbol"><i class="fa fa-circle" aria-hidden="true"></i></div><div class="list-item-text">' + current_context + '</div><button class="list-item-delete pure-material-button-text" id="delete.' + current_context + '">X</button><button disabled class="list-item-share pure-material-button-text" id="share.' + current_context + '"><i class="fa fa-share-alt"></i></button><button disabled class="list-item-select pure-material-button-text" id="select.' + current_context + '">Select</button><hr></div>').appendTo(list_div);
                }
            }
        }
    }


    for(var i = 0; i < contexts.length; i++) {
        if(contexts[i] != current_context) {
            if(this.cluster_auth_type[i] == 'none') {
                $('<div class="cluster-list-div"><div class="connect-symbol" style="visibility: hidden;"><i class="fa fa-circle" aria-hidden="true"></i></div><div class="list-item-text" style="color: #C0C0C0;">' + contexts[i] + '</div><button class="list-item-delete pure-material-button-text" id="delete.' + contexts[i] + '">X</button><button disabled class="list-item-share pure-material-button-text" id="share.' + contexts[i] + '"><i class="fa fa-share-alt"></i></button><button disabled class="list-item-select pure-material-button-text" id="select.' + contexts[i] + '">Select</button><hr></div>').appendTo(list_div);
            }
            else {
                $('<div class="cluster-list-div"><div class="connect-symbol" style="visibility: hidden;"><i class="fa fa-circle" aria-hidden="true"></i></div><div class="list-item-text" style="color: #C0C0C0;">' + contexts[i] + '</div><button class="list-item-delete pure-material-button-text" id="delete.' + contexts[i] + '">X</button><button disabled class="list-item-share pure-material-button-text" id="share.' + contexts[i] + '"><i class="fa fa-share-alt"></i></button><button class="list-item-select pure-material-button-text" id="select.' + contexts[i] + '">Select</button><hr></div>').appendTo(list_div);
            }

        }
    }


    /**
     * Load more button functionality
     */
    var size_list = list_div.find(".cluster-list-div").length;
    var x = 5;
    html.find('.cluster-list-div:lt(' + size_list + ')').hide();

    if(size_list > 5) {
        html.find('.cluster-list-div:lt('+x+')').show();
        $("<div><button style=\"position: absolute; left: 45%;\" class=\"list-item-load pure-material-button-text\" id=\"load_more_button\">Load More</button></div>").appendTo(html);
    }
    else {
        html.find('.cluster-list-div:lt(' + size_list + ')').show();
    }

    html.find("#load_more_button").click(function() {
        x = x + 5;
        if(x < size_list) {
            html.find('.cluster-list-div:lt('+x+5+')').show();
        }
        else {
            html.find('.cluster-list-div:lt('+size_list+')').show();
            html.find("#load_more_button").hide();
        }
    });

    /**
     * Handler to get the current context and send it to the backend to change the current context in KUBECONFIG
     */
    list_div.find(".list-item-select").on('click', function() {
        that.initial_select = false;
        var button_id = $(this).attr('id');
        var current_context = button_id.split('.')[1];
        that.currently_selected_context = current_context;
        console.log("Selected cluster: " + current_context);

        for(var i = 0; i < that.contexts.length; i++) {
            if(that.contexts[i] == that.currently_selected_context) {
                that.currently_selected_auth_type = that.cluster_auth_type[i];
            }
        }


        if(that.currently_selected_auth_type == that.token_tab) {
            that.switch_state(that.states.loading);
            that.send({
                'action': 'change-current-context',
                'context': that.currently_selected_context,
                'tab': that.currently_selected_auth_type
            });
        }
        else {
            that.switch_state(that.states.loading);
            that.send({
                'action': 'check-auth-required',
                'context': that.currently_selected_context
            })
        }

    });

    /**
     * Handler to delete cluster from the list and send to the backend to delete cluster and context from KUBECONFIG
     */
    list_div.find(".list-item-delete").on('click', function() {
        var button_id = $(this).attr('id');
        var current_context = button_id.split('.')[1];
        that.currently_selected_context = current_context;
        console.log("ID: " + button_id);
        console.log("Selected cluster: " + current_context);
        that.close();
    });

    /**
     * Handler to change the current state to "create_users"
     */
    list_div.find(".list-item-share").on('click', function() {
        var button_id = $(this).attr('id');
        var current_context = button_id.split('.')[1];
        that.stateConfigMap['user_create_context_name'] = current_context;
        that.switch_state(that.states.create_users);
    });

    $('<br>').appendTo(list_div);

    // Adds + (Add cluster) state button
    $('<div class="fab-button" id="select-button"><i class="fa fa-plus"></i></div><br><br><br>')
        .appendTo(html)
        .on('click', $.proxy(this.switch_state, this, this.states.create));

};

K8sSelection.prototype.close = function () {
    console.log("Inside close function");
    dialog.modal({
            notebook: Jupyter.notebook,
            keyboard_manager: Jupyter.keyboard_manager,
            title: 'Delete Cluster',
            body: 'Are you sure you want to delete this cluster from the KUBECONFIG file?',
            buttons: {
                'Yes': {
                    class: 'btn-blue size-100',
                    click: $.proxy(this.delete_cluster, this)
                }
            }
        });

};

K8sSelection.prototype.delete_cluster = function () {
    console.log("Deleting context: " + this.currently_selected_context);
    this.switch_state(this.states.loading);
    this.send({
        'action': 'delete-current-context',
        'context': this.currently_selected_context
    });
};


/**
 * @desc display the create cluster and context frontend to the user
 */
K8sSelection.prototype.get_html_create_clusters = function() {
    var html = this.modal.find('.modal-body');
    var header = this.modal.find('.modal-header');

    $("<button>")
    .attr("type", "button")
    .addClass("back-button")
    .html("<i class='fa fa-arrow-left' aria-hidden='true'></i>")
    .appendTo(header)
    .on("click", $.proxy(this.refresh_modal, this));

    $('<h4 class="modal-title">&nbsp;&nbsp;<span>Add new cluster & context</span></h4>').appendTo(header);

    html.append(create_context_html);

    var tabs = html.find("#material-tabs");
    var active = tabs.find(".active");
    var that = this;

    console.log("Currently active state: " + active.attr('id'));

    this.selected_tab = active.attr('id');

    tabs.each(function() {

				var $active, $content, $links = $(this).find('a');

				$active = $($links[0]);
				$active.addClass('active');

				$content = $($active[0].hash);

				$links.not($active).each(function() {
						$(this.hash).hide();
				});
                // var that = that;
				$(this).on('click', 'a', function(e) {

						$active.removeClass('active');
						$content.hide();

						$active = $(this);
						$content = $(this.hash);

						$active.addClass('active');
						$content.show();
                        that.selected_tab = $active.attr('id');
                        console.log("Currently selected tab: " + that.selected_tab);

						e.preventDefault();
	            });
    });


    var tab1 = html.find("#tab1");
    var tab1 = tab1.find("#other-settings");

    var tab2 = html.find("#tab2");


    // "Insecure cluster" checkbox logic for the local tab.
    var checkbox = html.find("#cluster-mode");
    this.checkbox_status = "unchecked";
    checkbox.change(function() {
        if($(this).is(":checked")) {
            that.checkbox_status = "checked";
            tab1.find("#br1").remove();
            tab1.find("#br2").remove();
            tab1.find("#br3").remove();
            tab1.find("#catoken_text_label").remove();
            tab1.find("#catoken_text").remove();

        }
        else {
            that.checkbox_status = "unchecked";
            $('<br id="br1"><br id="br2">').appendTo(tab1);

            $('<label for="catoken_text" id="catoken_text_label">CA Token (Base64)</label><br id="br3">').appendTo(tab1);

            var catoken_input = $('<input/>')
                .attr('name', 'catoken_text')
                .attr('type', 'text')
                .attr("required", "required")
                .attr('id', 'catoken_text')
                .attr('value', that.stateConfigMap['local_selected_catoken'])
                .attr('placeholder', 'CA Token (Base64)')
                .addClass('form__field')
                .appendTo(tab1)
                .keypress(function (e) {
                    var keycode = (e.keyCode ? e.keyCode : e.which);
                    if (keycode == keyboard.keycodes.enter) {
                        that.states.create.buttons.AddCluster.click();
                    }
                });
        }
    });



    // Adds Cluster name input to the local tab
    $('<label for="clustername_text" id="clustername_text_label">Cluster name</label><br>').appendTo(tab1);

    var clustername_input = $('<input required/>')
        .attr('name', 'clustername_text')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'clustername_text')
        .attr('value', this.stateConfigMap['local_selected_clustername'])
        .attr('placeholder', 'Cluster name')
        .addClass('form__field')
        .appendTo(tab1)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create.buttons.AddCluster.click();
            }
        });


    // Adds Server IP input to the local tab
    $('<br><br>').appendTo(tab1);

    $('<label for="ip_text" id="ip_text_label">Server IP</label><br>').appendTo(tab1);

    var ip_input = $('<input/>')
        .attr('name', 'ip_text')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'ip_text')
        .attr('value', this.stateConfigMap['local_selected_ip'])
        .attr('placeholder', 'Server IP')
        .addClass('form__field')
        .appendTo(tab1)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create.buttons.AddCluster.click();
            }
        });


    // Adds Service Account Token input to the local tab
    $('<br><br>').appendTo(tab1);

    $('<label for="token_text" id="token_text_label">Service Account Token</label><br>').appendTo(tab1);

    var token_input = $('<input/>')
        .attr('name', 'token_text')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'token_text')
        .attr('value', this.stateConfigMap['local_selected_token'])
        .attr('placeholder', 'Service Account Token')
        .addClass('form__field')
        .appendTo(tab1)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create.buttons.AddCluster.click();
            }
        });


    // Adds CA Token input to the local tab is insecure checkbox is unchecked
    $('<br id="br1"><br id="br2">').appendTo(tab1);

    $('<label for="catoken_text" id="catoken_text_label">CA Token (Base64)</label><br id="br3">').appendTo(tab1);


    var catoken_input = $('<input/>')
        .attr('name', 'catoken_text')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'catoken_text')
        .attr('value', this.stateConfigMap['local_selected_catoken'])
        .attr('placeholder', 'CA Token (Base64)')
        .addClass('form__field')
        .appendTo(tab1)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create.buttons.AddCluster.click();
            }
        });


    // Adds Cluster name input to the openstack tab
    $('<label for="openstack_clustername_text" id="openstack_clustername_text_label">Cluster name</label><br>').appendTo(tab2);

    var openstack_clustername_input = $('<input required/>')
        .attr('name', 'openstack_clustername_text')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'openstack_clustername_text')
        .attr('value', this.stateConfigMap['openstack_selected_clustername'])
        .attr('placeholder', 'Cluster name')
        .addClass('form__field')
        .appendTo(tab2)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create.buttons.AddCluster.click();
            }
        });

    // Adds Server IP input to the openstack tab
    $('<br><br>').appendTo(tab2);

    $('<label for="openstack_ip_text" id="openstack_ip_text_label">Server IP</label><br>').appendTo(tab2);

    var openstack_ip_input = $('<input/>')
        .attr('name', 'openstack_ip_text')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'openstack_ip_text')
        .attr('value', this.stateConfigMap['openstack_selected_ip'])
        .attr('placeholder', 'Server IP')
        .addClass('form__field')
        .appendTo(tab2)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create.buttons.AddCluster.click();
            }
        });


    // Adds CA Token input to the openstack tab
    $('<br><br>').appendTo(tab2);

    $('<label for="openstack_catoken_text" id="openstack_catoken_text_label">CA Token (Base64)</label><br>').appendTo(tab2);


    var openstack_catoken_input = $('<input/>')
        .attr('name', 'openstack_catoken_text')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'openstack_catoken_text')
        .attr('value', this.stateConfigMap['openstack_selected_catoken'])
        .attr('placeholder', 'CA Token (Base64)')
        .addClass('form__field')
        .appendTo(tab2)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create.buttons.AddCluster.click();
            }
        });
};


/**
 * @desc Handler for getting all the inputs from the frontend and sending it to the backend for creating context
 * and cluster
 */
K8sSelection.prototype.create_context = function() {
    var header = this.modal.find('.modal-header');
    var html = this.modal.find('.modal-body');
    var footer = this.modal.find('.modal-footer');


    if(this.selected_tab == this.token_tab) {
        this.stateConfigMap['local_selected_catoken'] = this.modal.find('input[name="catoken_text"]').val();
        this.stateConfigMap['local_selected_clustername'] = this.modal.find('input[name="clustername_text"]').val();
        this.stateConfigMap['local_selected_ip'] = this.modal.find('input[name="ip_text"]').val();
        this.stateConfigMap['local_selected_token'] = this.modal.find('input[name="token_text"]').val();
    }
    else if(this.selected_tab == this.openstack_tab) {
        this.stateConfigMap['openstack_selected_clustername'] = this.modal.find('input[name="openstack_clustername_text"]').val();
        this.stateConfigMap['openstack_selected_catoken'] = this.modal.find('input[name="openstack_catoken_text"]').val();
        this.stateConfigMap['openstack_selected_ip'] = this.modal.find('input[name="openstack_ip_text"]').val();
    }

    // Checks whether any input is empty before sending it to backend
    if(this.selected_tab == this.token_tab) {
        // Logging all the input from frontend just for debugging purposes.
        console.log("Selected clustername: " + this.stateConfigMap['local_selected_clustername']);
        console.log("Selected ip: " + this.stateConfigMap['local_selected_ip']);
        console.log("Selected token: " + this.stateConfigMap['local_selected_token']);
        console.log("Selected catoken: " + this.stateConfigMap['local_selected_catoken']);

        if(this.checkbox_status == "unchecked") {
            if(!this.stateConfigMap['local_selected_clustername'] || !this.stateConfigMap['local_selected_ip'] || !this.stateConfigMap['local_selected_token'] || !this.stateConfigMap['local_selected_catoken']) {
                this.get_html_error("Please fill all the required fields.", this.states.create);
                return;
            }
        }
        else {
            if(!this.stateConfigMap['local_selected_clustername'] || !this.stateConfigMap['local_selected_ip'] || !this.stateConfigMap['local_selected_token']) {
                this.get_html_error("Please fill all the required fields.", this.states.create);
                return;
            }
        }
    }
    else if(this.selected_tab == this.openstack_tab) {
        console.log("Openstack cluster name: " + this.stateConfigMap['openstack_selected_clustername']);
        console.log("Openstack ca token: " + this.stateConfigMap['openstack_selected_catoken']);
        console.log("Openstack ip: " + this.stateConfigMap['openstack_selected_ip']);

        if(!this.stateConfigMap['openstack_selected_catoken'] || !this.stateConfigMap['openstack_selected_clustername'] || !this.stateConfigMap['openstack_selected_ip']) {
            this.get_html_error("Please fill all the required fields.", this.states.create);
            return;
        }
    }

    footer.find('#select-button').attr('disabled', true);
    header.find('.close').hide();

    // Sending the data to the backend according to the tab selected currently
    if(this.selected_tab == this.token_tab) {
        if(this.checkbox_status == "unchecked") {
            this.send({
                'action': 'add-context-cluster',
                'token': this.stateConfigMap['local_selected_token'],
                'tab': this.selected_tab,
                'catoken': this.stateConfigMap['local_selected_catoken'],
                'cluster_name': this.stateConfigMap['local_selected_clustername'],
                'ip': this.stateConfigMap['local_selected_ip'],
                'insecure_server': "false"
            });
        }
        else {
            this.send({
                'action': 'add-context-cluster',
                'token': this.stateConfigMap['local_selected_token'],
                'tab': this.selected_tab,
                'cluster_name': this.stateConfigMap['local_selected_clustername'],
                'ip': this.stateConfigMap['local_selected_ip'],
                'insecure_server': "true"
            });
        }
    }
    else if (this.selected_tab == this.openstack_tab){
        this.send({
            'action': 'add-context-cluster',
            'tab': this.selected_tab,
            'catoken': this.stateConfigMap['openstack_selected_catoken'],
            'cluster_name': this.stateConfigMap['openstack_selected_clustername'],
            'ip': this.stateConfigMap['openstack_selected_ip']
        });
    }
};

/**
 * @desc shows the create_user state to the user
 */
K8sSelection.prototype.get_html_create_users = function() {
    var html = this.modal.find('.modal-body');
    var header = this.modal.find('.modal-header');

    var that = this;

    html.append(user_create);

    $("<button>")
    .attr("type", "button")
    .addClass("back-button")
    .html("<i class='fa fa-arrow-left' aria-hidden='true'></i>")
    .appendTo(header)
    .on("click", $.proxy(this.refresh_modal, this));

    $('<h4 class="modal-title">&nbsp;&nbsp;<span>Grant access</span></h4>').appendTo(header);

    var user_create_div = html.find("#user_create_div");


    // Adds username field to create_user state frontend
    $('<br><label for="user_create_input" id="user_create_input_label">Username</label><br>').appendTo(user_create_div);

    var user_create_input = $('<input/>')
        .attr('name', 'user_create_input')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'user_create_input')
        .attr('placeholder', 'Username')
        .addClass('form__field')
        .appendTo(user_create_div)
        .change(function() {
            that.stateConfigMap['user_create_input'] = user_create_input.val();
            user_email_create_input.val(user_create_input.val() + "@cern.ch");
            that.user_email_create_input = user_email_create_input.val();
        })
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create_users.buttons.CreateUser.click();
            }
        });


    // Adds user email field to create_user state frontend. Currently I have kept this input for testing. We can delete
    // it however when deployed to production.
    $('<br><br>').appendTo(user_create_div);

    $('<label for="user_email_create_input" id="user_email_create_input_label">Email</label><br>').appendTo(user_create_div);

    var user_email_create_input = $('<input/>')
        .attr('name', 'user_email_create_input')
        .attr('type', 'text')
        .attr("required", "required")
        .attr('id', 'user_email_create_input')
        .attr('placeholder', 'Email')
        .addClass('form__field')
        .appendTo(user_create_div)
        .change(function() {
            that.user_email_create_input = user_email_create_input.val();
        })
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.create_users.buttons.CreateUser.click();
            }
        });
};


/**
 * Handler to get user inputs from the create_user state and send it to the backend to create a user
 */
K8sSelection.prototype.create_users = function() {


    this.stateConfigMap['user_create_input'] = this.modal.find('input[name="user_create_input"]').val();
    this.stateConfigMap['user_email_create_input'] = this.modal.find('input[name="user_email_create_input"]').val();

    // Logging the inputs just for testing purposes
    console.log("Username: " + this.stateConfigMap['user_create_input']);
    console.log("Email: " + this.stateConfigMap['user_email_create_input']);
    console.log("Selected context: " + this.stateConfigMap['user_create_context_name']);


    // Check whether the inputs are not empty.
    // Note: I have not validated the email field right now because it is going to be removed, right?
    this.stateConfigMap['user_email_id'] = this.stateConfigMap['user_email_create_input'];
    if(!this.stateConfigMap['user_create_input'] || !this.stateConfigMap['user_email_create_input']) {
        this.get_html_error("Please fill all the required fields.", this.states.create_users);
        return;
    }

    // Send the inputs to the backend to add users to a cluster
    this.switch_state(this.states.loading);
    this.send({
        'action': 'create-user',
        'username': this.stateConfigMap['user_create_input'],
        'email': this.stateConfigMap['user_email_create_input'],
        'context': this.stateConfigMap['user_create_context_name']
    });
};

K8sSelection.prototype.get_cluster_detials_view_html = function() {
    var html = this.modal.find('.modal-body');
    var header = this.modal.find('.modal-header');

    var that = this;

    $("<button>")
    .attr("type", "button")
    .addClass("back-button")
    .html("<i class='fa fa-arrow-left' aria-hidden='true'></i>")
    .appendTo(header)
    .on("click", $.proxy(this.switch_state, this, this.states.create_users));

    $('<h4 class="modal-title">&nbsp;&nbsp;<span>Connection details for cluster: ' + this.stateConfigMap['user_create_context_name'] + '</span></h4>').appendTo(header);

    $('<h4 id="detail_div">Please send the connection details via email to: ' + this.stateConfigMap['user_email_id'] + '</h4><br>').appendTo(html);

    $('<div style="display: flex;"><h4 id="cluster_name">K8s Cluster Name:</h4>&nbsp;<p style="font-size: 15px; margin-top: 5px;">' + this.cluster_name_view + '</p><br></div>').appendTo(html);

    $('<div style="display: flex;"><h4 id="server_ip">K8s master:</h4>&nbsp;<p style="font-size: 15px; margin-top: 5px;">' + this.server_ip_view + '</p><br></div>').appendTo(html);

    $('<div style="display: flex;"><div class="content"><h4 id="ca_token">CA Token:</h4><p style="font-size: 15px; margin-top: 5px; word-wrap: break-word;">' + this.ca_cert_view + '</p><br></div>').appendTo(html);
};


K8sSelection.prototype.get_html_auth = function() {

    console.log("Inside html auth");
    var html = this.modal.find('.modal-body');
    var header = this.modal.find('.modal-header');

    var that = this;

    $('<h4 class="modal-title">&nbsp;&nbsp;<span>Authentication</span></h4>').appendTo(header);

    // Adds username field to create_user state frontend
    $('<br><label for="user_auth_pass" id="user_auth_pass_label">Password</label><br>').appendTo(html);

    var user_create_input = $('<input/>')
        .attr('name', 'user_auth_pass')
        .attr('type', 'password')
        .attr("required", "required")
        .attr('id', 'user_auth_pass')
        .attr('placeholder', 'Password')
        .addClass('form__field')
        .appendTo(html)
        .keypress(function (e) {
            var keycode = (e.keyCode ? e.keyCode : e.which);
            if (keycode == keyboard.keycodes.enter) {
                that.states.auth.buttons.Authenticate.click();
            }
        });

};


K8sSelection.prototype.authenticate = function() {
    console.log("Authenticating");

    var password_field = this.modal.find('.auth-button');
    password_field.attr('disabled', '');

    var password_field = this.modal.find('input[name="user_auth_pass"]');
    password_field.attr('disabled', '');

    this.switch_state(this.states.loading);
    this.send({
        action: 'kerberos-auth',
        password: password_field.val()
    });
};

/**
 * @desc displays the frontend for loading state
 */
K8sSelection.prototype.get_html_loading = function() {
    var html = this.modal.find('.modal-body');

    var flexbox = $('<div>')
        .addClass('loading-flexbox')
        .appendTo(html);

    var loading = $('<div>')
        .addClass('loading-div')
        .appendTo(flexbox);

    $('<div>')
        .addClass('nb-spinner')
        .appendTo(loading);
};


/**
 * @desc frontend for the error state.
 * @param error
 * @param prev_state
 */
K8sSelection.prototype.get_html_error = function (error, prev_state) {
    if (this.modal) {
        Jupyter.keyboard_manager.disable();
        var header = this.modal.find('.modal-header');
        var body = this.modal.find('.modal-body');
        var footer = this.modal.find('.modal-footer');

        header.html('');
        body.html('');
        footer.html('');

        $('<button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>').appendTo(header);


        // Here the back button allows to go back to the previous state
        $("<button>")
            .attr("type", "button")
            .addClass("back-button")
            .html("<i class='fa fa-arrow-left' aria-hidden='true'></i>")
            .appendTo(header)
            .on("click", $.proxy(this.switch_state, this, prev_state));

        $('<h4 class="modal-title">&nbsp;&nbsp;<span>Error</span></h4>').appendTo(header);

        $('<div id="setting-error"><br><h4 style="color: red;">' + error + '</h4></div>').appendTo(body);
    }
};


/**
 * @desc Handler to process messages recieved from the backend
 * @param msg
 */
K8sSelection.prototype.on_comm_msg = function (msg) {
    if(msg.content.data.msgtype == 'context-select') {
        // The initial message recieved from the backend which provides the information about all the contexts
        console.log("Got message from frontend: " + msg.content.data.active_context);
        this.enabled = true;
        this.current_context = msg.content.data.active_context;
        this.contexts = msg.content.data.contexts;
        this.current_cluster = msg.content.data.current_cluster;
        this.clusters = msg.content.data.clusters;
        this.cluster_auth_type = msg.content.data.cluster_auth_type;
        this.current_cluster_auth_type = msg.content.data.current_cluster_auth_type;
        console.log("Kerberos auth from backend: " + msg.content.data.kerberos_auth);
        this.switch_state(this.states.select);
    }
    else if(msg.content.data.msgtype == 'added-context-successfully') {
        // The message received when cluster and context are added successfully

        this.stateConfigMap['local_selected_token'] = undefined;
        this.stateConfigMap['local_selected_catoken'] = undefined;
        this.selected_tab = undefined;
        this.checkbox_status = undefined;
        this.stateConfigMap['local_selected_clustername'] = undefined;
        this.stateConfigMap['local_selected_ip'] = undefined;
        this.stateConfigMap['openstack_selected_catoken'] = undefined;
        this.stateConfigMap['openstack_selected_clustername'] = undefined;
        this.stateConfigMap['openstack_selected_ip'] = undefined;

        this.hide_close = false;
        this.refresh_modal();
    }
    else if(msg.content.data.msgtype == 'added-context-unsuccessfully') {
        // The message received when cluster and context are not added successfully
        console.log("Added context unsuccessfull");
        this.hide_close = false;
        var footer = this.modal.find('.modal-footer');
        var header = this.modal.find('.modal-header');

        footer.find('#select-button').attr('disabled', false);
        header.find('.close').show();

        this.get_html_error(msg.content.data.error, this.states.create);

        console.log("Added context unsuccessfull");
    }
    else if(msg.content.data.msgtype == 'changed-current-context') {
        // The message received when successfully changed current context in the backend
        this.is_reachable = msg.content.data.is_reachable;
        this.is_admin = msg.content.data.is_admin;
        this.hide_close = false;
        this.toolbar_button.html('<div id="extension_icon"></div>');
        this.toolbar_button.find("#extension_icon").css('background-image', 'url("' + requirejs.toUrl('./' + kubernetes_icon_blue) + '")');
        this.toolbar_button.find("#extension_icon").css('width', '16px');
        this.toolbar_button.find("#extension_icon").css('height', '16px');
        this.toolbar_button.find("#extension_icon").css('margin-left', '5px');
        this.toolbar_button.removeAttr('disabled');
        this.enabled = true;
        this.refresh_modal();
    }
    else if(msg.content.data.msgtype == 'changed-current-context-unsuccessfully') {
        this.is_reachable = msg.content.data.is_reachable;
        this.is_admin = msg.content.data.is_admin;
        this.hide_close = false;
        this.toolbar_button.html('<div id="extension_icon"></div>');
        this.toolbar_button.find("#extension_icon").css('background-image', 'url("' + requirejs.toUrl('./' + kubernetes_icon) + '")');
        this.toolbar_button.find("#extension_icon").css('width', '16px');
        this.toolbar_button.find("#extension_icon").css('height', '16px');
        this.toolbar_button.find("#extension_icon").css('margin-left', '5px');
        this.toolbar_button.removeAttr('disabled');
        this.enabled = true;
        this.refresh_modal();
    }
    else if(msg.content.data.msgtype == 'deleted-context-successfully') {
        // Message received from backend when the context and cluster are deleted successfully from backend
        // this.modal.modal('hide');
        this.current_context = msg.content.data.current_context;
        var current_context_deleted = msg.content.data.current_context_deleted;
        if(current_context_deleted == true) {
            this.toolbar_button.html('<div id="extension_icon"></div>');
            this.toolbar_button.find("#extension_icon").css('background-image', 'url("' + requirejs.toUrl('./' + kubernetes_icon) + '")');
            this.toolbar_button.find("#extension_icon").css('width', '16px');
            this.toolbar_button.find("#extension_icon").css('height', '16px');
            this.toolbar_button.find("#extension_icon").css('margin-left', '5px');
            this.toolbar_button.removeAttr('disabled');
            this.enabled = true;
        }
        this.refresh_modal();
    }
    else if(msg.content.data.msgtype == 'added-user-unsuccessfully') {
        // Message recieved when the user is not added to a cluster successfully
        var html = this.modal.find('.modal-body');
        var footer = this.modal.find('.modal-footer');
        var header = this.modal.find('.modal-header');
        var that = this;

        this.get_html_error(msg.content.data.error, this.states.create_users);
    }
    else if(msg.content.data.msgtype == 'added-user-successfully') {
        // Message recieved when the user is added to a cluster successfully
        this.stateConfigMap['user_create_input'] = undefined;
        this.user_email_create_input = undefined;
        this.cluster_name_view = msg.content.data.cluster_name;
        this.server_ip_view = msg.content.data.server_ip;
        this.ca_cert_view = msg.content.data.ca_cert;
        this.switch_state(this.states.cluster_details);
    }
    else if(msg.content.data.msgtype == 'auth-required') {
        console.log("Auth required!");
        this.switch_state(this.states.auth);
    }
    else if(msg.content.data.msgtype == 'auth-not-required' || msg.content.data.msgtype == 'auth-successfull') {
        this.switch_state(this.states.loading);
        this.send({
            'action': 'change-current-context',
            'context': this.currently_selected_context,
            'tab': this.currently_selected_auth_type
        });
    }
    else if(msg.content.data.msgtype == 'auth-unsuccessfull') {
        this.get_html_error(msg.content.data.error, this.states.auth);
    }
    else if(msg.content.data.msgtype == 'get-clusters-unsuccessfull') {
        this.get_html_error(msg.content.data.error, this.states.select);
    }
};


/**
 * @desc A Helper function to switch from one state to another
 * @param new_state
 */
K8sSelection.prototype.switch_state = function (new_state) {
    this.state = new_state;

    if (this.modal) {
        Jupyter.keyboard_manager.disable();
        var header = this.modal.find('.modal-header');
        var body = this.modal.find('.modal-body');
        var footer = this.modal.find('.modal-footer');

        header.html('');
        body.html('');
        footer.html('');

        $('<button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>').appendTo(header);

        new_state.get_html();

        // Looping for each button that a state has and adding it to the footer
        $.each(new_state.buttons, function (name, options) {
            $('<button>')
                .addClass('btn-blue')
                .attr('id', 'select-button')
                .on('click', options.click)
                .text(name)
                .appendTo(footer);
        });
    }
};


/**
 * @desc Function to start communication with the backend
 */
K8sSelection.prototype.start_comm = function () {

    // Check whether it is already instantiated and close it.
    if (this.comm) {
        this.comm.close()
    }

    if(this.toolbar_button) {
        this.toolbar_button.html('<div id="extension_icon"></div>');
        this.toolbar_button.find("#extension_icon").css('background-image', 'url("' + requirejs.toUrl('./' + kubernetes_icon) + '")');
        this.toolbar_button.find("#extension_icon").css('width', '16px');
        this.toolbar_button.find("#extension_icon").css('height', '16px');
        this.toolbar_button.find("#extension_icon").css('margin-left', '5px');
    }

    console.log('K8sSelection: Starting Comm with kernel');

    var that = this;

    // Create a new communication with the backend and send a message to the backend when communication starts
    if (Jupyter.notebook.kernel) {
        console.log("Inside if statement!!");
        this.comm = Jupyter.notebook.kernel.comm_manager.new_comm('K8sSelection',
            {'msgtype': 'K8sSelection-conn-open'});
        this.comm.on_msg($.proxy(that.on_comm_msg, that));
        this.comm.on_close($.proxy(that.on_comm_close, that));
    } else {
        console.log("K8sSelection: No communication established, kernel null");
    }
};

function load_ipython_extension() {

    var conn = new K8sSelection();
    conn.add_toolbar_button();
}

export {load_ipython_extension}