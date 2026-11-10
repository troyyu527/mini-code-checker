// Prints the facts of the sample model as a table. Run: npm run facts
import { readModel } from "./ifc";

const model = await readModel();
console.log(`storeys: ${model.storeys.join(", ")}`);
console.log(`${model.facts.length} elements, ${model.properties.length} property values`);
console.table(
  model.facts
    .filter((f) => f.ifcType === "IfcDoor" || f.ifcType === "IfcSpace")
    .map((f) => ({ type: f.ifcType, name: f.name, longName: f.longName, objectType: f.objectType, storey: f.storey, ...f.dims })),
);
