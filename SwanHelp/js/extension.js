
import $ from 'jquery';
import dialog from 'base/js/dialog';
import require from 'require';

var toc;
var modal;
var history_stack = [];
var pages = {};
var base_url;

/**
 * Load extension
 * Loads table of contents from a json file and enables the help button
 */
function load_ipython_extension() {

    base_url = require.toUrl('.').split('?')[0];

    $.get(require.toUrl('./docs/toc.json'), function (response) {

        toc = response;
        pages['main'] = getRenderedToc(response);

        $('#help-button')
            .on('click', function () {

                modal = dialog.modal({
                    draggable: false,
                    title: 'Quickstart Guide',
                    body: pages.main
                }).attr('id', 'help-modal').addClass('right full-body');

                modal.on('hidden.bs.modal', function () {
                    history_stack.splice(0);
                });
                gtag('event', 'help_click');
            })
            .parent().removeClass('disabled');
    }, "json");
}

/**
 * Open a file, enlarge the modal box and keep it in a history stack to allow for a back button
 * If opening the home path, render the toc and clear history stack
 * @param path Relative path of the file to open
 */
function openPage(path) {

    if (path === 'home' || (path === -1 && history_stack.length == 1)) {
        modal.find('.modal-body').html(pages.main);
        history_stack.splice(0);
        modal.removeClass('large');

    } else if (path === -1) {
        history_stack.pop();
        renderPage(history_stack[history_stack.length - 1]);

    } else {
        if (typeof pages[path] !== 'undefined') {
            history_stack.push(path);
            renderPage(path);

        } else {
            $.get(require.toUrl('./docs/' + path + '.html'), function (page) {
                pages[path] = page; //Replace links by openpage?
                history_stack.push(path);
                renderPage(path);
            });
        }
    }
}

// Expose the function so that it can be called from within the HTML
window.openPage = openPage;

/**
 * Generate the HTML of a page, which includes the titles, the article before and after, and the back and home buttons
 * @param path
 */
function renderPage(path) {

    var prev = {}, next = {}, section, page_title;

    for (var title in toc) {
        var topics = toc[title]

        if (typeof topics === 'string') {

            if (path === topics) {
                section = title;

            } else if (typeof section != 'undefined') {
                next.title = title;
                next.link = topics;
                break;

            } else {
                prev.title = title;
                prev.link = topics;
            }

        } else {

            for (var topic in topics) {
                if (path === topics[topic]) {
                    section = title;
                    page_title = topic;

                } else if (typeof section != 'undefined') {
                    next.title = topic;
                    next.link = topics[topic];
                    break;

                } else {
                    prev.title = topic;
                    prev.link = topics[topic];
                }
            }
            if (typeof next.title != 'undefined') {
                break;
            }
        }
    }

    var html = $('<div>');

    var buttons = $('<div>')
        .addClass('nav-buttons')
        .appendTo(html);

    $('<a>')
        .appendTo(buttons)
        .attr('href', 'javascript:openPage(-1)')
        .addClass('no-hover-efecct')
        .append('<i class="icon-arrow-left" aria-hidden="true">')
        .attr('title', 'Back');

    $('<a>')
        .appendTo(buttons)
        .attr('href', 'javascript:openPage(\'home\')')
        .addClass('no-hover-efecct')
        .append('<i class="icon-home" aria-hidden="true">')
        .attr('title', 'Quickstart Guide home');

    $('<p>').appendTo(html);
    $('<h2>').text(section).appendTo(html);

    if (typeof page_title != 'undefined') {
        $('<h3>').text(page_title).appendTo(html);
    }

    var page_html = pages[path];
    page_html = page_html.replace(/{root_path}/g, base_url + '/')

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


    if (typeof prev.title != 'undefined') {
        $('<a>')
            .appendTo(nav_left)
            .text(prev.title)
            .attr('href', 'javascript:openPage(\'' + prev.link + '\')')
    }
    if (typeof next.title != 'undefined') {
        $('<a>')
            .appendTo(nav_right)
            .text(next.title)
            .attr('href', 'javascript:openPage(\'' + next.link + '\')');
    }

    if (modal.hasClass('large')) {
        modal.find('.modal-body').html(html);
    } else {
        modal.addClass('large');
        setTimeout(function () {
            modal.find('.modal-body').html(html);
        }, 300);
    }
}

/**
 * Get the HTML representation of the table of contents list
 * @param toc JSON list of help articles
 * @returns HTML representation
 */
function getRenderedToc(toc) {

    var html = $('<div>')
        .addClass('home_wrapper');

    html.append('<p>This guide describes the basic steps you can follow in the new interface. ' +
        'We are working on a more comprehensive description of all the options of the new interface, ' +
        'but this should be enough for you to get started. If you have any doubts, please ask!</p>')

    for (var title in toc) {
        var topics = toc[title]

        if (typeof topics === 'string') {

            var link = $('<a>')
                .appendTo(html)
                .attr('href', 'javascript:openPage(\'' + topics + '\')');

            $('<h2>').text(title).appendTo(link);

        } else {

            $('<h2>').text(title).appendTo(html);
            var list = $('<ul>')
                .addClass('toc')
                .appendTo(html);

            for (var topic in topics) {
                var li = $('<li>').appendTo(list);

                $('<a>')
                    .text(topic)
                    .attr('href', 'javascript:openPage(\'' + topics[topic] + '\')')
                    .appendTo(li);
            }
        }
    }
    return html;
}

export { load_ipython_extension }