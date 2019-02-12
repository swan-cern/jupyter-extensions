import $ from 'jquery';
import dialog from 'base/js/dialog';
import utils from 'base/js/utils'
import configmod from 'services/config'
import CodeMirror from 'codemirror/lib/codemirror';
import cmpython from 'codemirror/mode/python/python';
import cmip from 'notebook/js/codemirror-ipython'

import showdown from 'showdown';
import xss from 'xss';

var toc;
var modal;
var history_stack = [];
var pages = {};

var base_url = utils.get_body_data('baseUrl');
var repo_url_default = "https://raw.githubusercontent.com/swan-cern/help/master/";
var repo_url;


/**
 * Create a promise to load the endpoints configs.
 * Useful to provide different endpoints than the default ones.
 */
var configs_check = new Promise(function(resolve, _) {
    var config = new configmod.ConfigSection('help', {base_url: base_url});
    config.load();
    config.loaded.then(function() {
        if (config.data.help) {
            console.log("Found configurations for SwanHelp", config.data.help);
            repo_url = config.data.help;
            resolve();
        } else {
            console.log("Using default configuration for SwanHelp");
            repo_url = repo_url_default;
            resolve();
        }
    }).catch(function(){
        console.warn("Error getting SwanHelp config: Using default");
        repo_url = repo_url_default;
        resolve();
    });
});

/**
 * Load extension
 * Opens the default README.md file and extracts the table of contents (toc) that needs to be there.
 */
function load_ipython_extension() {

    configs_check.then(function() {
        $.get(repo_url + 'README.md', function (response) {

            var html = markdown_to_html(response, '');
            html.addClass('home_wrapper');
            html.find('ul').first().addClass('toc');
            pages['main'] = html;
            toc = convert_ul_json(html);

            $('#help-button')
                .on('click', function () {

                    modal = dialog.modal({
                        draggable: false,
                        title: 'Help',
                        body: pages.main
                    }).attr('id', 'help-modal').addClass('right full-body');

                    modal.find(".modal-header").unbind("mousedown");

                    modal.on('hidden.bs.modal', function () {
                        history_stack.splice(0);
                    });
                })
                .parent().removeClass('disabled');
        });
    });
}

/**
 * Open a file, enlarge the modal box and keep it in a history stack to allow for a back button
 * If opening the home path, render the toc and clear history stack
 * @param path Relative path of the file to open
 */
function open_page(path) {

    if (path === 'home' || (path === -1 && history_stack.length == 1)) {
        modal.find('.modal-body').html(pages.main);
        history_stack.splice(0);
        modal.removeClass('large');

    } else if (path === -1) {
        history_stack.pop();
        render_page(history_stack[history_stack.length - 1]);

    } else {
        if (typeof pages[path] !== 'undefined') {
            history_stack.push(path);
            render_page(path);

        } else {
            $.get(repo_url + path, function (markdown) {
                pages[path] = markdown_to_html(markdown, path);
                history_stack.push(path);
                render_page(path);
            });
        }
    }
}

// Expose the function so that it can be called from within the HTML
window.open_page = open_page;

/**
 * Generate the HTML of a page, which includes the titles, the article before and after, and the back and home buttons
 * @param path
 */
function render_page(path) {

    var page_info = {
        prev: {},
        next: {},
        section: []
    };

    // The path to compare should have the "javascript" function call,
    // because this extra string was added when rendering the Markdown into HTML
    get_page_info(page_info, toc, 'javascript:open_page(\'' + path + '\')');

    var html = $('<div>');

    var buttons = $('<div>')
        .addClass('nav-buttons')
        .appendTo(html);

    $('<a>')
        .appendTo(buttons)
        .attr('href', 'javascript:open_page(-1)')
        .addClass('no-hover-efecct')
        .append('<i class="icon-arrow-left" aria-hidden="true">')
        .attr('title', 'Back');

    $('<a>')
        .appendTo(buttons)
        .attr('href', 'javascript:open_page(\'home\')')
        .addClass('no-hover-efecct')
        .append('<i class="icon-home" aria-hidden="true">')
        .attr('title', 'Help home');

    $('<p>').appendTo(html);
    $('<h3>').text(page_info.section.join(' > ')).appendTo(html);

    if (typeof page_info.page_title != 'undefined') {
        $('<h2>').text(page_info.page_title).appendTo(html);
    }

    var page_html = pages[path];

    $('<div>')
        .addClass('help-content')
        .appendTo(html)
        .append(page_html);

    var nav = $('<div>')
        .addClass('row')
        .appendTo(html);

    var nav_left = $('<div>')
        .addClass('col-xs-6')
        .addClass('prev')
        .appendTo(nav);

    var nav_right = $('<div>')
        .addClass('col-xs-6')
        .addClass('next')
        .appendTo(nav);


    if (typeof page_info.prev.title != 'undefined') {
        $('<a>')
            .appendTo(nav_left)
            .text(page_info.prev.title)
            .attr('href', page_info.prev.link)
    }
    if (typeof page_info.next.title != 'undefined') {
        $('<a>')
            .appendTo(nav_right)
            .text(page_info.next.title)
            .attr('href', page_info.next.link);
    }

    // The modal expands when the help information is being presented (to have more horizontal space).
    // In order to prevent a text expanding effect, we should wait for the expand animation to finish
    // before replacing the content.
    if (modal.hasClass('large')) {
        set_html();
    } else {
        modal.addClass('large');
        setTimeout(function () {
            set_html();
        }, 300);
    }

    /**
     * Replace the body of the modal box with the page being rendered.
     */
    function set_html() {

        // Clone to prevent Codemirror from modifying it
        var html_clone = html.clone();

        modal.find('.modal-body').html(html_clone);

        // Add syntax highlight to all pre code blocks
        html_clone.find('pre code').each(function() {

            var this_obj = $(this),
                text = this_obj.text().trim();
            this_obj.empty();

            CodeMirror(this, {
                value: text,
                mode: 'python',
                lineNumbers: true,
                readOnly: true
            });
        });
    }
}

/**
 * Get the information from a current page, including its title, the parent pages and
 * the previous and next page in the toc.
 * This is a recursive function.
 * @param output Object containing the a prev, next ans section attributes. This object stores the page information.
 * @param pages Toc object to search for.
 * @param page_path Path of the page to match in the toc (in this case, the links already contain the javascript function call).
 */
function get_page_info(output, pages, page_path) {

    for (var i = 0; i < pages.length; i++) {

        var page = pages[i];

        if (output.page_title && page.link && !output.next.title) { // The current page was already found, so get the next page in toc
            output.next.title = page.name;
            output.next.link = page.link;
        } else if (page.link === page_path) { // This is the page we were looking for
            output.page_title = page.name;
        }

        if (output.next.title) { // If the next page was found, there's nothing else to look for
            return;
        }

        if (page.link && page.link !== page_path) { // Get the previous page in toc
            output.prev.title = page.name;
            output.prev.link = page.link;
        }
        if (!output.page_title) { // Add this page to the section list, and search its children
            output.section.push(page.name);
        }
        get_page_info(output, page.children, page_path);

        if (!output.page_title) { // The page we are looking for was not in the children. Remove this page from the
                                  // section list, as this is not a parent page.
            output.section.pop();
        }
    }
}

/**
 * Converts Markdown into HTML. Replaces the links by "open_page" so that the pages are opened inside the help
 * panel. Adds the path to the repo to the images src.
 * @param markdown Markdown to be replaced
 * @param path Relative path to the file being converted (optional)
 * @returns {void|*|jQuery} Jquery HTML representation
 */
function markdown_to_html(markdown, path) {

    // Get the relative path to the current file
    var relative_path = path.split('/');
    if (relative_path.length > 1) {
        relative_path.pop();
        relative_path.join('/');
        relative_path += '/';
    } else {
        relative_path = "";
    }

    showdown.extension('clear-xss', function () {
        return [{
            type: "output",
            filter: function (text) {
                return filterXSS(text, {
                    onTagAttr: function (tag, name, value, isWhiteAttr) {

                        if (tag === 'a') {
                            if (name === 'href') {
                                if (value.split('://').length == 2) {
                                    return 'href="' + value + '" target="_blank"';
                                } else if (value.startsWith('mailto:')) {
                                    return 'href="' + value + '"';
                                } else {
                                    return 'href="javascript:open_page(\'' + value + '\')"';
                                }
                            }
                        } else if (tag === 'img') {
                            if (name === 'src') {
                                if (value.split('://').length == 2) {
                                    return 'src="' + value + '"';
                                } else {
                                    return 'src="' + repo_url + relative_path + value + '"';
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

    var html = $('<div>')
        .append(converter.makeHtml(markdown));
    html.find('h1').remove();

    return html;
}

/**
 * Given a Jquery HTML representation, search for the first unordered list
 * and return a JSON representation of it.
 * @param readme Jquery HTML representation
 */
function convert_ul_json(readme) {
    return get_list_level(readme.find("ul").first());
}

/**
 * Recursive function to get a JSON representation of an unordered list
 * @param ul
 * @returns {Array}
 */
function get_list_level(ul) {
    var to_return = [];

    ul.children('li').each(function () {

        var li_obj = {}
        to_return.push(li_obj)

        var li = $(this);

        var a = li.children('a').first();

        if (a.length) {
            li_obj.name = a.text();
            li_obj.link = a.attr('href');
        } else {
            li_obj.name = li.clone()
                .children('ul').remove()
                .end().text().trim()
        }

        var children = li.find('ul').first();
        li_obj.children = get_list_level(children);

    });

    return to_return;
}

export {load_ipython_extension}