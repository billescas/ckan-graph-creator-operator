/*
 * Copyright (c) 2014-2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global GraphSelector, MashupPlatform, StyledElements */


window.Widget = (function () {

    'use strict';

    /**
     * Create a new instance of class Widget.
     * @class
     */
    var Widget = function Widget() {
        this.layout = null;
        this.group_title = null;
        this.series_title = null;
        this.current_graph_type = null;
        this.group_axis_select = null;
        this.series_div = null;
        this.dataset = null;     //The dataset to be used. {structure: {...}, data: {...}}
        this.column_info = null;
        this._3axis_alternative = null;

        // Recieve events for the "dataset" input endpoint
        MashupPlatform.wiring.registerCallback('dataset', showSeriesInfo.bind(this));
    };

    /* ==================================================================================
     *  PUBLIC METHODS
     * ================================================================================== */


    Widget.prototype.init = function init() {
        //TODO READ PREFERENCES AND START EXECUTION
        this.current_graph_type = MashupPlatform.prefs.get('graph_type');

    };

    /* ==================================================================================
     *  PRIVATE METHODS
     * ================================================================================== */

    var get_general_series = function get_general_series() {
        //Get the series from prefs
        return JSON.parse(MashupPlatform.prefs.get('graph_series'));
    };

    var get_bubble_series = function get_bubble_series() {
        return JSON.parse(MashupPlatform.prefs.get('graph_series'));;
    };

    var create_graph_config = function create_graph_config() {
        var series;

        if (this.current_graph_type === 'bubblechart') {
            series = get_bubble_series.call(this);
        } else {
            series = get_general_series.call(this);
        }

        if (series.length > 0) {
            if (MashupPlatform.wiring.getReachableEndpoints('flotr2-graph-config').length > 0) {
                create_flotr2_config.call(this, series);
            }
            if (MashupPlatform.wiring.getReachableEndpoints('googlecharts-graph-config').length > 0) {
                create_google_charts_config.call(this, series);
            }
        }
    };

    var create_flotr2_config = function create_flotr2_config(series) {
        var i, j, row;
        var graph_type = this.current_graph_type;
        var fields = JSON.parse(MashupPlatform.prefs.get('graph_fields'));
        
        var group_column = fields.group_column;
        var data = {};        //Contains all the series that wil be shown in the graph
        var ticks = [];       //When string are used as group column, we need to format the values
        var series_meta = {}; //Contails the name of the datasets
        var group_column_axis = (graph_type == 'bargraph') ? 'yaxis' : 'xaxis';

        //Group Column type
        var group_column_type = null;
        for (i = 0; i < this.dataset.structure.length && group_column_type == null; i++) {
            var field = this.dataset.structure[i];
            if (field.id == group_column) {
                group_column_type = field.type;
            }
        }

        //Is the Group Column an interger or a float?
        var group_column_float = false;
        for (i = 0; i < this.dataset.data.length && !group_column_float; i++) {
            row = this.dataset.data[i];
            if (row[group_column] % 1 !== 0) {
                group_column_float = true;
            }
        }

        //Create the series
        for (i = 0; i < series.length; i++) {
            data[i] = [];
            series_meta[i] = {
                label: series[i]
            };
        }

        if (graph_type === 'bubblechart') {
            
            var axisx_field = fields.axisx;
            var axisy_field = fields.axisy;
            var axisz_field = fields.axisz;
            var series_field = fields.series_field;

            for (j = 0; j < this.dataset.data.length; j++) {
                row = this.dataset.data[j];
                var serie = row[series_field];
                data[series.indexOf(serie)].push([Number(row[axisx_field]), Number(row[axisy_field]) , Number(row[axisz_field])]);
            }
        } else {
            for (i = 0; i < series.length; i++) {
                for (j = 0; j < this.dataset.data.length; j++) {
                    row = this.dataset.data[j];
                    var group_column_value = row[group_column];

                    //Numbers codified as strings must be transformed in real JS numbers
                    //Just in case the previous widget/operator hasn't done it.
                    switch (group_column_type) {
                    case 'number':
                        group_column_value = Number(group_column_value);
                        break;
                    default:
                        //Ticks should be only introduced once
                        if (i === 0) {
                            ticks.push([j, group_column_value]);
                        }
                        group_column_value = j;
                        break;
                    }

                    //In the bars graph the data should be encoded the other way around
                    //Transformation into numbers is automatic since a graph should be
                    //build with numbers
                    if (graph_type === 'bargraph') {
                        data[i].push([Number(row[series[i]]), group_column_value]);
                    } else {
                        data[i].push([group_column_value, Number(row[series[i]])]);
                    }
                }
            }
        }

        //FlotR2 configuration
        var htmltext = false;
        var flotr2Config = {
            config: {
                mouse: {
                    track: true,
                    relative: true
                },
                HtmlText: htmltext,
            },
            datasets: series_meta,
            data: data
        };

        //Configure the group column (X except for when selected graph is a Bar chart)
        flotr2Config.config[group_column_axis] = {
            labelsAngle: 45,
            ticks: ticks.length !== 0 ? ticks : null,
            noTicks: data[0].length,
            title:  group_column,
            showLabels: true,
            //If the group_column data contains at least one float: 2 decimals. Otherwise: 0
            tickDecimals: group_column_float ? 2 : 0
        };

        if (['linechart', 'areachart'].indexOf(graph_type) !== -1) {
            flotr2Config.config.lines = {
                show: true,
                fill: graph_type === 'areachart'
            };

        } else if (graph_type === 'radarchart') {
            flotr2Config.config.radar = {
                show: true
            };
            flotr2Config.config.grid = {
                circular: true,
                minorHorizontalLines: true
            };

        } else if (['columnchart', 'columnchart-stacked', 'barchart', 'barchart-stacked'].indexOf(graph_type) !== -1) {
            var horizontal = ['barchart', 'barchart-stacked'].indexOf(graph_type) !== -1;
            var stacked = ['columnchart-stacked', 'barchart-stacked'].indexOf(graph_type) !== -1;

            flotr2Config.config.bars = {
                show: true,
                horizontal: horizontal,
                stacked: stacked,
                barWidth: 0.5,
                lineWidth: 1,
                shadowSize: 0
            };

        } else if (graph_type === 'bubblechart') {
            flotr2Config.config.bubbles = {
                show: true,
                baseRadius: 5
            };

        } else if (graph_type === 'piechart') {
            flotr2Config.config.pie = {
                show: true,
                explode: 6
            };
        }

        MashupPlatform.wiring.pushEvent('flotr2-graph-config', JSON.stringify(flotr2Config));
    };

    var parse_google_data = function parse_google_data(column, value) {
        if (this.column_info[column].type === 'number') {
            return Number(value);
        } else {
            return value;
        }
    };

    var create_google_charts_config = function create_google_charts_config(series) {
        var i, j, dataset_row, row;
        var graph_type = this.current_graph_type;
        var fields = JSON.parse(MashupPlatform.prefs.get('graph_fields'));
        var group_column = fields.group_column;
        var data = [];        //Contains all the series that wil be shown in the graph

        // Format data
        if (graph_type === 'bubblechart') {            
            var axisx_field = fields.axisx;
            var axisy_field = fields.axisy;
            var axisz_field = fields.axisz;
            var series_field = fields.series_field;
            var id_bubble =  fields.id_bubble;

            // Header
            data.push([id_bubble, axisx_field, axisy_field, series_field, axisz_field]);
            // Data
            for (j = 0; j < this.dataset.data.length; j++) {
                row = this.dataset.data[j];
                var serie = row[series_field];
                data.push([row[id_bubble], Number(row[axisx_field]), Number(row[axisy_field]), serie, Number(row[axisz_field])]);
            }
        } else {
            data.push([group_column].concat(series));
            for (i = 0; i < this.dataset.data.length; i++) {
                dataset_row = this.dataset.data[i];
                row = [parse_google_data.call(this, group_column, dataset_row[group_column])];
                for (j = 0; j < series.length; j++) {
                    row.push(parse_google_data.call(this, series[j], dataset_row[series[j]]));
                }
                data.push(row);
            }
        }

        // Google Charts base configuration
        var googlechartsConfig = {
            options: {},
            data: data
        };

        // Chart specific configurations
        if (['linechart', 'linechart-smooth'].indexOf(graph_type) !== -1) {
            googlechartsConfig.type = 'LineChart';
            if (graph_type === 'linechart-smooth') {
                googlechartsConfig.options.curveType = 'function';
            }

        } else if (graph_type === 'combochart') {
            // TODO
            googlechartsConfig.type = 'ComboChart';
            googlechartsConfig.options.seriesType = 'bars';
            googlechartsConfig.options.series =  googlechartsConfig.type = 'line';
            // END TODO

        } else if (['areachart', 'areachart-stacked'].indexOf(graph_type) !== -1) {
            googlechartsConfig.type = 'AreaChart';
            googlechartsConfig.options.isStacked = graph_type === 'areachart-stacked';

        } else if (graph_type === 'steppedareachart') {
            googlechartsConfig.type = 'SteppedAreaChart';

        } else if (['columnchart', 'columnchart-stacked'].indexOf(graph_type) !== -1) {
            googlechartsConfig.type = 'ColumnChart';
            googlechartsConfig.options.isStacked = graph_type === 'columnchart-stacked';

        } else if (['barchart', 'barchart-stacked'].indexOf(graph_type) !== -1) {
            googlechartsConfig.type = 'BarChart';
            googlechartsConfig.options.isStacked = graph_type === 'barchart-stacked';

        } else if (graph_type === 'histogram') {
            googlechartsConfig.type = 'Histogram';

        } else if (graph_type === 'scatterchart') {
            googlechartsConfig.type = 'ScatterChart';

        } else if (graph_type === 'bubblechart') {
            googlechartsConfig.type = 'BubbleChart';
            googlechartsConfig.options.bubble = {textStyle: {fontSize: 11}};

        } else if (['piechart', 'piechart-3d', 'donutchart'].indexOf(graph_type) !== -1) {
            googlechartsConfig.type = 'PieChart';
            googlechartsConfig.options.is3D = graph_type === 'piechart-3d';
            if (graph_type === 'donutchart') {
                googlechartsConfig.options.pieHole = 0.5;
            }

        } else if (['geochart', 'geochart-markers'].indexOf(graph_type) !== -1) {
            googlechartsConfig.type = 'GeoChart';
            if (graph_type === 'geochart-markers') {
                googlechartsConfig.displayMode = 'markers';
            }
        }

        MashupPlatform.wiring.pushEvent('googlecharts-graph-config', JSON.stringify(googlechartsConfig));
    };

    var showSeriesInfo = function showSeriesInfo(dataset_json) {
        this.dataset = JSON.parse(dataset_json);
        this.column_info = {};

        // Fields Name
        var fields = [];
        for (var i = 0; i < this.dataset.structure.length; i++) {
            var id = this.dataset.structure[i].id;
            this.column_info[id] = this.dataset.structure[i];
        }

        create_graph_config.call(this);        
    };

    return Widget;

})();
