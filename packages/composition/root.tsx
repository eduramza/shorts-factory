import React from "react";
import { Composition, registerRoot } from "remotion";
import { fixture } from "./defaults";
import { ShortComposition, type CompositionProps } from "./index";
function Root() {
  return (
    <Composition
      id="ShortComposition"
      defaultProps={{ edl: fixture(), sourceUrl: "", assets: [] }}
      component={ShortComposition}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(
          1,
          Math.round((props as CompositionProps).edl.duration_out * 30),
        ),
      })}
    />
  );
}
registerRoot(Root);
