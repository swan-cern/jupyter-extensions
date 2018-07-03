import $ from 'jquery';
import utils from 'base/js/utils';
import showdown from 'showdown';
import notebook from './templates/notebook.html'

var base_url = utils.get_body_data("baseUrl");
var api_url = base_url + 'api/gallery/';
var gallery_url = base_url + 'gallery/';
var files_base_path = 'gallery/'
var libraries;
var breadcrumb;
var pages_cache = {}

function load_ipython_extension() {

    // Get the root Readme file...
    get_libraries_list().then(function (list) {

        libraries = list;

        // ... and generate the list of galleries
        for (var url in libraries) {
            add_elem(url);
        }

        var elem = $('<li>');

        breadcrumb = $('<a>')
            .appendTo(elem);
        $('.breadcrumb').append(elem);

        var current_page = utils.get_body_data("currentPage");
        // Open the page set by the url
        open_page(current_page);

        // Replace the current history state to prevent an empty state (without a page)
        window.history.replaceState({
            url: current_page
        }, libraries[current_page], gallery_url + current_page);

        // Add an event handler for browser back and forward events
        window.onpopstate = function (e) {
            if (e.state !== null) {
                var url = window.history.state ? window.history.state.url : '';
                open_page(url);
            }
        }

    });


    /**
     * Create an entry to a Gallery on the sidebar menu
     * @param url Path to the page markdown
     * @param title Title
     */
    function add_elem(url) {
        var elem = $('<li>');

        $('<a>')
            .text(libraries[url])
            .attr('href', url)
            .on('click', function() {

                // Update the browser url without reloading the page
                window.history.pushState({
                    url: url
                }, libraries[url], gallery_url + url);

                // Display the page content
                open_page(url);
                // Return false to prevent the browser default open action
                return false;
            })
            .appendTo(elem);
        $('#libraries_list').append(elem);
    }

}

/**
 * Open a Gallery
 * This loads the content of its README file and hides the open in SWAN buttons
 * (they are added to the clone button instead).
 * @param {*} url Local path to the Gallery descriptor markdown file (without extension)
 */
function open_page(url) {

    // Ir not url provided open the first page in the list
    if (url === '') {
        url = Object.keys(libraries)[0];
    }

    // Remove the active decorator in the sidebar menu and add it to the new link
    $('#libraries_list .active').removeClass('active');
    $('#libraries_list a[href='+url+']').parent().addClass('active');

    get_page(url).then(function(html) {

        // Set the breadcrumb to the current page
        breadcrumb.text(libraries[url])
            .attr('href', gallery_url + url)
            .on('click', function() {
                open_page(url, libraries[url]);
                return false;
            });

        // Search for open_with_swan buttons and add their link to the clone button.
        // If multiple buttons are present, show a list of option when clicking the clone button.
        // If no button is present, hide the clone button.

        // The cloning will happen with the "download" capability of the swan file manager.
        // Hide the original open with swan buttons in the end.

        var open_with_swan = html.find('.open_in_swan').parent();
        var clone_button = $('#clone-button');

        clone_button.hide();
        clone_button.unbind('click');
        clone_button.find('#new-menu').html('');

        open_with_swan.each(function(){
            var link = $(this);
            var img = link.find('img');
            var data_path = img.data('path');

            var href = base_url + "download?projurl=";

            if(data_path) {
                href += "local:/" + files_base_path + data_path;
            } else {
                var this_link = link.attr('href').split('?projurl=');
                href += this_link[1];
            }

            if (open_with_swan.length == 1) {
                clone_button.on('click', function () {
                    window.location = href;
                    return false;
                });
            } else {
                var li = $('<li>');
                $('<a>')
                    .attr('tabindex', -1)
                    .attr('href', 'javascript:')
                    .text(img.data('name'))
                    .on('click', function () {
                        window.location = href;
                    })
                    .appendTo(li);

                clone_button.find('#new-menu').append(li);
            }
            clone_button.show();
            link.hide();
        });

        $('#gallery-content').html(html);
    });
}

/**
 * Get the main readme file to get the list of galleries available
 * Extract this info from the last list of links inside the document
 */
function get_libraries_list() {

    return new Promise(function(resolve) {

        var list = [];
        $.get(api_url + 'README.md', function(data) {

            var converter = new showdown.Converter();
            data = $(converter.makeHtml(data));


            data.last('ul').children().each(function(pos, child) {

                var link = $(child).find('a');
                list[link.attr('href').replace('.md', '')] = link.text();
            });
            resolve(list);
        }, "text");
    });
}

/**
 * Open a gallery descriptor markdown file and generate HTML from its content
 * @param {*} url Local path to the Gallery descriptor markdown file (without extension)
 */
function get_page(url) {

    return new Promise(function(resolve) {

        // Check if the page was already loaded and is cached.
        // If so, resolve immediately
        if (url in pages_cache) {
            resolve(pages_cache[url]);

        } else { // Otherwise fetch the page

            $.get(api_url + url + '.md', function(html) {

                // Convert the markdown into html
                var converter = new showdown.Converter();
                html = $(converter.makeHtml(html));
                html = $('<div>').append(html);

                // Replace the path of images that reference local images
                html.find('img').each(function(){
                    var img = $(this);
                    var src = img.attr('src');

                    if(!src.startsWith('http')) {
                        img.attr('src', api_url + src);
                    }
                });

                // Convert the links to notebooks inside lists, into the notebook view
                html.find('ul > li > a[href$=".ipynb"]').parents('ul').each(function(){

                    var list_elems = $('<div>')
                        .addClass('gallery');
                    var elem = $(this);

                    elem.find('li > a').each(function() {
                        var a = $(this);
                        var href = a.attr('href');

                        var new_notebook = $(notebook);
                        new_notebook.find('h3').text(a.text());
                        new_notebook.find('a').attr('href', gallery_url + 'view/' + href);

                        var src = href.split('/');

                        // Get the image of the notebook located in the nbSnapshots folder
                        // But.. if the url contains the indication that it's inside a project folder
                        // go one level up to find the image
                        if (href.endsWith('?clone_folder=True')) {
                            src.splice(src.length - 2, 1);
                        }
                        src.splice(src.length - 1, 0, 'nbSnapshots');
                        src = src.join('/');
                        src = src.replace('.ipynb', '.png')

                        new_notebook.find('img').attr('src', api_url + src);

                        list_elems.append(new_notebook);
                    });

                    elem.replaceWith(list_elems);
                });

                // Cache the html and resolve
                pages_cache[url] = html;
                resolve(html);
            }, "text"); //Force the download into text mode
        }
    });
}

export {load_ipython_extension}