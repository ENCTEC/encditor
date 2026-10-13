import { Composition } from "remotion";
import {
  calcularMetadata,
  EditorTimeline,
} from "./EditorTimeline/EditorTimeline";
import { Timeline, timelineSchema } from "../timeline/schema";
import exemploTimeline from "../timeline/exemplo-timeline.json";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EditorTimeline"
        component={EditorTimeline}
        schema={timelineSchema}
        defaultProps={exemploTimeline as Timeline}
        calculateMetadata={calcularMetadata}
        // Valores provisórios: calcularMetadata substitui pelos do JSON.
        durationInFrames={1}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
