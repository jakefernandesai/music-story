import { loadEnvConfig } from "@next/env";
import {
  buildRabbitHoleDiagnosisReport,
  printRabbitHoleDiagnosisReport,
} from "../src/lib/rabbit-hole-diagnosis";
import { getStoryForUrl } from "../src/lib/get-story";

loadEnvConfig(process.cwd());

const TEST_CASES = [
  {
    label: "Ninajirachi",
    url: "https://open.spotify.com/track/5ZbztTcvj6QWWbeYsL4GTa",
  },
  {
    label: "Knocked Loose",
    url: "https://open.spotify.com/track/6PXYOVPBzO3xojFhQAvmde",
  },
  {
    label: "Burial",
    url: "https://open.spotify.com/track/5kadOt1O3LrIV46dns9v7u",
  },
  {
    label: "Overmono",
    url: "https://open.spotify.com/track/1ZnghCVtXCrtmKJH32z4UK",
  },
  {
    label: "Dua Lipa",
    url: "https://open.spotify.com/track/5nujrmhLynf4yMoMtj8AQF",
  },
] as const;

async function main() {
  console.log("Rabbit hole diagnosis — no scoring changes, read-only audit\n");

  for (const test of TEST_CASES) {
    console.log("\n" + "#".repeat(72));
    console.log(`# ${test.label}`);
    console.log("#".repeat(72));

    try {
      const story = await getStoryForUrl(test.url);
      const report = await buildRabbitHoleDiagnosisReport({
        rootTrack: story.rootTrack,
        nodes: story.nodes,
        edges: story.edges,
        vibeSignature: story.vibeSignature,
      });
      printRabbitHoleDiagnosisReport(report);
    } catch (error) {
      console.error(`ERROR for ${test.label}:`, error instanceof Error ? error.message : error);
    }

    // Space API calls to reduce rate-limit collisions between cases.
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
