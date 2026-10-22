import { Composition, Still } from "remotion";
import { Demo, DEMO_DURATION } from "./Demo";
import { SocialPreview } from "./Stills";
import "./theme";
import { FPS } from "./timeline";

export const Root = () => (
  <>
    <Composition id="Demo" component={Demo} width={1600} height={900} fps={FPS} durationInFrames={DEMO_DURATION} />
    <Still id="SocialPreview" component={SocialPreview} width={1280} height={640} />
  </>
);
