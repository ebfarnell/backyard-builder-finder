declare module '@mapbox/mapbox-gl-draw' {
  export interface DrawEvent {
    type: string;
    target: MapboxDraw;
    features: GeoJSON.Feature[];
  }

  export default class MapboxDraw {
    constructor(options?: any);
    onAdd(map: any): HTMLElement;
    onRemove(map: any): void;
    add(feature: GeoJSON.Feature | GeoJSON.FeatureCollection): string[];
    deleteAll(): this;
    changeMode(mode: string, options?: any): this;
    getAll(): GeoJSON.FeatureCollection;
    getSelected(): GeoJSON.FeatureCollection;
    getSelectedIds(): string[];
    set(featureCollection: GeoJSON.FeatureCollection): string[];
    delete(id: string | string[]): this;
    uncombineFeatures(): string[];
    combineFeatures(): string[];
    trash(): this;
  }
}