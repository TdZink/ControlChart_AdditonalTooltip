/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
      public ControlLimitOptions: ChartOptionsSettings = new ChartOptionsSettings();
      public DataColors: DataColorSettings = new DataColorSettings();
      public XAxis: XAxisSettings = new XAxisSettings();
      public YAxis: YAxisSettings = new YAxisSettings();
      public MedianControlOptions: MedianControlSettings = new MedianControlSettings();
      public DataLables: DataLabelSettings = new DataLabelSettings();
      public TrendLineControls: TrendLineControls = new TrendLineControls();

      }

    export class ChartOptionsSettings {
      public UCShow: boolean = true;
      public numOfDeviationsUC_x: string = "1";
      public UCLabelShow: boolean = false;
      public UCLineStyle: string = "dash";
      public LCShow: boolean = true;
      public numOfDeviationsLC: string = "1";
      public LCLabelShow: boolean = false;
      public LCLineStyle: string = "dash";
      public AreaShadingShow: boolean = false;
      public AreaShadingFill: string = "#cceeff"; //"#eaeaea";
      public transparency: number = 25;
    }

    export class DataColorSettings {
      public measureFill: string = "#01b8aa";
      public medianFill: string = "#999999";
      public UCFill: string = "#FD625E";
      public LCFill: string = "#FD625E";
      public trendColor: string = "#000000";
    }

    export class XAxisSettings {
      public xAxisShow: boolean = true;
      public xAxisFill: string = "#808080";
    }

    export class YAxisSettings {
      public yAxisShow: boolean = true;
      public yAxisGridLineShow: boolean = true;
      public SDAxisShow: boolean = false;
      public yAxisFill: string = "#808080";
    }

    export class MedianControlSettings {
      public medianShow: boolean = true;
      public MedianLineStyle: string = "dash";
      public MedianLabelShow: boolean = false;
    }

    export class DataLabelSettings {
      public dataLabelShow: boolean = false;
      public dataLabelFill: string = "#000000";
      public dataLabelBackgroundShow: boolean = false;
      public dataLabelBackgroundFill: string = "lightgrey";
    }

    export class TrendLineControls {
      public trendShow: boolean = false;
      public trendStyle: string = "solid";
    }