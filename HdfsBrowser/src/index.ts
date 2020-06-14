import {
    ILayoutRestorer, JupyterFrontEnd, JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { Menu } from '@lumino/widgets';
import { HdfsBrowserWidget } from './widgets/HdfsBrowserWidget';

/**
 * Initialization data for the hdfsbrowser extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
    id: '@swan-cern/hdfsbrowser',
    requires: [
        IMainMenu, ILayoutRestorer
    ],
    activate: activate,
    autoStart: true,
};

export default plugin;

/**
 * Activate the running plugin.
 */
function activate(
    app: JupyterFrontEnd,
    mainMenu: IMainMenu,
    restorer: ILayoutRestorer
): void {
    // Add a menu for the plugin
    mainMenu.addMenu(
        createHadoopMenu(app, restorer),
        { rank: 60 }
    );
    console.log('JupyterLab hdfsbrowser is activated!');
}

/**
 * Create menu with commands and menu items
 */
function createHadoopMenu(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer
): Menu {
    const category: string = 'Hadoop';
    const namespace: string = 'hadoop';
    const hdfsbrowserwidget: string = 'hadoop-extension-hdfsbrowser-jupyterlab';
    const hdfsbrowseropen: string = 'hadoop:hdfsbrowseropen';

    app.commands.addCommand(hdfsbrowseropen, {
        label: 'HDFS Browser',
        execute: () => {
            // Restore widget if it was not closed (disposed)
            let hdfsBrowserWidget = tracker.find(value => {
                return value.id === hdfsbrowserwidget || false;
            });

            // If disposed, create new
            if (!hdfsBrowserWidget) {
                const content = new HdfsBrowserWidget();
                hdfsBrowserWidget = new MainAreaWidget({content});

                hdfsBrowserWidget.id = hdfsbrowserwidget;
                hdfsBrowserWidget.title.label = 'HDFS Browser';
                hdfsBrowserWidget.title.closable = true;
            }

            // Track the state of the widget for later restoration
            if (!tracker.has(hdfsBrowserWidget)) {
                tracker.add(hdfsBrowserWidget);
            }
            if (!hdfsBrowserWidget.isAttached) {
                // Attach the widget to the main work area if it's not there
                app.shell.add(hdfsBrowserWidget, 'main');
            }
            hdfsBrowserWidget.content.update();

            // Activate the widget
            app.shell.activateById(hdfsBrowserWidget.id);
        }
    });

    // Initialize hadoop menu
    let menu = new Menu({
        commands: app.commands
    });
    menu.title.label = category;
    menu.addItem({
        command: hdfsbrowseropen,
        args: {},
    });

    // Track and restore the widget state e.g. after refresh
    let tracker = new WidgetTracker<MainAreaWidget<HdfsBrowserWidget>>({
        namespace: namespace
    });
    restorer.restore(tracker, {
        command: hdfsbrowseropen,
        name: () => hdfsbrowserwidget
    });

    return menu;
}
