import {bindPreview} from "./PreviewSubscriber";

export { PreviewTimelineSync } from './PreviewTimelineSync';
import { PreviewTimelineSync } from './PreviewTimelineSync';
import { bindMediaLibrary } from './MediaLibrarySubscriber';
import { bindExport } from './ExportSubscriber';
import { bindTranscription } from './TranscriptionSubscriber';
import {bindTimeline} from "./TimelineSubscriber";
import {MediaLibraryService} from "../mediaLibrary";
import {ExportService} from "../export";
import {TranscriptionService} from "../transcription";
import {LeftNav} from "../leftnav";
import {Timeline} from "@opensource/timeline";
import {CompositionPreview} from "@opensource/video-preview";
import {AnimationFrameLoop, EditorPlayback} from "../loop";
export {
  fromPreviewElementToTimelineClip,
  getTimelineClipZIndex,
  isLinkedAudioCompanion,
  timelineClipToCanvasElement,
} from './converters';


export function bindComponents(
    timeline: Timeline,
    preview: CompositionPreview,
    leftNav: LeftNav,
    transcription: TranscriptionService,
    mediaLibrary: MediaLibraryService,
    exportService: ExportService,
    frameLoop: AnimationFrameLoop,
) {
  const clipPreviewSync = new PreviewTimelineSync(timeline, preview);
  const editorPlayback = new EditorPlayback({timeline, preview, frameLoop});
  editorPlayback.bind();

  bindPreview({
    timeline: timeline,
    preview: preview,
    leftNav: leftNav,
    timelinePreviewSync: clipPreviewSync,
  });
  bindTranscription({
    transcription: transcription,
    timeline: timeline,
    preview: preview,
    clipPreviewSync: clipPreviewSync,
    leftNav: leftNav,
  });
  bindMediaLibrary({
    timeline: timeline,
    preview: preview,
    mediaLibrary: mediaLibrary,
  });
  bindExport({
    exportService: exportService,
    timeline: timeline,
    preview: preview,
  });

  bindTimeline({
    timeline: timeline,
    preview: preview,
    timelinePreviewSync: clipPreviewSync,
    editorPlayback,
  });
}