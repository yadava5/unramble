import { Composition, Still } from "remotion";
import { Demo, DEMO_DURATION } from "./Demo";
import { LinkedIn, LINKEDIN_DURATION } from "./LinkedIn";
import { LinkedInCover, SocialPreview } from "./Stills";
import "./theme";
import { FPS } from "./timeline";

export const Root = () => (
  <>
    <Composition id="Demo" component={Demo} width={1600} height={900} fps={FPS} durationInFrames={DEMO_DURATION} />
    <Composition id="LinkedIn" component={LinkedIn} width={1080} height={1350} fps={FPS} durationInFrames={LINKEDIN_DURATION} />
    <Still id="LinkedInCover" component={LinkedInCover} width={1080} height={1350} />
    <Still id="SocialPreview" component={SocialPreview} width={1280} height={640} />
  </>
);
