import {Audio} from "@remotion/media";
import {AbsoluteFill, Composition, Folder, Sequence, staticFile} from "remotion";
import {AiScene} from "./scenes/AiScene";
import {AnalyticsScene} from "./scenes/AnalyticsScene";
import {BoardScene} from "./scenes/BoardScene";
import {ChaosScene} from "./scenes/ChaosScene";
import {HookScene} from "./scenes/HookScene";
import {JevScene} from "./scenes/JevScene";
import {PipelineScene} from "./scenes/PipelineScene";
import {RevealScene} from "./scenes/RevealScene";
import {ModelsScene} from "./scenes/ModelsScene";

export const EmailAutomationLaunch: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: "#f6f7f9"}}>
      <Sequence durationInFrames={200} name="01 Hook"><HookScene duration={200} /></Sequence>
      <Sequence from={200} durationInFrames={200} name="02 Inbox overload"><ChaosScene duration={200} /></Sequence>
      <Sequence from={400} durationInFrames={200} name="03 Product reveal"><RevealScene duration={200} /></Sequence>
      <Sequence from={600} durationInFrames={200} name="04 Command Center"><PipelineScene duration={200} /></Sequence>
      <Sequence from={800} durationInFrames={200} name="05 Jev engine"><JevScene duration={200} /></Sequence>
      <Sequence from={1000} durationInFrames={200} name="06 Jev models"><ModelsScene duration={200} /></Sequence>
      <Sequence from={1200} durationInFrames={200} name="07 Application Board"><BoardScene duration={200} /></Sequence>
      <Sequence from={1400} durationInFrames={200} name="08 Analytics"><AnalyticsScene duration={200} /></Sequence>
      <Sequence from={1600} durationInFrames={200} name="09 AI Space and launch"><AiScene duration={200} /></Sequence>
      <Audio
        src={staticFile("soundsurfer-product-video-590799.mp3")}
        volume={(frame) => {
          if (frame < 30) return frame / 30 * 0.4;
          if (frame > 1740) return Math.max(0, (1800 - frame) / 60) * 0.4;
          return 0.4;
        }}
      />
    </AbsoluteFill>
  );
};

export const MyComposition: React.FC = () => {
  return (
    <>
      <Folder name="Launch-film-scenes">
        <Composition id="HookScene" component={() => <HookScene duration={420} />} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="PipelineScene" component={() => <PipelineScene duration={510} />} durationInFrames={510} fps={30} width={1920} height={1080} />
        <Composition id="ApplicationBoardScene" component={() => <BoardScene duration={510} />} durationInFrames={510} fps={30} width={1920} height={1080} />
      </Folder>
      <Composition id="EmailAutomationLaunch" component={EmailAutomationLaunch} durationInFrames={1800} fps={30} width={1920} height={1080} />
    </>
  );
};
