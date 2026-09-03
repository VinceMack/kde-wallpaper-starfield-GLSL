// The MIT License
// 
// Copyright (c) 2024 Felix Lemke
// 
// Permission is hereby granted, free of charge, 
// to any person obtaining a copy of this software and 
// associated documentation files (the "Software"), to 
// deal in the Software without restriction, including 
// without limitation the rights to use, copy, modify, 
// merge, publish, distribute, sublicense, and/or sell 
// copies of the Software, and to permit persons to whom 
// the Software is furnished to do so, 
// subject to the following conditions:
// 
// The above copyright notice and this permission notice 
// shall be included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES 
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR 
// ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// Window visibility detection adapted from PlasmaWallpaper_CityGrow (by Felix Lemke)
// and Smart Video Wallpaper (by ADHE)

import QtQuick
import QtQuick.Window
import org.kde.taskmanager as TaskManager
import org.kde.kitemmodels as KItemModels

Item {
    id: wModel
    property alias screenGeometry: tasksModel.screenGeometry
    property bool runSimulation: true
    property bool checkSmartPlay: (wallpaper.configuration.PauseWhenBlocked !== undefined)
        ? wallpaper.configuration.PauseWhenBlocked
        : (wallpaper.configuration.checkedSmartPlay !== undefined ? wallpaper.configuration.checkedSmartPlay : true)
    property var screen: Screen

    readonly property int maximizedCount: maximizedWindowModel.count
    readonly property int fullScreenCount: fullScreenWindowModel.count
    readonly property int minimizedCount: minimizedWindowModel.count

    onCheckSmartPlayChanged: updateWindowsinfo(checkSmartPlay)

    TaskManager.VirtualDesktopInfo { id: virtualDesktopInfo }
    TaskManager.ActivityInfo { id: activityInfo }
    TaskManager.TasksModel {
        id: tasksModel
        sortMode: TaskManager.TasksModel.SortVirtualDesktop
        groupMode: TaskManager.TasksModel.GroupDisabled

        activity: activityInfo.currentActivity
        virtualDesktop: virtualDesktopInfo.currentDesktop
        screenGeometry: (wallpaper.screenGeometry !== undefined && wallpaper.screenGeometry.width > 0)
            ? wallpaper.screenGeometry
            : Qt.rect(wModel.Screen.virtualX, wModel.Screen.virtualY, wModel.Screen.width, wModel.Screen.height)

        filterByActivity: true
        filterByVirtualDesktop: true
        filterByScreen: true

        onActiveTaskChanged: updateWindowsinfo(wModel.checkSmartPlay)
        onDataChanged: updateWindowsinfo(wModel.checkSmartPlay)
    }

    KItemModels.KSortFilterProxyModel {
        id: maximizedWindowModel
        sourceModel: tasksModel
        filterRoleName: 'IsMaximized'
        filterRegularExpression: RegExp("true")
        onDataChanged: updateWindowsinfo(wModel.checkSmartPlay)
        onCountChanged: updateWindowsinfo(wModel.checkSmartPlay)
    }
    KItemModels.KSortFilterProxyModel {
        id: fullScreenWindowModel
        sourceModel: tasksModel
        filterRoleName: 'IsFullScreen'
        filterRegularExpression: RegExp("true")
        onDataChanged: updateWindowsinfo(wModel.checkSmartPlay)
        onCountChanged: updateWindowsinfo(wModel.checkSmartPlay)
    }
    KItemModels.KSortFilterProxyModel {
        id: onlyWindowsModel
        sourceModel: tasksModel
        filterRoleName: 'IsWindow'
        filterRegularExpression: RegExp("true")
        onDataChanged: updateWindowsinfo(wModel.checkSmartPlay)
        onCountChanged: updateWindowsinfo(wModel.checkSmartPlay)
    }
    KItemModels.KSortFilterProxyModel {
        id: minimizedWindowModel
        sourceModel: tasksModel
        filterRoleName: 'IsMinimized'
        filterRegularExpression: RegExp("true")
        onDataChanged: updateWindowsinfo(wModel.checkSmartPlay)
        onCountChanged: updateWindowsinfo(wModel.checkSmartPlay)
    }

    Component.onCompleted: {
        updateWindowsinfo(wModel.checkSmartPlay)
    }

    function updateWindowsinfo(checkActive) {
        if (!checkActive) {
            runSimulation = true;
            return;
        }
        if (maximizedWindowModel.count + fullScreenWindowModel.count > 0) {
            var joinApps = [];
            var minApps = [];

            // Add fullscreen and maximized apps
            findAppIds(fullScreenWindowModel, joinApps);
            findAppIds(maximizedWindowModel, joinApps);
            // Add minimized apps
            findAppIds(minimizedWindowModel, minApps);

            joinApps = removeDuplicates(joinApps);

            var twoStates = 0;
            for (var i = 0; i < joinApps.length; i++) {
                if (minApps.indexOf(joinApps[i]) !== -1) {
                    twoStates++;
                }
            }

            if (joinApps.length - twoStates > 0) {
                runSimulation = false;
                return;
            }
        }
        runSimulation = true;
    }

    function findAppIds(model, arr) {
        for (let row = 0; row < model.rowCount(); row++) {
            for (let column = 0; column < model.columnCount(); column++) {
                let aObj = model.data(model.index(row, column));
                if (aObj !== undefined && aObj !== null) {
                    arr.push(aObj);
                }
            }
        }
        return arr;
    }

    function removeDuplicates(arrArg) {
        return arrArg.filter(function(elem, pos, arr) {
            return arr.indexOf(elem) === pos;
        });
    }
}
