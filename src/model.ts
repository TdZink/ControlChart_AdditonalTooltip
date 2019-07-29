export interface ChartViewModel {
    dataPoints: ChartDataPoint[][];
    max_x: number;
    max_y:number;
    color:string[];
};
export interface ChartDataPoint {
    y_axis: number;
    x_axis: any;
};

export interface TooltipData {
    displayName: string;
    value: string;
    color?: string;
    header?: string;
  //  opacity?: string;
};