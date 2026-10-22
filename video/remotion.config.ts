import { Config } from "@remotion/cli/config";

// This Mac has 16 GB under memory pressure: two render tabs at most.
Config.setConcurrency(2);
// PNG frames keep terminal text crisp before H.264 encoding.
Config.setVideoImageFormat("png");
