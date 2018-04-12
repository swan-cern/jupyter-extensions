import $ from 'jquery';

/**
 * Library with utility functions to generate alert messages
 */


/**
 * Build an alert message
 * @param Type of alert
 */
function build_alert(alert_class) {
    return $('<div/>')
        .addClass('alert alert-dismissable')
        .addClass(alert_class)
        .append(
            $('<button class="close" type="button" data-dismiss="alert" aria-label="Close"/>')
                .append($('<span aria-hidden="true"/>').html('&times;'))
        );
}

/**
 * Show error message in the main page (outside of modal box)
 * Hide the current modal if available
 * @param modal Modal to hide
 * @param message Message text to display
 */
function alert_error(modal, message) {

    if (modal != null) {
        modal.data('bs.modal').isShown = true;
        modal.modal('hide');
    }

    var alert = build_alert('alert-danger')
        .hide()
        .append(
            $('<p/>').text(message)
        );

    var notification = $('<div/>').attr('id', 'share-notification').append(alert);

    $('body').prepend(notification);
    alert.slideDown('fast');

    $("#share-notification").fadeTo(4000, 500).slideUp(500, function () {
        $("#share-notification").slideUp(500);
    });
}

/**
 * Show error message inside a modal box
 * @param modal Modal where to display
 * @param message Message text do display
 */
function alert_error_modal(modal, message) {

    var alert = build_alert('alert-danger')
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
}

/**
 * Show success message inside a modal box
 * Hide the current modal
 * @param modal Modal where to display
 * @param message Message text to display
 */
function alert_success(modal, message) {


    var html = $('<p>')
        .addClass('success')
        .append('<i class="icon-checked">')
        .append(message);

    modal.find('.modal-body').html(html);
    modal.find('.modal-footer').empty();

    if (modal != null) {
        setTimeout(function(){
            modal.data('bs.modal').isShown = true;
            modal.modal('hide');
        }, 850);
    }
}


export default {
    alert_error: alert_error,
    alert_error_modal: alert_error_modal,
    alert_success: alert_success
}
