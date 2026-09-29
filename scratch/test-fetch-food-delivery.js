// scratch/test-fetch-food-delivery.js
import { fetchRepoMetadata, fetchRepoTree } from "../server/src/services/githubService.js";
import { detectProjectLanguage } from "../server/src/services/languageDetector.js";
import { detectCapabilities } from "../server/src/rie/relevanceDetector.js";
import { buildTopology } from "../server/src/rie/topologyBuilder.js";

async function testRealRepo() {
  console.log("Fetching real metadata & tree for Mshandev/Food-Delivery...");
  const meta = await fetchRepoMetadata("Mshandev", "Food-Delivery");
  console.log("Metadata:", { name: meta.name, branch: meta.defaultBranch, language: meta.language });

  const treeData = await fetchRepoTree("Mshandev", "Food-Delivery", meta.defaultBranch);
  console.log("Tree stats:", treeData.stats);
  console.log("Filtered tree length:", treeData.tree.length);

  // Sample items from tree
  console.log("Sample items:", treeData.tree.slice(0, 10));

  const langResult = detectProjectLanguage(treeData.tree, null);
  console.log("\n--- Language Result ---");
  console.log(langResult);

  const techStack = {
    languages: langResult.primaryLanguage ? [langResult.primaryLanguage, ...langResult.secondaryLanguages] : [],
    frameworks: langResult.frameworks,
    databases: [],
    devops: [],
  };

  const caps = detectCapabilities(treeData.tree, techStack, null);
  console.log("\n--- Capabilities Result ---");
  console.log(caps);

  const topo = buildTopology({
    name: meta.name,
    tree: treeData.tree,
    techStack,
    primaryLanguage: langResult.primaryLanguage,
    secondaryLanguages: langResult.secondaryLanguages,
  });
  console.log("\n--- Topology Result ---");
  console.log(topo);
}

testRealRepo().catch(console.error);
