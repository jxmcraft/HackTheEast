/**
 * Mermaid diagram definitions per section (TED-Ed style interactive teaching).
 * Key: "topicId/sectionId" or "sectionId" for neural_networks.
 */

export type DiagramKey = string;

const DIAGRAMS: Record<string, string> = {
  // Neural Networks Basics
  "neural_networks/intro": `
flowchart LR
  subgraph inputs
    x1[x1]
    x2[x2]
    xn[xn]
  end
  subgraph neuron["Artificial Neuron"]
    w1[w1]
    w2[w2]
    wn[wn]
    sum[(Sum + bias)]
    act[activation]
  end
  x1 --> w1
  x2 --> w2
  xn --> wn
  w1 --> sum
  w2 --> sum
  wn --> sum
  sum --> act
  act --> output[output]
  `.trim(),
  "neural_networks/network_architecture": `
flowchart TB
  subgraph input["Input Layer"]
    i1[i1]
    i2[i2]
    i3[i3]
  end
  subgraph hidden["Hidden Layers"]
    h1[h1]
    h2[h2]
    h3[h3]
  end
  subgraph output["Output Layer"]
    o1[output]
  end
  i1 --> h1
  i1 --> h2
  i1 --> h3
  i2 --> h1
  i2 --> h2
  i2 --> h3
  i3 --> h1
  i3 --> h2
  i3 --> h3
  h1 --> o1
  h2 --> o1
  h3 --> o1
  `.trim(),
  "neural_networks/training": `
flowchart LR
  subgraph training["Training Loop"]
    A[Forward Pass] --> B[Loss]
    B --> C[Backprop]
    C --> D[Update Weights]
    D --> A
  end
  `.trim(),
  "neural_networks/activation_functions": `
flowchart TB
  subgraph activations["Common Activations"]
    relu["ReLU"]
    sig["Sigmoid"]
    tanh["Tanh"]
    softmax["Softmax"]
  end
  input[Input] --> relu
  input --> sig
  input --> tanh
  input --> softmax
  `.trim(),
};

export function getDiagramForSection(sectionId: string, topicId?: string): string | null {
  if (topicId) {
    const key = `${topicId}/${sectionId}`;
    if (DIAGRAMS[key]) return DIAGRAMS[key];
  }
  const fallback = `neural_networks/${sectionId}`;
  return DIAGRAMS[fallback] ?? null;
}
