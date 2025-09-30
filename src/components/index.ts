/**
 * Components Index - Export all React components
 */

export {
  HydroscopeCore,
  type HydroscopeCoreProps,
  type HydroscopeCoreRef,
} from "./HydroscopeCore.js";
export {
  ContainerControls,
  IndividualContainerControl,
  useContainerControls,
  type ContainerControlsProps,
  type IndividualContainerControlProps,
  type ContainerControlsState,
} from "./ContainerControls.js";
export {
  FileUpload,
  type FileUploadProps,
  type FileUploadState,
} from "./FileUpload.js";
export { Search, type SearchProps } from "./Search.js";
export { SearchInput, type SearchInputProps } from "./SearchInput.js";
export { SearchResults, type SearchResultsProps } from "./SearchResults.js";
export {
  SearchIntegration,
  type SearchIntegrationProps,
} from "./SearchIntegration.js";

// Panel Components
export {
  InfoPanel,
  type InfoPanelProps,
  type InfoPanelRef,
  type LegendData,
  type LegendItem,
  type EdgeStyleConfig,
  type GroupingOption,
  type SearchMatch,
  StyleTuner,
  type StyleTunerProps,
  type StyleConfig,
  type LayoutAlgorithm,
  type ColorPaletteOption,
} from "./panels/index.js";

// New Clean Hydroscope Component
export {
  Hydroscope,
  type HydroscopeProps,
  type RenderConfig,
} from "./Hydroscope.js";
