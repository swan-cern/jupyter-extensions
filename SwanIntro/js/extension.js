import $ from 'jquery';
import require from 'require';
import dialog from 'base/js/dialog';
import notebooklist from 'tree/js/notebooklist';
import {lory} from 'lory.js';

import welcome from './templates/welcome.html'
import update from './templates/update.html'

var current_iteration = 6;
var temp_file = 'SWAN_projects/.intro';
var base_url;

/**
 * This extensions shows a welcome popup to new users.
 * To check if a user is new, check if the temp_file exists in his CERNBox and
 * if the number inside is lower than current_iteration.
 * If we want to show the popup again, we just need to increase the current_iteration.
 */
function load_ipython_extension() {

    base_url = require.toUrl('.').split('?')[0];

    if(Jupyter.notebook_list && Jupyter.notebook_list.contents) {

        Jupyter.notebook_list.contents.get(temp_file, {type: 'file'})
            .then(function (v) {
                if (v.content == 0) {
                    show_modal(welcome);
                } else if (v.content < current_iteration) {
                    show_modal(update);
                }
            }).catch(function (e) {
            show_modal(welcome);
        });
    }
}

/**
 * Show a modal box with a slider inside.
 * If the user closes the model, saves the iteration in the temp_file
 * so that the popup doesn't show again.
 */
function show_modal (template) {

    var html = template.replace(/{root_path}/g, base_url + '/');

    var modal = dialog.modal({
        draggable: false,
        body: $('<div/>').append(html)
    }).attr('id', 'welcome-modal').addClass('');

    modal.find(".modal-header").unbind("mousedown");

    modal.on('shown.bs.modal', function (e) {

        modal.find('.frame').fadeIn();
        modal.find('.modal-header').fadeIn();

        var simple_dots       = document.querySelector('.js_simple_dots');
        var dot_count         = simple_dots.querySelectorAll('.js_slide').length;
        var dot_container     = simple_dots.querySelector('.js_dots');
        var dot_list_item     = document.createElement('li');

        function handleDotEvent(e) {
            if (e.type === 'before.lory.init') {
                for (var i = 0, len = dot_count; i < len; i++) {
                    var clone = dot_list_item.cloneNode();
                    dot_container.appendChild(clone);
                }
                dot_container.childNodes[0].classList.add('active');
            }
            if (e.type === 'after.lory.init') {
                for (var i = 0, len = dot_count; i < len; i++) {
                    dot_container.childNodes[i].addEventListener('click', function(e) {
                        dot_navigation_slider.slideTo(Array.prototype.indexOf.call(dot_container.childNodes, e.target));
                    });
                }
            }
            if (e.type === 'after.lory.slide') {
                for (var i = 0, len = dot_container.childNodes.length; i < len; i++) {
                    dot_container.childNodes[i].classList.remove('active');
                }
                dot_container.childNodes[e.detail.currentSlide - 1].classList.add('active');
            }
            if (e.type === 'on.lory.resize') {
                for (var i = 0, len = dot_container.childNodes.length; i < len; i++) {
                    dot_container.childNodes[i].classList.remove('active');
                }
                dot_container.childNodes[0].classList.add('active');
            }
        }
        simple_dots.addEventListener('before.lory.init', handleDotEvent);
        simple_dots.addEventListener('after.lory.init', handleDotEvent);
        simple_dots.addEventListener('after.lory.slide', handleDotEvent);
        simple_dots.addEventListener('on.lory.resize', handleDotEvent);

        var dot_navigation_slider = lory(simple_dots, {
            infinite: 1
        });
    });

    modal.on('hide.bs.modal', function (e) {
        Jupyter.notebook_list.contents.save(temp_file, {type: 'file', format: 'text', content: ""+current_iteration})
    });
}

export {load_ipython_extension}