// scratch/debug-food-delivery.js
import { detectProjectLanguage } from "../server/src/services/languageDetector.js";
import { detectCapabilities } from "../server/src/rie/relevanceDetector.js";
import { buildTopology } from "../server/src/rie/topologyBuilder.js";

const foodDeliveryTree = [
  { path: "admin/package.json", type: "file", size: 739 },
  { path: "admin/src/App.jsx", type: "file", size: 1200 },
  { path: "admin/src/main.jsx", type: "file", size: 500 },
  { path: "backend/package.json", type: "file", size: 850 },
  { path: "backend/server.js", type: "file", size: 2100 },
  { path: "backend/config/db.js", type: "file", size: 400 },
  { path: "backend/controllers/foodController.js", type: "file", size: 1500 },
  { path: "backend/models/foodModel.js", type: "file", size: 800 },
  { path: "backend/routes/foodRoute.js", type: "file", size: 600 },
  { path: "backend/middleware/auth.js", type: "file", size: 700 },
  { path: "frontend/package.json", type: "file", size: 900 },
  { path: "frontend/src/App.jsx", type: "file", size: 3000 },
  { path: "frontend/src/main.jsx", type: "file", size: 400 },
];

console.log("=== 1. Language Detection ===");
const langResult = detectProjectLanguage(foodDeliveryTree, null);
console.log(JSON.stringify(langResult, null, 2));

const techStack = {
  languages: langResult.primaryLanguage ? [langResult.primaryLanguage, ...langResult.secondaryLanguages] : [],
  frameworks: langResult.frameworks,
  databases: [],
  devops: [],
};

console.log("\n=== 2. Capabilities Detection ===");
const caps = detectCapabilities(foodDeliveryTree, techStack, null);
console.log(JSON.stringify(caps, null, 2));

console.log("\n=== 3. Topology Builder ===");
const topo = buildTopology({
  name: "Food-Delivery",
  tree: foodDeliveryTree,
  techStack,
  primaryLanguage: langResult.primaryLanguage,
  secondaryLanguages: langResult.secondaryLanguages,
});
console.log(JSON.stringify(topo, null, 2));
