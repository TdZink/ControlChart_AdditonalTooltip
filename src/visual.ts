/*
*  Power BI Visual CLI
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
import "@babel/polyfill";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import  * as models from "./model";
import {visualTransform} from './dataTransform';

//import DataViewObjectPropertyIdentifier = powerbi.DataViewObjectPropertyIdentifier;
//import { getFillColor } from "powerbi-visuals-utils-dataviewutils/lib/dataViewObjects";

import { VisualSettings, ChartOptionsSettings } from "./settings";
import * as d3 from "d3";
import * as svgUtils from "powerbi-visuals-utils-svgutils";
import * as tooltiputils from "powerbi-visuals-utils-tooltiputils";
//import { geoNaturalEarth1Raw, dsv, text, interpolateRainbow, scaleLinear } from "d3";
import * as math from "mathjs";
import { svg, path, select, timeHours, stackOffsetDiverging, timeParse, formatDefaultLocale, style, tree, utcMillisecond, stackOrderAppearance } from "d3";
import { TooltipEnabledDataPoint } from "powerbi-visuals-utils-tooltiputils";

//import ITooltipService = powerbi.extensibility.ITooltipService;
//import { getValue, getFillColorByPropertyName } from "powerbi-visuals-utils-dataviewutils/lib/dataViewObject";


export class Visual implements IVisual {
    private settings: VisualSettings;
    private host: IVisualHost;
    private canvas: d3.Selection<SVGElement, any, any, any>;
    private container: d3.Selection<SVGElement, any, any, any>;
    private xAxis: d3.Selection<SVGElement, any, any, any>;
    private yAxis: d3.Selection<SVGElement, any, any, any>;
    private yAxisStdDev: d3.Selection<SVGElement, any, any, any>;
    private margin:any;
    private lineChartContainer: d3.Selection<SVGElement, any, any, any>;
    private lineChartContainer_mean: d3.Selection<SVGElement, any, any, any>;
    private lineChartContainer_UC: d3.Selection<SVGElement, any, any, any>;
    private lineChartContainer_LC: d3.Selection<SVGElement, any, any, any>;
    private trendlineChartContainer: d3.Selection<SVGElement, any, any, any>;
    private dataPointSymbolContainer: d3.Selection<SVGElement, any, any, any>; 
    private dataLabelBackgroundContainer: d3.Selection<SVGElement, any, any, any>; 
    private controlAreaContainer: d3.Selection<SVGElement, any, any, any>; 
    private NumofStdUC: number;
    private NumofStdLC: number;
    private MeasureFill: string;
    private MeasureFormat: string;
    private MedianFill: string;
    private UCFill: string;
    private LCFill: string;
    private CountAdditionalToolTipMeasures: number;
    private tooltipServiceWrapper: tooltiputils.ITooltipServiceWrapper;
    private MonthShort: string[];
    

    constructor(options: VisualConstructorOptions) {
      this.host = options.host;
       this.canvas = d3.select(options.element).append("svg");
       this.margin = { top: 25, right: 100, bottom: 25, left: 40, buffer: 30};
       this.container = this.canvas.append("g")
                                   .classed("container",true)
                                   .attr("transform",svgUtils.manipulation.translate(this.margin.left, this.margin.top));
    
       this.xAxis = this.container.append("g").classed("xAxis", true);
       this.yAxis = this.container.append("g").classed("yAxis", true);
       this.yAxisStdDev = this.container.append("g").classed("yAxisStdDev", true);

           
       this.lineChartContainer_mean = this.container.append("g").classed("meanLine", true).attr("transform", "translate(" + this.margin.buffer + ",0)");
       this.lineChartContainer_UC = this.container.append("g").classed("UCLine", true).attr("transform", "translate(" + this.margin.buffer + ",0)"); 
       this.lineChartContainer_LC = this.container.append("g").classed("UCLine", true).attr("transform", "translate(" + this.margin.buffer + ",0)"); 
       
       this.lineChartContainer = this.container.append("g").classed("lineChart", true).attr("transform", "translate(" + this.margin.buffer + ",0)"); //shift the line container to the right away from the y axis
       this.trendlineChartContainer = this.container.append("g").classed("trendlineContainer", true).attr("transform", "translate(" + this.margin.buffer + ",0)");
       
       this.dataLabelBackgroundContainer = this.container.append("g").attr("transform", "translate(" + this.margin.buffer + ",0)");
       this.dataPointSymbolContainer = this.container.append("g").attr("transform", "translate(" + this.margin.buffer + ",0)");

       this.controlAreaContainer = this.container.append("g").classed("meanLine", true).attr("transform", "translate(" + this.margin.buffer + ",0)");
    
       this.tooltipServiceWrapper = tooltiputils.createTooltipServiceWrapper(this.host.tooltipService, options.element);

       this.MonthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      }


    public update(options: VisualUpdateOptions) {
      this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]); //reads in the objects settings from the fromat pane
      let viewModel:models.ChartViewModel = visualTransform(options, this.host); 
      let measureValue = options.dataViews[0].categorical.values[0];
      let measureName = options.dataViews[0].categorical.values[0].source.displayName;
      let measureLabel = options.dataViews[0].categorical.categories[0];
      let additonalToolTipOne = options.dataViews[0].categorical.values[1];
      
      console.log("additonalToolTipOne", additonalToolTipOne.values);


      let width: number = options.viewport.width;
        console.log('width', width);  //approx 1250 is the max width when using default PowerBI canvas size
        let height: number = options.viewport.height;
        console.log('height', height);  //approx 690 is the max height when using the default PowerBI canvas size

        
      d3.select("svg").attr("height", height)
      .attr("width", width);

      let offset_x = height - this.margin.bottom - this.margin.top;
        let offset_y = (this.margin.bottom + this.margin.top) * -1;
     
      //Identifies how many fields were added to the tooltip section
      console.log("Start log");
      this.CountAdditionalToolTipMeasures = options.dataViews[0].categorical.values.length - 1;
     //console.log("add tooltips", this.CountAdditionalToolTipMeasures);



      //reads setting for hiding the x axis lables
      if (this.settings.XAxis.xAxisShow == true) {
            this.xAxis.attr("visibility", "visible");  
        }
      else {
        this.xAxis.attr("visibility", "hidden");
      }

      //reads setting for hiding the y axis lables and tick lines
      if (this.settings.YAxis.yAxisShow == true) {
            this.yAxis.attr("visibility", "visible");
      }
      else {
        this.yAxis.attr("visibility", "hidden");
      }
      if(this.settings.YAxis.SDAxisShow == true){
          this.yAxisStdDev.attr("visibility", "visible");
      }
      else {
        this.yAxisStdDev.attr("visibility", "hidden");
      }

      //reads setting for hiding the upper contorl limit line
      if (this.settings.ControlLimitOptions.UCShow == true){
            this.lineChartContainer_UC.attr("visibility", "visible");
      }
      else {
        this.lineChartContainer_UC.attr("visibility", "hidden");
      }

      //reads setting for hiding the lower contorl limit line
      if (this.settings.ControlLimitOptions.LCShow == true){
        this.lineChartContainer_LC.attr("visibility", "visible");
      }
      else {
        this.lineChartContainer_LC.attr("visibility", "hidden");
      }

      //reads setting for hiding the median line
      if (this.settings.MedianControlOptions.medianShow == true){
            this.lineChartContainer_mean.attr("visibility", "visible");
      }
      else {
        this.lineChartContainer_mean.attr("visibility", "hidden");
      }


      //reads setting for showing the trend line
      if(this.settings.TrendLineControls.trendShow == false){
        this.trendlineChartContainer.attr("visibility", "hidden")
      }
      else {
        this.trendlineChartContainer.attr("visibility", "visible")
      }



      //new margins when the y axis is not being shown
      var newLeftMargin: number;
      var newOffset_x: number;
      if(this.settings.YAxis.yAxisShow == true){
         newLeftMargin = this.margin.buffer;
         newOffset_x = offset_x;
     }
     else {
       newLeftMargin = -10;
       newOffset_x = height - 50;
      }

      var newRightMargin: number;
      var gridLineLength: number;
      //SD Axis has its own setting - separate from the y axis
      if(this.settings.YAxis.SDAxisShow == true){
        newRightMargin = this.margin.left + this.margin.right;
        gridLineLength = 78
      }
      else {
        newRightMargin = 105;
        gridLineLength = 50;

      }

      this.lineChartContainer_mean.attr("transform", "translate(" + newLeftMargin + ",0)");
       this.lineChartContainer_UC.attr("transform", "translate(" + newLeftMargin + ",0)"); 
       this.lineChartContainer_LC.attr("transform", "translate(" + newLeftMargin + ",0)");  
       this.lineChartContainer.attr("transform", "translate(" + newLeftMargin + ",0)"); //shift the line container to the right away from the y axis
       this.trendlineChartContainer.attr("transform", "translate(" + newLeftMargin + ",0)");
       this.dataLabelBackgroundContainer.attr("transform", "translate(" + newLeftMargin + ",0)");
       this.dataPointSymbolContainer.attr("transform", "translate(" + newLeftMargin + ",0)");


      //obtains the number of Standard Deviations from the format pane
      this.NumofStdUC = +this.settings.ControlLimitOptions.numOfDeviationsUC_x;
      console.log(this.NumofStdUC);
      this.NumofStdLC = +this.settings.ControlLimitOptions.numOfDeviationsLC;
      console.log(this.NumofStdLC);
      this.MeasureFill = this.settings.DataColors.measureFill;
      console.log(this.MeasureFill);
      this.MedianFill = this.settings.DataColors.medianFill;
      this.UCFill = this.settings.DataColors.UCFill;
      console.log(this.UCFill);
      this.LCFill = this.settings.DataColors.LCFill;
        
    


        //Check the format of the data measure to see if it is a percentage
          //TODO: Update this as the number of decimals can change in the fomratting
        console.log("Measure Format", options.dataViews[0].categorical.values[0].source.format.toString());

        if(options.dataViews[0].categorical.values[0].source.format == null){
          //if the format is undefined treat as a numeric
        this.MeasureFormat = "numeric";
        console.log("IF statement 1", this.MeasureFormat);
        }
        else if(options.dataViews[0].categorical.values[0].source.format.includes("%") == true){
          this.MeasureFormat = "percentage";
          console.log("IF statement 2", this.MeasureFormat);
        }
        else {
          this.MeasureFormat = "numeric";
          console.log("IF statement 3", this.MeasureFormat);
        }

      

        //if(options.dataViews[0].categorical.categories[0].source.format != null){
        //   console.log("xAxis Format not null")
        //}

            var xAxisFormat;

            if(options.dataViews[0].categorical.categories[0].source.format != null){
              xAxisFormat = options.dataViews[0].categorical.categories[0].source.format.toString()
            }
            else{
              xAxisFormat = "string";
            }

        console.log("X Axis Format", xAxisFormat);

     //   if(xAxisFormat.includes("MMMM") == true && xAxisFormat.includes("yyyy") == true ){
     //     console.log("Format as Month abbrv YYYY");
     //   }


        
        //Taking values from powerbi into an array
        //TODO: Learn a better way doing this - use of an interface?
        var PBI_Lables = [];  //x-axis values
        for(var _i = 0; _i < measureLabel.values.length; _i++){
          console.log("Start assigning values to PBI_Lables");
         
          var d = new Date(measureLabel.values[_i].toString());

          if(xAxisFormat = "string") {
            PBI_Lables[_i] = measureLabel.values[_i];
            console.log("assign STRING values to PBI_Lables");
          }
         
          else if(xAxisFormat.includes("MMMM") == true && xAxisFormat.includes("yyyy") == true ){
              var MonthName = this.MonthShort[d.getMonth()];
              var year = d.getFullYear();
               PBI_Lables[_i] = [MonthName, year].join(' ');
               console.log("incudes MMMM");
              
          }
          //Determines if the value is a date - if a date need output a friendly format string. Everyting else treated as is.          
           else if ((PBI_Lables[_i] instanceof Date) == true) //returns true if the lable is a date
            {
              //format the date value to 'MM-DD-YYYY' format
              var month = '' + (d.getMonth()+1);
              var day = '' + (d.getDate());
              var year = d.getFullYear();
        
              if (month.length < 2 ) month = '0' + month;
              if (day.length < 2) day = '0' + day;
        
              PBI_Lables[_i] = [month, day, year].join('-');
            }
     
          }



       var PBI = [];  //y-axis values
       for( var _i = 0; _i < measureValue.values.length; _i++){
              PBI[_i] = measureValue.values[_i];
          }

          
   //     var AdditionalToolTipOne = [];
   //     for (var _i = 0; _i < measureValue.values.length; _i++){
   //           AdditionalToolTipOne[_i] = additonalToolTipOne.values[_i];
    //    }
       
       //TODO: Allow the user the option to supply a mesaure to use for the median
       var median = d3.median(PBI);
      console.log("Median" ,median);

      //Standard deviation values for the right hand y axis
      var Std = math.std(PBI);
      var StdPlus1: number = median + Std;
      var StdPlus2:number = median + (Std * 2);
      var StdPlus3:number = median + (Std * 3);
      var StdMinus1:number = median - Std;
      var StdMinus2:number = median - (Std * 2);
      var StdMinus3:number = median - (Std *3);
      //console.log('Srd',Std);

      //UpperControl Limit
      var UC = median + (Std * this.NumofStdUC);
      console.log('UC', UC);
      
      //LowerControl Limit
      var LC = median - (Std * this.NumofStdLC);
      console.log('LC', LC);

      var yAxisMax = Math.max.apply(Math, PBI.map(function(d){return d}));

      
      //if the yAxisMax is smaller than the UC replace yAxisMax value with the UC value
      if(this.settings.YAxis.SDAxisShow == true){
              if(yAxisMax < median + (Std * 3)){
                   // console.log(median + (Std * 3));
                   // console.log("yAxisMax", yAxisMax);
                    yAxisMax = median + (Std * 3);
                  //  console.log("y axis max changed");
              }
      }
      else{
        if(yAxisMax < median + (Std * this.NumofStdUC)){
              yAxisMax = median + (Std * this.NumofStdUC);
        }
      }

      

      var yAxisMin = Math.min.apply(Math,PBI.map(function(d){return d}));
      //Determing what the lowest value is between the yAxisMin and LC
      if(this.settings.YAxis.SDAxisShow == true){
          if(yAxisMin > median - (Std * 3)){
            yAxisMin = median - (Std * 3)
          }

          else{
              if(yAxisMax < median - (Std * this.NumofStdLC)){
                yAxisMax = median - (Std * this.NumofStdLC);
                }
            }
      }

      //the yAxis Min will have a padding of %5
      //yAxisMin = yAxisMin * .98;      
  

      //determing the number of y axis ticks based on the heght of the visual
       if(height <= 185) {
         var yTicks = 2
       }
       else if (height < 425) {
         var yTicks = 6
       }
       else {
         var yTicks = 9
       };
      

       

      let xScale = d3
        .scaleLinear()
        .domain([0,(PBI_Lables.length - 1)])
        .range([0, width - newRightMargin]);  //0, x = x controls the padding on the left side of the visual


      //Setting the number of xAxis tick marks
      var xAxisValues = [];
      if(width >= 950){ //780){        //max of 12 marks
        xAxisValues = this.getTickMarks(12,PBI_Lables.length,PBI_Lables);
      }
      else if(width >= 505){ //455){    //max of 6 marks
        xAxisValues = this.getTickMarks(6,PBI_Lables.length,PBI_Lables);
      }
      else if(width >=230){               //max of 3 marks
        xAxisValues = this.getTickMarks(3,PBI_Lables.length,PBI_Lables);
      }
      //if the width is less than 230 no x axis tick marks wil be rendered


      //ordinalScale is the xAxis lables
      var ordinalScale = d3.scalePoint()
                           .domain(PBI_Lables)
                           .range([0, width - newRightMargin]); //this.margin.left - this.margin.right]);    


      console.log("yAxisMin", yAxisMin);


      var yScaleRangeValue: number;
      //If the x axis is not being shown provide that space to the y axis to go to the bottom of the visual
      if(this.settings.XAxis.xAxisShow == false){
        yScaleRangeValue = 10
      }
      else {
        yScaleRangeValue = this.margin.bottom
      }

      console.log("yscale check", yAxisMax);

      var yScale = d3.scaleLinear()
                     //.domain([yAxisMax * 1.02, yAxisMin]).nice()   //nice() function used to display a value on the final tick mark
                     .domain([yAxisMax, yAxisMin]).nice()
                     .rangeRound([0, height - this.margin.top - yScaleRangeValue]);

  
                     //console.log("yAxisMax", yAxisMax * 1.02);
                     //console.log("yAxisMax", yAxisMax);
            
      //Draw x Axis
       this.xAxis.attr("transform",  svgUtils.manipulation.translate(newLeftMargin, offset_x)) //shifts the xAxis to the right 20 from the y axis and offset_x to give padding from the bottom of the visual
                      .call(d3.axisBottom(ordinalScale)
                        .tickValues(xAxisValues)  //Pass in the array with correct number of labels that need to be displayed
                      );
        this.xAxis.selectAll("text").style("color", this.settings.XAxis.xAxisFill);


       //Draw y Axis
       //Change format if the measure is a percentage
       var gridLineSize: number;
      if(this.settings.YAxis.yAxisGridLineShow == true){
          gridLineSize = width - gridLineLength;
      }
      else {
        gridLineSize = 0;
      }

       if(this.MeasureFormat == "percentage"){
       this.yAxis.call(d3.axisLeft(yScale)
                         .ticks(yTicks)
                         .tickFormat(d3.format(".0%"))
                         .tickSize(-(gridLineSize))); //set to 0 to turn off  //changed to -75 to account for the right hand side x axis - removed until I figure out the second yAxis tick marks
       }
       else if(this.MeasureFormat == "numeric") {
        this.yAxis.call(d3.axisLeft(yScale)
                          .ticks(yTicks)
                          .tickSize(-(gridLineSize))); //length of the tick lines across the graph 
       }
       //change the color of the yAxis lables based on the formatting pane
       this.yAxis.selectAll("text").style("color", this.settings.YAxis.yAxisFill);



     this.yAxisStandardDeviation(width, yScale, median, StdPlus1, StdPlus2, StdPlus3, StdMinus1, StdMinus2, StdMinus3);


       //Area shading funtion call based on formatting pane toggle
     if(this.settings.ControlLimitOptions.AreaShadingShow == true){
      this.handleArea(viewModel,UC, LC, PBI, xScale, yScale); 
     }
     else {
      this.controlAreaContainer.selectAll(".area").remove()
     }


       //calls the function to draw the measure line
       this.handleLineUpdate(viewModel,offset_y, xScale, yScale, this.MeasureFill, this.MeasureFormat);

       //determine the value to pass to handleLineUpdate_median for the linestyle choice
       var MedianStyle: number;      
       if(this.settings.MedianControlOptions.MedianLineStyle == "dash"){
          MedianStyle = 2
       }
       else if (this.settings.MedianControlOptions.MedianLineStyle == "solid"){
          MedianStyle = 0
       }
       this.handleLineUpdate_median(viewModel,offset_y, xScale, yScale, median, this.MedianFill, MedianStyle);

      //determine the value to pass to handleLineUpdate_UC for the linestyle choice
      var UCLineStyle: number;      
      if(this.settings.ControlLimitOptions.UCLineStyle == "dash"){
          UCLineStyle = 2
      }
      else if (this.settings.ControlLimitOptions.UCLineStyle == "solid"){
          UCLineStyle = 0
      }
      this.handleLineUpdate_UC(viewModel,offset_y, xScale, yScale, UC, this.UCFill, UCLineStyle)

      //determine the value to pass to handleLineUpdate_LC for the linestyle choice
      var LCLineStyle: number;      
      if(this.settings.ControlLimitOptions.LCLineStyle == "dash"){
          LCLineStyle = 2
      }
      else if (this.settings.ControlLimitOptions.LCLineStyle == "solid"){
          LCLineStyle = 0
      }
       this.handleLineUpdate_LC(viewModel,offset_y, xScale, yScale, LC, this.LCFill, LCLineStyle);

       
      //calls the function to draw the data labels and background if selection for the items is set to true
      if(this.settings.DataLables.dataLabelShow == true){
          this.handleDataPointsLabel(measureValue.values.length, xScale, yScale, PBI, this.settings.DataLables.dataLabelFill, this.MeasureFormat);
        if(this.settings.DataLables.dataLabelBackgroundShow == true){
            this.handleDataPointsLabelBackground(measureValue.values.length, xScale, yScale, PBI, this.settings.DataLables.dataLabelBackgroundFill, this.MeasureFormat);
        }
      }
      else{
        this.dataPointSymbolContainer.selectAll("text").remove();
        this.dataLabelBackgroundContainer.selectAll("rect").remove();
      }

      if(this.settings.DataLables.dataLabelBackgroundShow == false){
        this.dataLabelBackgroundContainer.selectAll("rect").remove();
      }

      //calls the function to draw the data points
      this.handleDataPointsTooltip(measureValue.values.length, xScale, yScale, PBI, this.MeasureFill);


      this.handleLineUpdate_medianTooltip(viewModel,offset_y, xScale, yScale, median);

      this.handleLineUpdate_UCTooltip(viewModel,offset_y, xScale, yScale, UC, this.UCFill);

      this.handleLineUpdate_LCToolTip(viewModel,offset_y, xScale, yScale, LC, this.LCFill);
      

        


    


         //trendline
         this.trendlineChartContainer.selectAll("path").remove();

         var trendLineStyle: number;
         if(this.settings.TrendLineControls.trendStyle == "solid"){
            trendLineStyle = 0;
         }
         else if(this.settings.TrendLineControls.trendStyle == "dash"){
            trendLineStyle = 2;
         }
         
         var xSeries = d3.range(1, PBI_Lables.length + 1);
         var leastSquaresCoeff = this.leastSquares(xSeries, PBI);

         var trendY1 = leastSquaresCoeff[0] + leastSquaresCoeff[1];
         var trendY2 = leastSquaresCoeff[0] * xSeries.length + leastSquaresCoeff[1];
         var trendData = [{
                            "xData": 0,
                            "yData": trendY1
                           },
                           {
                             "xData": PBI_Lables.length - 1,
                             "yData": trendY2
                           }
                          ];

           
           this.trendlineChartContainer.append("path");

              var trendline = d3.line<any>()
                                 .x(d => xScale(d.xData))
                                 .y(d => yScale(d.yData));


              this.trendlineChartContainer.select("path").attr("d", trendline(trendData)).classed("trendline", true)
              .style("stroke", this.settings.DataColors.trendColor)
              .style("stroke-width", "1.5 px")
              .style("stroke-dasharray", trendLineStyle + "%");
                      

        var i = 0;
        PBI.forEach(element => {
            // console.log(element);
            // console.log("i", i);
            var header: string = PBI_Lables[i];
  
            //var onePlusValue: = options.dataViews[0].categorical.values[1].values[i];
            //console.log("onePlusValue",onePlusValue);
            //var OnePlusNumber = math.round(onePlusValue);
  
  
              this.tooltipServiceWrapper.addTooltip(this.dataPointSymbolContainer.select(`.mouse-over-line${i}`),
              (tooltipEvent: tooltiputils.TooltipEventArgs<tooltiputils.TooltipEnabledDataPoint>) => this.getTooltipData_dataPoint(element, this.MeasureFill, header, measureName, this.MeasureFormat)); //, OnePlusNumber));
              i = i+1;
  
              
          });


         


        //format display values for Median, Upper Limit, and Lower Limit tooltips
        var FormatMedian;
        var FormatUC;
        var FormatLC;

        if(this.MeasureFormat == "numeric"){
         FormatMedian = math.round(median).toString();
         FormatUC = math.round(UC).toString();
         FormatLC = math.round(LC).toString();
        }
        else if(this.MeasureFormat == "percentage"){
          FormatMedian = (median * 100).toFixed(2).toString() + "%";
          FormatUC = (UC * 100).toFixed(2).toString() + "%";
          FormatLC = (LC * 100).toFixed(2).toString() + "%";
        }


        if(this.settings.ControlLimitOptions.UCLabelShow == true && this.settings.ControlLimitOptions.UCShow == true){
             this.lineChartContainer_UC.selectAll("text").remove();
             this.lineChartContainer_UC.append("text").classed("UClabel", true)
                                                      .text("Std Dev + " + this.NumofStdUC + " : " + FormatUC)
                                                    //.attr("x", xScale(0)) 
                                                      .attr("y", yScale(UC) - 6)  //-6 for padding to keep text above the UC line
                                                      .style("fill", this.UCFill)
                                                      .style("font-size", 12);     
                                                                    
          }
            else{
              this.lineChartContainer_UC.selectAll("text").remove();
            }


            if(this.settings.ControlLimitOptions.LCLabelShow == true && this.settings.ControlLimitOptions.LCShow == true){
                  this.lineChartContainer_LC.selectAll("text").remove();
                  this.lineChartContainer_LC.append("text").classed("LClabel", true)
                                                          .text("Std Dev - " + this.NumofStdLC + " : " + FormatLC)
                                                          .attr("y", yScale(LC) - 6)  //-6 for padding to keep text above the LC line
                                                          .style("fill", this.LCFill)
                                                          .style("font-size", 12);                                                      
          }
            else{
              this.lineChartContainer_LC.selectAll("text").remove();
            }

            if(this.settings.MedianControlOptions.MedianLabelShow == true && this.settings.MedianControlOptions.medianShow == true){
                  this.lineChartContainer_mean.selectAll("text").remove();
                  this.lineChartContainer_mean.append("text").classed("MedianLabel", true)
                                                             .text("Median : " + FormatMedian)
                                                             .attr("y", yScale(median) - 6)  //-6 for padding to keep text above the median line
                                                             .style("fill", this.MedianFill)
                                                             .style("font-size", 12);

            }
            else{
              this.lineChartContainer_mean.selectAll("text").remove();
            }
        
          
            this.tooltipServiceWrapper.addTooltip(this.lineChartContainer_mean.select(".medianToolTip"),
              (tooltipEvent: tooltiputils.TooltipEventArgs<tooltiputils.TooltipEnabledDataPoint>) => this.getTooltipData(FormatMedian, this.MedianFill, "Median", "Median"));


              var UCtooltiplabel = "+ " + this.NumofStdUC + " Standard Deviaton(s)";
            this.tooltipServiceWrapper.addTooltip(this.lineChartContainer_UC.select(".UCToolTip"),
              (tooltipEvent: tooltiputils.TooltipEventArgs<tooltiputils.TooltipEnabledDataPoint>) => this.getTooltipData(FormatUC, this.UCFill, "Upper Control Limit", UCtooltiplabel)); 

            var LCtooltiplabel = "- " + this.NumofStdLC + " Standard Deviaton(s)";
          this.tooltipServiceWrapper.addTooltip(this.lineChartContainer_LC.select(".LCToolTip"),
            (tooltipEvent: tooltiputils.TooltipEventArgs<tooltiputils.TooltipEnabledDataPoint>) => this.getTooltipData(FormatLC, this.LCFill, "Lower Control Limit", LCtooltiplabel));
     
                

  

}


private handleArea(plotData: models.ChartViewModel, UC:number, LC: number, PBI:any[],xScale:d3.ScaleLinear<number, number>,yScale: d3.ScaleLinear<number, any> ){

     //Area shading test
     //var indexes = d3.range(PBI.length);

     plotData.dataPoints.forEach((element, index) => {
     let AreaId = `area${index}`;
      //  this.lineChartContainer.append("path").attr("id", AreaId);
      //  this.lineChartContainer.append("text").attr("id", `${AreaId}Label`);

      this.controlAreaContainer.selectAll(".area").remove()

      this.controlAreaContainer.append("path").attr("id", AreaId);

          
              let area = d3
              .area<models.ChartDataPoint>()
              .x(d => xScale(d.x_axis))
              .y0(d => yScale(UC))
              .y1(d => yScale(LC));

              this.controlAreaContainer
              .select(`#${AreaId}`)
              .classed("area", true)
              .datum(element)
              .attr("d", area)
              .style("fill", this.settings.ControlLimitOptions.AreaShadingFill)
              .style("opacity", this.settings.ControlLimitOptions.transparency / 100);     
     
    });


}
  
    //functions
    private handleLineUpdate(plotData:models.ChartViewModel,offset_y:number,xScale:d3.ScaleLinear<number, number>,yScale: d3.ScaleLinear<number, any>, fill:string, format:string) {
      
      this.lineChartContainer.selectAll("path").remove();
      this.lineChartContainer.selectAll("text").remove();



      plotData.dataPoints.forEach((element, index) => {
        let lineId = `lineChart${index}`;
        this.lineChartContainer.append("path").attr("id", lineId);
        this.lineChartContainer.append("text").attr("id", `${lineId}Label`);


        let line = d3
          .line<models.ChartDataPoint>()
          .x(d => xScale(d.x_axis))
          .y(d => yScale(d.y_axis));

          this.lineChartContainer
          .select(`#${lineId}`)
          .datum(element)
          .attr("d", line);         
         
        this.lineChartContainer
          .select(`#${lineId}`)
          .attr("fill", "none")
          .attr("stroke", fill)
          .attr("stroke-linejoin", "round")
          .attr("stroke-linecap", "round")
          .attr("stroke-width", 1.5)
          .classed("measureLineContainer", true);
       
     

      

      });
      
      
    }
    private handleLineUpdate_median(plotData:models.ChartViewModel,offset_y:number,xScale:d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, any>, median:number, fill:string, lineStyle: number){
  
      plotData.dataPoints.forEach((element, index) => {
        let lineId = `lineChart${index}`;
        this.lineChartContainer_mean.append("path").attr("id", lineId);
        this.lineChartContainer_mean.append("text").attr("id", `${lineId}Label`);

        let line = d3
          .line<models.ChartDataPoint>()
          .x(d => xScale(d.x_axis))
          .y(d => yScale(median));
  
        this.lineChartContainer_mean
          .select(`#${lineId}`)
          .datum(element)
          .attr("d", line);
          
  
        this.lineChartContainer_mean
          .select(`#${lineId}`)
          .classed("median", true)
          .style("stroke", fill)
          .style("stroke-linejoin", "round")
          .style("stroke-linecap", "round")
          .style("stroke-width", "1.5 px")
          .style("stroke-dasharray", lineStyle + "%");  //if linestyle is set to 0 line becomes solid
          ;


      });
      
      
    }

    private handleLineUpdate_UC(plotData:models.ChartViewModel,offset_y:number,xScale:d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, any>, UC:number, fill:string, lineStyle: number){
  
      plotData.dataPoints.forEach((element, index) => {
        let lineId = `lineChart${index}`;
        this.lineChartContainer_UC.append("path").attr("id", lineId);
        this.lineChartContainer_UC.append("text").attr("id", `${lineId}Label`);

        let line = d3
          .line<models.ChartDataPoint>()
          .x(d => xScale(d.x_axis))
          .y(d => yScale(UC)); 
  
        this.lineChartContainer_UC
          .select(`#${lineId}`)
          .datum(element)
          .attr("d", line)
          
  
        this.lineChartContainer_UC
          .select(`#${lineId}`)
          .classed("UC", true)
          .style("stroke", fill)
          .style("stroke-linejoin", "round")
          .style("stroke-linecap", "round")
          .style("stroke-width", "1.5 px")
          .style("stroke-dasharray", lineStyle + "%");  //if linestyle is set to 0 line becomes solid

      });
      
      
    }

    private handleLineUpdate_LC(plotData:models.ChartViewModel,offset_y:number,xScale:d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, any>, LC:number, fill:string, lineStyle: number){
  
      plotData.dataPoints.forEach((element, index) => {
        let lineId = `lineChart${index}`;
        this.lineChartContainer_LC.append("path").attr("id", lineId);
        this.lineChartContainer_LC.append("text").attr("id", `${lineId}Label`);

        let line = d3
          .line<models.ChartDataPoint>()
          .x(d => xScale(d.x_axis))
          .y(d => yScale(LC));  //this needs to be feed the mean
  
        this.lineChartContainer_LC
          .select(`#${lineId}`)
          .datum(element)
          .attr("d", line)
          
  
        this.lineChartContainer_LC
          .select(`#${lineId}`)
          .classed("LC", true)
         // .style("stroke-width", "20px")  //testing
          .style("stroke", fill)
          .style("stroke", fill)
          .style("stroke-linejoin", "round")
          .style("stroke-linecap", "round")
          .style("stroke-width", "1.5 px")
          .style("stroke-dasharray", lineStyle + "%");  //if linestyle is set to 0 line becomes solid


      });
      
      
    }

    //function to handle the number of x axis tick marks
    private getTickMarks(Max:number, Lenght:number, Labels:any[]){
      if(Lenght <= Max){
        return Labels.filter(function(d, i) { return !(i % 1) }).map(function(d) { return d; });
      }
          else {
            return Labels.filter(function(d, i) { return !(i % math.ceil(Labels.length / Max)) }).map(function(d) { return d; }) ; 
        }
    }   
    

    private handleDataPointsLabel(numOfPoints: number, xScale:d3.ScaleLinear<number, number>,yScale: d3.ScaleLinear<number, any>, PBI:any[], fill: string, format: string){
      this.dataPointSymbolContainer.selectAll("text").remove()
      var _i: number;
      var displayValue;
      var yPosition: number;

      console.log("datalabelFill",fill);

      for(_i = 0; _i < numOfPoints; _i++){
        //Checks the value of the following of the array element to detrerming data label placement    
        if(PBI[_i] <= PBI[_i-1]){
              yPosition = 13;
          }
          else {
            yPosition = -4
          }

          if(_i == 0){
              if(PBI[_i] <= PBI[_i+1]){
                yPosition = 13;
            }
              else {
                yPosition = -4
              }
          }

        //Check if we are at the last value of the array. If so use the previous value to determine placement
        if(_i == (PBI.length - 1)){
          if(PBI[_i] <= PBI[_i-1]){
            yPosition = 13;
          }
          else {
            yPosition = -4;
          }
        }     

        var xPosition = (PBI[_i].toString().length * 3.33) * -1 //equation to help center the data label

        if(format == "percentage"){
          displayValue = (PBI[_i] * 100).toFixed(2);

          xPosition = ((displayValue.toString().length + 1) * 3.33) * -1 //update with formated data label value. addd +1 for the % symbol to be taken in to account

                  this.dataPointSymbolContainer.append("text").classed(`datapoint${_i}`,true)
                                              .attr("x", xScale(_i))
                                              .attr("y", yScale(PBI[_i]))
                                              .style("font-size", "12px")
                                              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
                                              .style("fill", fill)
                                              //.text(PBI[_i].toString())
                                              .text(displayValue.toString() + "%")
                                              .attr("transform",svgUtils.manipulation.translate(xPosition,yPosition))
                                              ;
          
        }
        else{
            this.dataPointSymbolContainer.append("text").classed(`datapoint${_i}`,true)
                                     .attr("x", xScale(_i))
                                     .attr("y", yScale(PBI[_i]))
                                     .style("font-size", "12px")
                                     .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
                                     .style("fill", fill)
                                     //.text(PBI[_i].toString())
                                     .text(displayValue.toString() + "%")
                                     .attr("transform",svgUtils.manipulation.translate(xPosition,yPosition))
                                     ;
        }
          
 
      }     

    }

    private handleDataPointsTooltip(numOfPoints: number, xScale:d3.ScaleLinear<number, number>,yScale: d3.ScaleLinear<number, any>, PBI:any[], fill:string){

          //using a for loop to draw each data point and attaching the tooltip call
        //Need to find a better way of doing this
      this.dataPointSymbolContainer.selectAll("circle").remove();  //remove previous circles before appending new ones.
      this.dataPointSymbolContainer.selectAll("rect").remove();

      var _i: number;
      for(_i = 0; _i < numOfPoints; _i++){
          this.dataPointSymbolContainer.append("circle").classed(`datapointCircle${_i}`,true)
                                       .attr("cx", xScale(_i))
                                       .attr("cy", yScale(PBI[_i]))
                                       .attr("r", 20)
                                       .style("fill", "black")
                                       .style("fill-opacity", "0")  
                                       ;

          //larger hit points for the tooltip
          var rectWidght = 20;
          var rectHeight = 60;
         this.dataPointSymbolContainer.append("rect").classed(`mouse-over-line${_i}`, true)
                                       .attr("x", xScale(_i))
                                       .attr("y", yScale(PBI[_i]))
                                       .attr("width", rectWidght)
                                       .attr("height", rectHeight)
                                       .style("fill", "black")
                                       .style("fill-opacity", 0) //change to a number higher than 0 to see the element tooltip is attached to
                                       .attr("transform",svgUtils.manipulation.translate(((rectWidght / 2) * -1), ((rectHeight / 2) * -1)))  //moving the rect to the left and up by half the rect width and height to center over the data point
                                       ;

           


          //console.log("_i", _i);
          //console.log("class", `.datapoint${_i}`);
         
          //var valueNum: number = PBI[_i];
          //console.log("valueNum", PBI[_i]);

          //console.log('PBI [] value', PBI[_i]);

        }

       // this.dataPointSymbolContainer.selectAll("circle").on("mouseover", function(d) {d3.select(this).style("fill-opacity", "1")
       //                                                         })
       //                                                   .on("mouseout", function(d) {d3.select(this).style("fill-opacity", "0")
       //                                                         });
                                               

    }
  
    private handleDataPointsLabelBackground(numOfPoints: number, xScale:d3.ScaleLinear<number, number>,yScale: d3.ScaleLinear<number, any>, PBI:any[], fill:string, format: string){
      this.dataLabelBackgroundContainer.selectAll("rect").remove()
      var _i: number;
      var yPosition: number;
      var displayValue;
      var rectHeight = 16;
      var rectWidth: number;

      for(_i = 0; _i < numOfPoints; _i++){
        //Checks the value of the following of the array element to detrerming data label placement    
        if(PBI[_i] <= PBI[_i-1]){
              yPosition = 0;
          }
          else {
            yPosition = rectHeight * -1
          }


          if(_i == 0){
            if(PBI[_i] <= PBI[_i+1]){
              yPosition = 0;
          }
            else {
              yPosition = -4
            }
        }

        //Check if we are at the last value of the array. If so use the previous value to determine placement
        if(_i == (PBI.length - 1)){
          if(PBI[_i] <= PBI[_i-1]){
            yPosition = 0;
          }
          else {
            yPosition = rectHeight * -1;
          }
        }     

        var spacing = 5;
        var xPosition = (PBI[_i].toString().length * spacing) * -1 //equation to help center the data label
        rectWidth = PBI[_i].toString().length * (spacing * 2);

        if(format == "percentage"){
          displayValue = (PBI[_i] * 100).toFixed(2);
          xPosition = (displayValue.toString().length * spacing) * -1
          rectWidth = displayValue.toString().length * (spacing * 2);

        this.dataLabelBackgroundContainer.append("rect").classed(`datapointbackground${_i}`,true)
                                     .attr("x", xScale(_i))
                                     .attr("y", yScale(PBI[_i]))
                                     .attr("rx", 4)
                                     .attr("ry", 4)
                                     .attr("width", rectWidth)
                                     .attr("height", rectHeight)
                                     .style("fill", fill)
                                     .style("opacity", 0.5) //TODO: Allow user to chose transparency with a slider from 0 - 100
                                     .attr("transform",svgUtils.manipulation.translate(xPosition,yPosition))
                                     ;

        }
        else {
          this.dataLabelBackgroundContainer.append("rect").classed(`datapointbackground${_i}`,true)
                                     .attr("x", xScale(_i))
                                     .attr("y", yScale(PBI[_i]))
                                     .attr("rx", 4)
                                     .attr("ry", 4)
                                     .attr("width", rectWidth)
                                     .attr("height", rectHeight)
                                     .style("fill", fill)
                                     .style("opacity", 0.5) //TODO: Allow user to chose transparency with a slider from 0 - 100
                                     .attr("transform",svgUtils.manipulation.translate(xPosition,yPosition))
        }
                
 
      }     

    }

  private handleLineUpdate_medianTooltip(plotData:models.ChartViewModel,offset_y:number,xScale:d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, any>, median:number){
  
    plotData.dataPoints.forEach((element, index) => {
      let lineId = `lineChartToolTip${index}`;
      this.lineChartContainer_mean.append("path").attr("id", lineId);
      this.lineChartContainer_mean.append("text").attr("id", `${lineId}Label`);

      let line = d3
        .line<models.ChartDataPoint>()
        .x(d => xScale(d.x_axis))
        .y(d => yScale(median));

      this.lineChartContainer_mean
        .select(`#${lineId}`)
        .datum(element)
        .attr("d", line);    

      this.lineChartContainer_mean
        .select(`#${lineId}`)
        .classed("medianToolTip", true)
        .style("stroke","transparent")
       // .style("stroke", "black") //testing
        .style("stroke-width", "20px");

    });
  }

  
  private handleLineUpdate_UCTooltip(plotData:models.ChartViewModel,offset_y:number,xScale:d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, any>, UC:number, fill:string){
  
      plotData.dataPoints.forEach((element, index) => {
        let lineId = `lineChartToolTip${index}`;
        this.lineChartContainer_UC.append("path").attr("id", lineId);
        this.lineChartContainer_UC.append("text").attr("id", `${lineId}Label`);

        let line = d3
          .line<models.ChartDataPoint>()
          .x(d => xScale(d.x_axis))
          .y(d => yScale(UC)); 
  
        this.lineChartContainer_UC
          .select(`#${lineId}`)
          .datum(element)
          .attr("d", line)
          
  
        this.lineChartContainer_UC
          .select(`#${lineId}`)
          .classed("UCToolTip", true)
          .style("stroke","transparent")
          //.style("stroke", "black") //testing
          .style("Stroke-width", "20px");

      });
      
      
    }

 
    private handleLineUpdate_LCToolTip(plotData:models.ChartViewModel,offset_y:number,xScale:d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, any>, LC:number, fill:string){
  
      plotData.dataPoints.forEach((element, index) => {
        let lineId = `lineChartToolTip${index}`;
        this.lineChartContainer_LC.append("path").attr("id", lineId);
        this.lineChartContainer_LC.append("text").attr("id", `${lineId}Label`);

        let line = d3
          .line<models.ChartDataPoint>()
          .x(d => xScale(d.x_axis))
          .y(d => yScale(LC));  //this needs to be feed the mean
  
        this.lineChartContainer_LC
          .select(`#${lineId}`)
          .datum(element)
          .attr("d", line)
          
  
        this.lineChartContainer_LC
          .select(`#${lineId}`)
          .classed("LCToolTip", true)
          .style("stroke-width", "20px") 
          //.style("stroke", "black") //testing
          .style("stroke", "transparent")
          ;


      });
      
      
    }

    private getTooltipData(value: any, fill: string, label: string, measureLabel: string): models.TooltipData[] {      
      return [{
        header: label,  
        displayName: measureLabel,
        value: value.toString(),
        color: fill,
        }
      ];   
    }

    private getTooltipData_dataPoint(value: any, fill: string, label: string, measureLabel: string, format: string): models.TooltipData[] {
      var displayValue;
      
      if(format == "percentage"){
        displayValue = (value * 100).toFixed(2);
        return [{
                    header: label,  
                    displayName: measureLabel,
                    value: displayValue.toString() + "%",
                    color: fill,
                }];
      }
        else if(format == "numeric"){
            return [{
              header: label,  
              displayName: measureLabel,
              value: math.round(value).toString(),
              color: fill,
            }];
        }
        
        else {
          return [{
            header: label,  
            displayName: measureLabel,
            value: value.toString(),
            color: fill,
          }];

        }
      

    }


      
    private yAxisStandardDeviation(width: number, yScale: d3.ScaleLinear<number, any>, median: number, UC_1: number, UC_2: number, UC_3: number, LC_1: number, LC_2: number, LC_3: number){
      this.yAxisStdDev.selectAll("text").remove();
      this.yAxisStdDev.append("text")
              .attr("x", width - 75)
              .attr("y", yScale(UC_1))
              .style("font-size", "12px")
              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
              //.style("fill", fill)
              //.text(PBI[_i].toString())
              .text("+1 SD")
              .attr("transform",svgUtils.manipulation.translate(0,3));
      this.yAxisStdDev.append("text")
              .attr("x", width - 75)
              .attr("y", yScale(UC_2))
              .style("font-size", "12px")
              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
              //.style("fill", fill)
              //.text(PBI[_i].toString())
              .text("+2 SD")
              .attr("transform",svgUtils.manipulation.translate(0,3));
      this.yAxisStdDev.append("text")
              .attr("x", width - 75)
              .attr("y", yScale(UC_3))
              .style("font-size", "12px")
              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
              //.style("fill", fill)
              //.text(PBI[_i].toString())
              .text("+3 SD")
              .attr("transform",svgUtils.manipulation.translate(0,3));


      this.yAxisStdDev.append("text")
              .attr("x", width - 75)
              .attr("y", yScale(median))
              .style("font-size", "12px")
              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
              //.style("fill", fill)
              //.text(PBI[_i].toString())
              .text("0 SD")
              .attr("transform",svgUtils.manipulation.translate(7,3));       


      this.yAxisStdDev.append("text")
              .attr("x", width - 75)
              .attr("y", yScale(LC_1))
              .style("font-size", "12px")
              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
              //.style("fill", fill)
              //.text(PBI[_i].toString())
              .text("-1 SD")
              .attr("transform",svgUtils.manipulation.translate(0,3));
      this.yAxisStdDev.append("text")
              .attr("x", width - 75)
              .attr("y", yScale(LC_2))
              .style("font-size", "12px")
              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
              //.style("fill", fill)
              //.text(PBI[_i].toString())
              .text("-2 SD")
              .attr("transform",svgUtils.manipulation.translate(0,3));
      this.yAxisStdDev.append("text")
              .attr("x", width - 75)
              .attr("y", yScale(LC_3))
              .style("font-size", "12px")
              .style("font-family", `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`)
              //.style("fill", fill)
              //.text(PBI[_i].toString())
              .text("-3 SD")
              .attr("transform",svgUtils.manipulation.translate(0,3));

    }



    private leastSquares(xSeries, ySeries) {
      var reduceSumFunc = function(prev, cur) { return prev + cur; };
      
      var xBar = xSeries.reduce(reduceSumFunc) * 1.0 / xSeries.length;
      var yBar = ySeries.reduce(reduceSumFunc) * 1.0 / ySeries.length;
  
      var ssXX = xSeries.map(function(d) { return Math.pow(d - xBar, 2); })
        .reduce(reduceSumFunc);
      
      var ssYY = ySeries.map(function(d) { return Math.pow(d - yBar, 2); })
        .reduce(reduceSumFunc);
        
      var ssXY = xSeries.map(function(d, i) { return (d - xBar) * (ySeries[i] - yBar); })
        .reduce(reduceSumFunc);
        
      var slope = ssXY / ssXX;
      var intercept = yBar - (xBar * slope);
      var rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);
      
      console.log("trend function", slope, intercept, rSquare);
      return [slope, intercept, rSquare];

    }



  private static parseSettings(dataView: DataView): VisualSettings {
        return VisualSettings.parse(dataView) as VisualSettings;
    }




    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);

    }

    public destroy(): void {
        //Perform any cleanup tasks here
      }
}