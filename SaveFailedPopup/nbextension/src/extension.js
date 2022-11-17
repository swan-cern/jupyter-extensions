import dialog from 'base/js/dialog';
import events from 'base/js/events';

function load_ipython_extension() {
    events.on('notebook_save_failed.Notebook', function (event, error) {
        dialog.modal({
            title : "Saving Notebook Failed!",
            body : 'The request to save this notebook to the server failed. To avoid losing unsaved work please copy your modifications to a local file and try refreshing the page.',
            default_button: "Continue",
            buttons : {
                Continue: {}
            }
        });
    });
}

export {load_ipython_extension}